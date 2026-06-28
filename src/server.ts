import { BaseloadConfigStore, type StoredBaseloadConfig, type StoredBaseloadConfigSummary } from "./configStore";
import { normalizeBaseloadConfig } from "./baseloadConfig";
import { type BaseloadRuntime, type BaseloadState } from "./baseloadRuntime";

export interface BaseloadServerOptions {
  port?: number;
  hostname?: string;
  baseloadRuntime: BaseloadRuntime;
  configStore: BaseloadConfigStore;
  baseloadAdminBearerToken?: string;
}

export interface BaseloadConfigsResponseBody {
  configs: StoredBaseloadConfigSummary[];
}

export type BaseloadConfigResponseBody = StoredBaseloadConfig;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};

export function createBaseloadServer(options: BaseloadServerOptions) {
  const serveOptions: { port: number; fetch: (request: Request) => Promise<Response>; hostname?: string } = {
    port: options.port ?? 0,
    fetch: (request) => handleRequest(request, options)
  };
  if (options.hostname !== undefined) {
    serveOptions.hostname = options.hostname;
  }
  return Bun.serve(serveOptions);
}

export async function handleRequest(
  request: Request,
  options: BaseloadServerOptions
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (url.pathname === "/health") {
    return jsonResponse({
      ok: true,
      serverTimeUtc: new Date().toISOString(),
      baseload: options.baseloadRuntime.getState()
    });
  }

  if (url.pathname === "/admin/verify") {
    return handleAdminVerifyRequest(request, options.baseloadAdminBearerToken);
  }

  if (url.pathname === "/baseload") {
    return handleBaseloadRequest(request, options.baseloadRuntime, options.baseloadAdminBearerToken);
  }

  if (url.pathname === "/baseload/configs" || url.pathname.startsWith("/baseload/configs/")) {
    return handleBaseloadConfigsRequest(
      request,
      url,
      options.configStore,
      options.baseloadRuntime,
      options.baseloadAdminBearerToken
    );
  }

  return jsonError(404, `Not found: ${url.pathname}`);
}

async function handleBaseloadRequest(
  request: Request,
  baseloadRuntime: BaseloadRuntime,
  adminBearerToken: string | undefined
): Promise<Response> {
  if (request.method === "GET") {
    return jsonResponse(baseloadRuntime.getState() satisfies BaseloadState);
  }

  if (request.method === "PUT") {
    const authError = requireAdminBearerToken(request, adminBearerToken);
    if (authError) return authError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Request body must be valid JSON");
    }

    try {
      return jsonResponse(baseloadRuntime.updateConfig(body) satisfies BaseloadState);
    } catch (error) {
      return jsonError(400, error instanceof Error ? error.message : String(error));
    }
  }

  return jsonError(405, `Method ${request.method} is not allowed`);
}

async function handleBaseloadConfigsRequest(
  request: Request,
  url: URL,
  configStore: BaseloadConfigStore,
  baseloadRuntime: BaseloadRuntime,
  adminBearerToken: string | undefined
): Promise<Response> {
  const authError = requireAdminBearerToken(request, adminBearerToken);
  if (authError) return authError;

  if (url.pathname === "/baseload/configs") {
    if (request.method !== "GET") {
      return jsonError(405, `Method ${request.method} is not allowed`);
    }
    return jsonResponse({
      configs: await configStore.list()
    } satisfies BaseloadConfigsResponseBody);
  }

  const loadMatch = url.pathname.match(/^\/baseload\/configs\/([^/]+)\/load$/);
  if (loadMatch?.[1]) {
    if (request.method !== "PUT") {
      return jsonError(405, `Method ${request.method} is not allowed`);
    }
    let name: string;
    try {
      name = parseBaseloadConfigName(loadMatch[1]);
    } catch (error) {
      return jsonError(400, error instanceof Error ? error.message : String(error));
    }
    const saved = await configStore.get(name);
    if (!saved) {
      return jsonError(404, `Baseload config ${name} was not found`);
    }
    try {
      return jsonResponse(baseloadRuntime.updateConfig(saved.config) satisfies BaseloadState);
    } catch (error) {
      return jsonError(400, error instanceof Error ? error.message : String(error));
    }
  }

  const configMatch = url.pathname.match(/^\/baseload\/configs\/([^/]+)$/);
  if (!configMatch?.[1]) {
    return jsonError(404, `Not found: ${url.pathname}`);
  }
  let name: string;
  try {
    name = parseBaseloadConfigName(configMatch[1]);
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : String(error));
  }

  if (request.method === "GET") {
    const saved = await configStore.get(name);
    if (!saved) {
      return jsonError(404, `Baseload config ${name} was not found`);
    }
    return jsonResponse(saved satisfies BaseloadConfigResponseBody);
  }

  if (request.method === "PUT") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Request body must be valid JSON");
    }

    try {
      const config = baseloadRuntime ? baseloadRuntime.normalizeConfig(body) : normalizeBaseloadConfig(body);
      return jsonResponse(await configStore.save(name, config));
    } catch (error) {
      return jsonError(400, error instanceof Error ? error.message : String(error));
    }
  }

  if (request.method === "DELETE") {
    return jsonResponse({ deleted: await configStore.delete(name) });
  }

  return jsonError(405, `Method ${request.method} is not allowed`);
}

async function handleAdminVerifyRequest(
  request: Request,
  adminBearerToken: string | undefined
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError(405, `Method ${request.method} is not allowed`);
  }
  if (!adminBearerToken) {
    return jsonError(503, "Admin bearer token is not configured on the backend");
  }
  const authError = requireAdminBearerToken(request, adminBearerToken);
  if (authError) return authError;
  return jsonResponse({ authorized: true });
}

function requireAdminBearerToken(request: Request, adminBearerToken: string | undefined): Response | null {
  if (!adminBearerToken) return null;

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return jsonError(401, "Admin bearer token is required");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return jsonError(401, "Authorization header must use Bearer token");
  }

  if (match[1] !== adminBearerToken) {
    return jsonError(403, "Admin bearer token is invalid");
  }

  return null;
}

function parseBaseloadConfigName(value: string): string {
  const decoded = decodeURIComponent(value).trim();
  if (!decoded) {
    throw new Error("Baseload config name is required");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,79}$/.test(decoded)) {
    throw new Error(
      "Baseload config name must start with a letter or number and contain only letters, numbers, spaces, dots, underscores, or hyphens"
    );
  }
  return decoded;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {})
    }
  });
}

function jsonError(status: number, message: string): Response {
  return jsonResponse({ error: message }, { status });
}
