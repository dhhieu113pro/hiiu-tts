import assert from "node:assert/strict";
import test from "node:test";
import { encodeWav } from "../src/audio.ts";
import { chunkText, normalizeVietnamese, splitLanguageSegments } from "../src/text.ts";

test("normalizes basic Vietnamese numbers, dates and percentages", () => {
  assert.equal(normalizeVietnamese("Xin chào 18/7/2026, đạt 6,5%!"),
    "Xin chào ngày mười tám tháng bảy năm hai nghìn không trăm hai mươi sáu, đạt sáu phẩy năm phần trăm!");
});

test("splits explicit and obvious English names from Vietnamese", () => {
  assert.deepEqual(splitLanguageSegments("Xin chào OpenAI và [en]Apple iPhone[/en]."), [
    { text: "Xin chào ", voice: "vi" },
    { text: "OpenAI", voice: "en-us" },
    { text: " và ", voice: "vi" },
    { text: "Apple iPhone", voice: "en-us" },
    { text: ".", voice: "vi" }
  ]);
});

test("chunks sentences and adds terminal punctuation", () => {
  assert.deepEqual(chunkText("xin chào. hôm nay đẹp trời"), ["xin chào.", "hôm nay đẹp trời."]);
});

test("splits long speech at phrase punctuation", () => {
  assert.deepEqual(chunkText("một hai ba, bốn năm sáu bảy", 16), ["một hai ba,", "bốn năm sáu bảy."]);
});

test("encodes a valid mono PCM WAV header", () => {
  const wav = encodeWav(Float32Array.from([0, 1, -1]), 22050);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), "RIFF");
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 22050);
  assert.equal(wav.length, 50);
});
