import type { IncomingMessage, ServerResponse } from "node:http";

declare const analyzeHandler: (
  req: IncomingMessage & { body?: unknown; query?: Record<string, unknown> },
  res: ServerResponse,
) => Promise<unknown>;

export default analyzeHandler;
