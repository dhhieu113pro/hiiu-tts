import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const voice = process.env.NGHITTS_VOICE || "Ngọc Huyền (mới)";
const root = new URL("../models/", import.meta.url);
const nameFile = new URL("voice.name", root);
mkdirSync(root, { recursive: true });
const installedVoice = existsSync(nameFile) ? readFileSync(nameFile, "utf8").trim() : "";

async function download(suffix) {
  const target = new URL(`voice.onnx${suffix}`, root);
  if (installedVoice === voice && existsSync(target)) return;
  const temporary = new URL(`voice.onnx${suffix}.download`, root);
  const source = `https://nghitts.app/api/model/${encodeURIComponent(voice)}.onnx${suffix}`;
  const response = await fetch(source);
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${source}`);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

await Promise.all([download(""), download(".json")]);
await writeFile(nameFile, `${voice}\n`, "utf8");
console.log(`Prepared NghiTTS voice: ${voice}`);
