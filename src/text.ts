const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function underThousand(value: number): string {
  if (value < 10) return digits[value];
  if (value < 20) return value === 10 ? "mười" : `mười ${value === 15 ? "lăm" : digits[value - 10]}`;
  if (value < 100) {
    const ones = value % 10;
    const tail = ones === 0 ? "" : ones === 1 ? " mốt" : ones === 4 ? " tư" : ones === 5 ? " lăm" : ` ${digits[ones]}`;
    return `${digits[Math.floor(value / 10)]} mươi${tail}`;
  }
  const rest = value % 100;
  return `${digits[Math.floor(value / 100)]} trăm${rest === 0 ? "" : rest < 10 ? ` lẻ ${digits[rest]}` : ` ${underThousand(rest)}`}`;
}

export function numberToWords(value: number): string {
  if (!Number.isSafeInteger(value)) return String(value);
  if (value < 0) return `âm ${numberToWords(-value)}`;
  if (value < 1000) return underThousand(value);
  for (const [scale, name] of [[1_000_000_000, "tỷ"], [1_000_000, "triệu"], [1_000, "nghìn"]] as const) {
    if (value >= scale) {
      const rest = value % scale;
      let result = `${numberToWords(Math.floor(value / scale))} ${name}`;
      if (rest) result += rest < 10 ? ` không trăm lẻ ${numberToWords(rest)}` : rest < 100 ? ` không trăm ${numberToWords(rest)}` : ` ${numberToWords(rest)}`;
      return result;
    }
  }
  return String(value);
}

export function normalizeVietnamese(input: string): string {
  return input.normalize("NFC")
    .replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/giu, "")
    .replace(/&/g, " và ").replace(/@/g, " a còng ").replace(/#/g, " thăng ")
    .replace(/[\*_~`^]/g, " ").replace(/[–—−]/g, "-").replace(/…/g, "...")
    .replace(/(\d+)[,.](\d+)\s*%/g, (_, whole, decimal) => `${numberToWords(+whole)} phẩy ${numberToWords(+decimal)} phần trăm`)
    .replace(/(\d+)\s*%/g, (_, number) => `${numberToWords(+number)} phần trăm`)
    .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, day, month, year) => `ngày ${numberToWords(+day)} tháng ${numberToWords(+month)} năm ${numberToWords(+year)}`)
    .replace(/\b\d+\b/g, value => numberToWords(+value))
    .replace(/\s+/g, " ").trim();
}

export interface LanguageSegment {
  text: string;
  voice: "vi" | "en-us";
}

/**
 * Split text into phonemizer runs without pretending that every ASCII word is
 * English (many Vietnamese words are ASCII too). Explicit [en] tags are the
 * reliable option; camel-case brand names and acronyms are safe auto-detects.
 */
export function splitLanguageSegments(input: string): LanguageSegment[] {
  const segments: LanguageSegment[] = [];
  const taggedOrEnglishName = /\[en\]([\s\S]*?)\[\/en\]|\[vi\]([\s\S]*?)\[\/vi\]|\b(?:[A-Z]{2,}|[A-Z][a-z]+[A-Z][A-Za-z]*)\b/g;
  let at = 0;

  const push = (text: string, voice: LanguageSegment["voice"]) => {
    if (!text) return;
    const previous = segments.at(-1);
    if (previous?.voice === voice) previous.text += text;
    else segments.push({ text, voice });
  };

  for (const match of input.matchAll(taggedOrEnglishName)) {
    push(input.slice(at, match.index), "vi");
    if (match[1] !== undefined) push(match[1], "en-us");
    else if (match[2] !== undefined) push(match[2], "vi");
    else push(match[0], "en-us");
    at = match.index + match[0].length;
  }
  push(input.slice(at), "vi");
  return segments;
}

export function chunkText(text: string, maxLength = 160): string[] {
  const result: string[] = [];
  for (const line of text.replace(/\r/g, "").split(/\n+/).map(x => x.trim()).filter(Boolean)) {
    const prepared = /[.!?]$/.test(line) ? line : `${line}.`;
    for (let sentence of prepared.split(/(?<=[.!?])(?=\s+|$)/).map(x => x.trim()).filter(Boolean)) {
      while (sentence.length > maxLength) {
        const search = sentence.slice(0, maxLength);
        const punctuation = Math.max(
          search.lastIndexOf(";"), search.lastIndexOf(","), search.lastIndexOf(":"),
          search.lastIndexOf("."), search.lastIndexOf("!"), search.lastIndexOf("?")
        );
        let at = punctuation >= Math.floor(maxLength / 3)
          ? punctuation + 1
          : sentence.lastIndexOf(" ", maxLength - 1);
        if (at < 1) at = maxLength;
        result.push(sentence.slice(0, at).trim()); sentence = sentence.slice(at).trimStart();
      }
      if (sentence) result.push(sentence);
    }
  }
  return result;
}
