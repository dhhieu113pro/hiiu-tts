# NghiTTS Vercel REST API

One-voice, OpenAI-compatible Vietnamese TTS endpoint for Vercel Node Functions.
It uses the pinned NghiTTS eSpeak phonemizer WebAssembly bundle and Piper ONNX
inference through `onnxruntime-web`.

The home page is an interactive API console and includes request, response,
model, and model-installation documentation. `GET /v1/tts/models` returns the
voice packaged in the current deployment.

## Run locally

```bash
npm install
npm run build
npx vercel dev
```

The build downloads the `Ngọc Huyền (mới)` model into the ignored `models/` folder.
Set `NGHITTS_VOICE` during the build to package another catalog voice instead.

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"default","input":"Xin chào Việt Nam!","speed":1,"response_format":"wav"}' \
  --output speech.wav
```

Deploy with `npx vercel`. The function is intentionally stateless: changing a
voice requires a new deployment rather than downloading models at request time.
