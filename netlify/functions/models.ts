import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export default (request: Request): Response => {
  try {
    const cwd = process.cwd();
    const contents = readdirSync(cwd);
    const hasModels = existsSync(join(cwd, "models"));
    const modelsContents = hasModels ? readdirSync(join(cwd, "models")) : [];
    
    return Response.json({
      cwd,
      contents,
      hasModels,
      modelsContents,
      error: null
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
