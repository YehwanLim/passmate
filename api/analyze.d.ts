import type { IncomingMessage, ServerResponse } from "node:http";

declare const analyzeHandler: (
  req: IncomingMessage & { body?: unknown; query?: Record<string, unknown> },
  res: ServerResponse,
) => Promise<unknown>;

export default analyzeHandler;

export declare function createAnalyzeHandler(options?: Record<string, unknown>): typeof analyzeHandler;
export declare function createCompanyAnalyzeHandler(options?: Record<string, unknown>): typeof analyzeHandler;
export declare function selectAnalyzeHandler<T>(
  query: Record<string, unknown> | undefined,
  handlers: { company: T; resume: T; split: T },
): T;
