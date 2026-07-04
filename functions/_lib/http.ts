import type { JsonObject } from './types.js';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function jsonError(message: string, status = 400, details?: unknown): Response {
  return json(
    {
      error: message,
      ...(details ? { details } : {})
    },
    { status }
  );
}

export async function readJson(request: Request, maxBytes = 8192): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > maxBytes) {
    throw new HttpError('Request body is too large', 413);
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError('Expected a JSON request body', 400);
  }
}

export async function readJsonObject(request: Request, maxBytes = 8192): Promise<JsonObject> {
  const body = await readJson(request, maxBytes);
  if (!isJsonObject(body)) {
    throw new HttpError('Expected a JSON object request body', 400);
  }

  return body;
}

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status, error.details);
  }

  console.error(error);
  return jsonError('Unexpected server error', 500);
}

export function redirect(location: string, headers = new Headers()): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('location', location);
  return new Response(null, {
    status: 302,
    headers: responseHeaders
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
