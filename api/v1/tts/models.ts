import { readFileSync } from "node:fs";
import { join } from "node:path";

export default {
  fetch(request: Request): Response {
    if (request.method !== "GET") {
      return Response.json({ error: { message: "Method not allowed", type: "invalid_request_error" } }, { status: 405 });
    }
    const name = readFileSync(join(process.cwd(), "models", "voice.name"), "utf8").trim();
    return Response.json({
      object: "list",
      data: [{ id: name, object: "model", owned_by: "nghitts", aliases: ["default"] }]
    });
  }
};
