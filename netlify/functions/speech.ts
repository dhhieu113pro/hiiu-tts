import { synthesize } from "../../src/tts.js";
import type { SpeechRequest } from "../../src/types.js";

function jsonError(status: number, message: string): Response {
  return Response.json({ error: { message, type: "invalid_request_error" } }, { status });
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return jsonError(405, "Method not allowed");
  try {
    const body = await request.json() as SpeechRequest;
    const audio = await synthesize(body);
    return new Response(audio.data as BodyInit, {
      headers: { "Content-Type": audio.type, "Cache-Control": "no-store" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(400, message);
  }
};
