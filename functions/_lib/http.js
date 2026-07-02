export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function jsonError(message, status = 400, details) {
  return json(
    {
      error: message,
      ...(details ? { details } : {})
    },
    { status }
  );
}

export async function readJson(request, maxBytes = 8192) {
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

export class HttpError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status, error.details);
  }

  console.error(error);
  return jsonError('Unexpected server error', 500);
}

export function redirect(location, headers = new Headers()) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('location', location);
  return new Response(null, {
    status: 302,
    headers: responseHeaders
  });
}

