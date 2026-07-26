# hiiu-tts

An OpenAI-compatible Vietnamese text-to-speech API built for Netlify and Vercel Serverless/Edge Functions. `hiiu-tts` uses NghiTTS as its TTS backend, including its pinned eSpeak phonemizer WebAssembly bundle and Piper ONNX models, with inference provided by `onnxruntime-web`.

The home page (`https://hiiu-tts.netlify.app/`) serves as an interactive API console and includes request, response, and model documentation.

## Features

- **Multi-Voice Support:** Serves all 20 available voice models from NghiTTS, downloaded and cached dynamically at runtime on serverless containers.
- **Unlimited Text Length:** The interactive console automatically splits long text into smaller segments on sentence boundaries and merges the returned WAV binary streams on the client side, bypassing serverless function execution timeout limits (e.g. Netlify's 10s timeout).
- **Text Normalization:** Extends numbers, percentages, dates, and mathematical ratios (e.g., `4:3` ➔ `bốn chia ba`) to correct spoken Vietnamese.
- **Theme Support:** Detects browser dark/light mode preference automatically, with manual toggle support and persistent settings via `localStorage`.

## Run locally

To run and test the Netlify site and functions locally:

```bash
npm install
npm run build
npx netlify dev
```

The build command downloads the default `Ngọc Huyền (mới)` voice model into the `models/` directory for local testing.

## API Reference

### List available models
```bash
curl https://hiiu-tts.netlify.app/v1/tts/models
```

### Generate speech
```bash
curl -X POST https://hiiu-tts.netlify.app/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Ngọc Huyền (mới)",
    "input": "Xin chào Việt Nam!",
    "speed": 1.0,
    "response_format": "wav"
  }' \
  --output speech.wav
```

## Deployment

Deploy directly to Netlify by linking your repository. The `netlify.toml` file will automatically run the build, output files to `public/`, and direct endpoints to serverless functions under `netlify/functions/`.
