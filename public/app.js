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
const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  });
}

let audioUrl;

fetch("/v1/tts/models")
  .then(response => response.ok ? response.json() : Promise.reject())
  .then(({ data }) => {
    if (!data || data.length === 0) return;
    document.querySelector("#model").innerHTML = data
      .map(model => `<option value="${model.id}">${model.id}</option>`)
      .join("");

    const demosGrid = document.querySelector("#demos-grid");
    if (demosGrid) {
      demosGrid.innerHTML = data.map(model => `
        <div class="demo-item">
          <span class="demo-item-name">${model.id}</span>
          <button class="demo-play-btn" data-voice="${model.id}" aria-label="Listen to ${model.id}">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      `).join("");
      setupDemoHandlers();
    }
  })
  .catch(() => {});

let currentPlayingAudio = null;
let currentPlayingBtn = null;

function setupDemoHandlers() {
  const playButtons = document.querySelectorAll(".demo-play-btn");

  playButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.classList.contains("playing")) {
        stopCurrentDemo();
        return;
      }

      stopCurrentDemo();

      const voice = btn.getAttribute("data-voice");
      btn.disabled = true;
      btn.classList.add("loading");
      btn.innerHTML = `<svg viewBox="0 0 24 24" style="animation: spin 1s linear infinite;"><path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8z"/></svg>`;

      try {
        const url = `/audio/demos/${encodeURIComponent(voice)}.wav`;
        const audio = new Audio(url);
        currentPlayingAudio = audio;
        currentPlayingBtn = btn;

        audio.addEventListener("playing", () => {
          btn.disabled = false;
          btn.classList.remove("loading");
          btn.classList.add("playing");
          btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        });

        audio.addEventListener("ended", () => {
          stopCurrentDemo();
        });

        audio.addEventListener("error", (e) => {
          console.error("Audio error:", e);
          stopCurrentDemo();
        });

        await audio.play();
      } catch (err) {
        console.error(err);
        stopCurrentDemo();
      }
    });
  });
}

function stopCurrentDemo() {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio = null;
  }
  if (currentPlayingBtn) {
    currentPlayingBtn.classList.remove("playing");
    currentPlayingBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    currentPlayingBtn = null;
  }
}

function updateCount() { count.textContent = `${input.value.length.toLocaleString()} / 500`; }
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
