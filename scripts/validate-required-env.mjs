import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ENVIRONMENT_VARIABLES = ["DATABASE_URL"];

export function validateRequiredEnvironment(environment = process.env) {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => !String(environment[name] ?? "").trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable: ${missing.join(", ")}. ` +
        "Configure it before deploying."
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  validateRequiredEnvironment();
}
