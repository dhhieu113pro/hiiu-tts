import { writeFileSync, mkdirSync, rmSync, existsSync, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { synthesize } from "../src/tts.js";

const AVAILABLE_VOICES = [
  "Ngọc Huyền (mới)", "Ban Mai", "Chiếu Thành", "Duy Oryx", "Lạc Phi", "Mai Phương", 
  "Mạnh Dũng", "Minh Khang", "Minh Quang", "Minh Thu", "Mỹ Tâm", "Ngọc Huyền", 
  "Ngọc Ngạn", "Phương Trang", "Tài An", "Thanh Phương", "Thanh Phương Viettel", 
  "Thiện Tâm", "Trấn Thành", "Việt Thảo"
];

const sampleText = "Sự xuất hiện của Galaxy Z Fold8 cùng tỷ lệ màn hình gần 4:3 đã tạo ra một làn sóng bàn luận sôi nổi trong giới công nghệ. Nhiều chuyên gia và người dùng đều có chung nhận định rằng màn hình to bè mang lại cảm giác sử dụng cực kỳ thoải mái. Điều này mở ra một góc nhìn mới về sự đa dạng trong thiết kế di động.";

const projectRoot = process.cwd();
const outputDir = join(projectRoot, "public", "audio", "demos");
const tempModelsDir = join(projectRoot, "models", "temp_demos");

mkdirSync(outputDir, { recursive: true });
mkdirSync(tempModelsDir, { recursive: true });

async function downloadAsset(url, destPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destPath));
}

async function generateDemo(voice) {
  const targetWav = join(outputDir, `${voice}.wav`);
  if (existsSync(targetWav)) {
    console.log(`[SKIPPED] ${voice}.wav already exists`);
    return;
  }

  console.log(`[PROCESSING] ${voice}...`);
  const mPath = join(tempModelsDir, `${voice}.onnx`);
  const cPath = join(tempModelsDir, `${voice}.onnx.json`);

  // Download voice assets dynamically
  const encoded = encodeURIComponent(voice);
  console.log(`  Downloading assets...`);
  await Promise.all([
    downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx`, mPath),
    downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx.json`, cPath)
  ]);

  // Set environment variables dynamically so loader points to our temp folder
  process.env.LAMBDA_TASK_ROOT = tempModelsDir; // temporarily spoof modelsDir path in tts.ts
  
  // We need to temporarily configure tts.ts to use tempModelsDir.
  // Wait, in our current tts.ts:
  // const modelsDir = (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) ? "/tmp/models" : join(projectRoot, "models");
  // If we set process.env.NETLIFY = "true" and ensure we download to "/tmp/models", that works!
  // But wait, on local machine, we can just put the files in models/ and they will be found!
  // Let's copy them to models/${voice}.onnx directly, which is what ensureModelDownloaded checks.
  
  console.log(`  Synthesizing audio...`);
  try {
    const result = await synthesize({
      model: voice,
      input: sampleText,
      speed: 1.0,
      response_format: "wav"
    });
    
    writeFileSync(targetWav, result.data);
    console.log(`  [SUCCESS] Saved ${voice}.wav`);
  } catch (err) {
    console.error(`  [FAILED] ${voice}:`, err);
  } finally {
    // Clean up model files to save disk space
    if (existsSync(mPath)) rmSync(mPath);
    if (existsSync(cPath)) rmSync(cPath);
  }
}

async function run() {
  // Let's spoof modelsDir for tts.ts to use the local temp folder
  process.env.NETLIFY = "true";
  // Override modelsDir in tts.ts dynamically by redirecting /tmp/models to our local temp folder?
  // No, process.env.NETLIFY or process.env.LAMBDA_TASK_ROOT makes tts.ts use "/tmp/models".
  // Let's check how ensureModelDownloaded is coded:
  // if (process.env.NETLIFY) -> /tmp/models
  // If we don't set process.env.NETLIFY, it uses join(projectRoot, "models").
  // So if we download files to join(projectRoot, "models", `${voice}.onnx`) and DO NOT set process.env.NETLIFY,
  // ensureModelDownloaded will find them in projectRoot/models/!
  // Let's use this simple approach instead.
}

// Let's just download directly to the standard models directory and delete them after synthesis.
async function generateAll() {
  const modelsDir = join(projectRoot, "models");
  for (const voice of AVAILABLE_VOICES) {
    const targetWav = join(outputDir, `${voice}.wav`);
    if (existsSync(targetWav)) {
      console.log(`[SKIPPED] ${voice}.wav already exists`);
      continue;
    }

    console.log(`[PROCESSING] ${voice}...`);
    const mPath = join(modelsDir, `${voice}.onnx`);
    const cPath = join(modelsDir, `${voice}.onnx.json`);

    try {
      const encoded = encodeURIComponent(voice);
      await Promise.all([
        downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx`, mPath),
        downloadAsset(`https://nghitts.app/api/model/${encoded}.onnx.json`, cPath)
      ]);

      const result = await synthesize({
        model: voice,
        input: sampleText,
        speed: 1.0,
        response_format: "wav"
      });

      writeFileSync(targetWav, result.data);
      console.log(`  [SUCCESS] Saved ${voice}.wav`);
    } catch (err) {
      console.error(`  [FAILED] ${voice}:`, err);
    } finally {
      // Clean up to save local storage
      if (existsSync(mPath)) rmSync(mPath);
      if (existsSync(cPath)) rmSync(cPath);
    }
  }
}

await generateAll();
console.log("All demos generated!");
