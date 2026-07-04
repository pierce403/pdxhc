import { createOAuthClient } from '../../../_lib/oauth.js';
import { handleError, HttpError, json, readJsonObject } from '../../../_lib/http.js';
import type { AppEnv } from '../../../_lib/types.js';

export const onRequestPost: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const body = await readJsonObject(request);
    const handle = normalizeHandle(body.handle);
    const returnTo = safeReturnTo(body.returnTo, '/?auth=success#profile');

    const client = createOAuthClient(env);
    const url = await client.authorize(handle, {
      state: JSON.stringify({ returnTo })
    });

    return json({ url: url.toString() });
  } catch (error) {
    return handleError(error);
  }
};

function normalizeHandle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError('Bluesky handle is required', 422);
  }

  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!handle || handle.length > 253 || !handle.includes('.')) {
    throw new HttpError('Enter a valid Bluesky handle', 422);
  }

  return handle;
}

function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
