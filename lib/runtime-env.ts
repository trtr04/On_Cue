import { env as workerEnv } from "cloudflare:workers";

type RuntimeBindings = Record<string, unknown>;

export function runtimeEnv(name: string): string {
  const binding = (workerEnv as unknown as RuntimeBindings)[name];
  if (typeof binding === "string" && binding.trim()) return binding.trim();

  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return typeof processValue === "string" ? processValue.trim() : "";
}
