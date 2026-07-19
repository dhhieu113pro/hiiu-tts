import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as ort from "onnxruntime-web";
import { phonemize } from "phonemizer";
import { encodePcm16, encodeWav, normalize } from "./audio.js";
import { chunkText, normalizeVietnamese } from "./text.js";
import type { SpeechRequest, VoiceConfig } from "./types.js";

const projectRoot = process.cwd();
const modelPath = join(projectRoot, "models", "voice.onnx");
const configPath = join(projectRoot, "models", "voice.onnx.json");
const wasmRoot = join(projectRoot, "node_modules", "onnxruntime-web", "dist") + "/";
ort.env.wasm.wasmPaths = wasmRoot;
ort.env.wasm.numThreads = 1;

let runtime: Promise<{ session: ort.InferenceSession; config: VoiceConfig; name: string }> | undefined;

async function loadRuntime() {
  const [model, rawConfig, name] = await Promise.all([
    readFile(modelPath), readFile(configPath, "utf8"), readFile(join(projectRoot, "models", "voice.name"), "utf8")
  ]);
  const config = JSON.parse(rawConfig) as VoiceConfig;
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
  return { session, config, name: name.trim() };
}

function phonemeIds(text: string, config: VoiceConfig): bigint[] {
  const result: bigint[] = [];
  const add = (symbol: string) => config.phoneme_id_map[symbol]?.forEach(id => result.push(BigInt(id)));
  add("^"); add("_");
  for (const symbol of Array.from(text.normalize("NFD"))) { add(symbol); add("_"); }
  add("$");
  return result;
}

function speakerId(value: string | number | undefined, config: VoiceConfig): number {
  if (value === undefined || value === "") return 0;
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  const mapped = config.speaker_id_map?.[String(value)];
  if (mapped === undefined) throw new Error(`Unknown speaker '${value}'`);
  return mapped;
}

export async function synthesize(request: SpeechRequest): Promise<{ data: Uint8Array; type: string }> {
  if (!request.input?.trim()) throw new Error("input must not be empty");
  const speed = request.speed ?? 1;
  if (speed < 0.25 || speed > 4) throw new Error("speed must be between 0.25 and 4.0");
  const loaded = await (runtime ??= loadRuntime());
  if (request.model && !["default", loaded.name].includes(request.model)) throw new Error(`Only model '${loaded.name}' is installed`);
  const { session, config } = loaded;
  const chunks = chunkText(normalizeVietnamese(request.input));
  const output: Float32Array[] = [];
  let length = 0;
  const sampleRate = config.audio.sample_rate;
  const betweenChunks = Math.round(sampleRate * 0.12);
  const finalTail = Math.round(sampleRate * 0.2);
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const clauses = await phonemize(chunk, config.espeak?.voice || "vi");
    const ids = phonemeIds(clauses.join("\r\n").replace(/\((?:en|vi)\)/gi, ""), config);
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
