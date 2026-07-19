const form = document.querySelector("#speech-form");
const input = document.querySelector("#input");
const count = document.querySelector("#character-count");
const speed = document.querySelector("#speed");
const speedValue = document.querySelector("#speed-value");
const button = document.querySelector("#generate");
const errorBox = document.querySelector("#error");
const emptyState = document.querySelector("#empty-state");
const audioResult = document.querySelector("#audio-result");
const audio = document.querySelector("#audio");
const download = document.querySelector("#download");
const fileInfo = document.querySelector("#file-info");
const timing = document.querySelector("#timing");
const resultTitle = document.querySelector("#result-title");
let audioUrl;

fetch("/v1/tts/models")
  .then(response => response.ok ? response.json() : Promise.reject())
  .then(({ data }) => {
    const model = data?.[0];
    if (!model) return;
    document.querySelector("#model").innerHTML = `<option value="${model.id}">${model.id}</option>`;
  })
  .catch(() => {});

function updateCount() { count.textContent = `${input.value.length.toLocaleString()} / 2,000`; }
function updateSpeed() { speedValue.textContent = `${Number(speed.value).toFixed(1)}x`; }
input.addEventListener("input", updateCount);
speed.addEventListener("input", updateSpeed);
updateCount();

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.classList.add("loading");
  button.setAttribute("aria-busy", "true");
  resultTitle.textContent = "Generating audio";
  timing.hidden = true;
  const format = new FormData(form).get("format");
  const started = performance.now();

  try {
    const response = await fetch("/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: document.querySelector("#model").value,
        input: input.value,
        speed: Number(speed.value),
        response_format: format
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || `Request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audio.src = audioUrl;
    download.href = audioUrl;
    download.download = `nghitts.${format}`;
    fileInfo.textContent = `${format.toUpperCase()}  ${formatBytes(blob.size)}`;
    timing.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s`;
    timing.hidden = false;
    emptyState.hidden = true;
    audioResult.hidden = false;
    resultTitle.textContent = "Speech generated";
    if (format === "wav") audio.play().catch(() => {});
  } catch (error) {
    errorBox.textContent = error instanceof Error ? error.message : String(error);
    errorBox.hidden = false;
    resultTitle.textContent = "Generation failed";
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
    button.removeAttribute("aria-busy");
  }
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
