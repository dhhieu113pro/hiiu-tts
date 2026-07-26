import { readFileSync, existsSync, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import * as ort from "onnxruntime-web";
import { phonemize } from "phonemizer";
import { encodePcm16, encodeWav, normalize } from "./audio.js";
import { chunkText, normalizeVietnamese, splitLanguageSegments } from "./text.js";
import type { SpeechRequest, VoiceConfig } from "./types.js";

const projectRoot = process.cwd();
const wasmRoot = join(projectRoot, "node_modules", "onnxruntime-web", "dist") + "/";
ort.env.wasm.wasmPaths = wasmRoot;
ort.env.wasm.numThreads = 1;

const modelsDir = (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) 
  ? "/tmp/models" 
  : join(projectRoot, "models");

const runtimes = new Map<string, Promise<{ session: ort.InferenceSession; config: VoiceConfig; name: string }>>();

async function downloadAsset(url: string, destPath: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destPath));
}

async function ensureModelDownloaded(voice: string): Promise<{ modelPath: string; configPath: string }> {
  // First, check if the model exists in the local packaged models folder
  const localModelPath = join(projectRoot, "models", "voice.onnx");
  const localConfigPath = join(projectRoot, "models", "voice.onnx.json");
  const localNamePath = join(projectRoot, "models", "voice.name");
  
  if (existsSync(localNamePath)) {
    const localName = readFileSync(localNamePath, "utf8").trim();
    if ((localName === voice || voice === "default") && existsSync(localModelPath) && existsSync(localConfigPath)) {
      return { modelPath: localModelPath, configPath: localConfigPath };
    }
  }

  // Fallback to /tmp/models or project models/ folder for other voices
  await mkdir(modelsDir, { recursive: true });
  const mPath = join(modelsDir, `${voice}.onnx`);
  const cPath = join(modelsDir, `${voice}.onnx.json`);
  
  if (!existsSync(mPath) || !existsSync(cPath)) {
    const encoded = encodeURIComponent(voice);
    await Promise.all([
      downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx`, mPath),
      downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx.json`, cPath)
    ]);
  }
  return { modelPath: mPath, configPath: cPath };
}

async function loadRuntime(voice: string) {
  const { modelPath, configPath } = await ensureModelDownloaded(voice);
  const [model, rawConfig] = await Promise.all([
    readFile(modelPath), readFile(configPath, "utf8")
  ]);
  const config = JSON.parse(rawConfig) as VoiceConfig;
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
  return { session, config, name: voice };
}

export async function synthesize(request: SpeechRequest): Promise<{ data: Uint8Array; type: string }> {
  if (!request.input?.trim()) throw new Error("input must not be empty");
  const speed = request.speed ?? 1;
  if (speed < 0.25 || speed > 4) throw new Error("speed must be between 0.25 and 4.0");

  const voiceName = request.model && request.model !== "default" ? request.model : "Ngọc Huyền (mới)";
  let runtimePromise = runtimes.get(voiceName);
  if (!runtimePromise) {
    runtimePromise = loadRuntime(voiceName);
    runtimes.set(voiceName, runtimePromise);
  }
  const loaded = await runtimePromise;
  const { session, config } = loaded;
  const chunks = chunkText(normalizeVietnamese(request.input));
  const output: Float32Array[] = [];
  let length = 0;
  const sampleRate = config.audio.sample_rate;
  const betweenChunks = Math.round(sampleRate * 0.12);
  const finalTail = Math.round(sampleRate * 0.2);
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const phonemes: string[] = [];
    for (const segment of splitLanguageSegments(chunk)) {
      const clauses = await phonemize(segment.text, segment.voice === "en-us" ? "en-us" : (config.espeak?.voice || "vi"));
      phonemes.push(clauses.join("\r\n"));
    }
    const ids = phonemeIds(phonemes.join(" ").replace(/\((?:en|vi)\)/gi, ""), config);
    const feeds: Record<string, ort.Tensor> = {
      input: new ort.Tensor("int64", BigInt64Array.from(ids), [1, ids.length]),
      input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor("float32", Float32Array.from([0.667, 1 / speed, 0.8]), [3])
    };
    if ((config.num_speakers ?? 1) > 1 || session.inputNames.includes("sid")) {
      feeds.sid = new ort.Tensor("int64", BigInt64Array.from([BigInt(speakerId(request.voice, config))]), [1]);
    }
    const result = await session.run(feeds);
    const audio = Float32Array.from(result.output.data as Float32Array);
    output.push(audio); length += audio.length;
    if (index < chunks.length - 1) {
      output.push(new Float32Array(betweenChunks));
      length += betweenChunks;
    }
  }
  output.push(new Float32Array(finalTail));
  length += finalTail;
  const samples = new Float32Array(length);
  let offset = 0;
  for (const part of output) { samples.set(part, offset); offset += part.length; }
  normalize(samples);
  if ((request.response_format ?? "wav") === "pcm") return { data: encodePcm16(samples), type: "audio/pcm" };
  if ((request.response_format ?? "wav") !== "wav") throw new Error("response_format must be 'wav' or 'pcm'");
  return { data: encodeWav(samples, sampleRate), type: "audio/wav" };
}
