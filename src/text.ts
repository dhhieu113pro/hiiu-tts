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
    .replace(/\s+/g, " ").trim().toLowerCase();
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
