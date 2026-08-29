import { handleInternalClassicRequest } from "@/lib/classic-service";

const LOCAL_CLASSIC_ORIGIN = "http://127.0.0.1:8000";
const SESSION_ID = "[A-Za-z0-9_-]{1,80}";
const ALLOWED_PATHS = [
  /^scenarios$/,
  /^health$/,
  /^incidents$/,
  /^transcriptions$/,
  /^training\/sessions$/,
  new RegExp(`^training\\/sessions\\/${SESSION_ID}$`),
  new RegExp(`^training\\/sessions\\/${SESSION_ID}\\/(turns|hint|finish)$`),
  new RegExp(`^incidents\\/${SESSION_ID}$`),
  new RegExp(`^incidents\\/${SESSION_ID}\\/(answers|confirm|advisor|training)$`),
];

function backendOrigin(): string | null {
  const configured = process.env.CLASSIC_API_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol)) throw new Error("CLASSIC_API_ORIGIN must use http or https");
    return url.origin;
  }
  return process.env.NODE_ENV === "development" ? LOCAL_CLASSIC_ORIGIN : null;
}

async function proxy(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  const path = (params.path || []).join("/");
  if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    return Response.json({ error: "classic_route_not_allowed" }, { status: 404 });
  }
  const origin = backendOrigin();
  if (!origin) return handleInternalClassicRequest(request, path);

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(`${origin}/api/${path}`, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(65_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8" },
    });
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? `经典训练服务连接失败：${error.message}` : "经典训练服务连接失败" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
