# vercel-tts

An OpenAI-compatible Vietnamese text-to-speech API built for Vercel Node
Functions. `vercel-tts` uses NghiTTS as its TTS backend, including its pinned
eSpeak phonemizer WebAssembly bundle and Piper ONNX models, with inference
provided by `onnxruntime-web`.

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
curl -X POST https://hiiu-tts.netlify.app/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"Ngọc Huyền (mới)","input":"Xin chào Việt Nam!","speed":1,"response_format":"wav"}' \
  --output speech.wav
```

Deploy to production with `npx vercel --prod`. The function is intentionally
stateless: changing a voice requires a new deployment rather than downloading
models at request time.
