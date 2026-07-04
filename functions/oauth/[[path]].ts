import { json, jsonError } from '../_lib/http.js';
import { getClientMetadata } from '../_lib/oauth.js';
import type { AppEnv } from '../_lib/types.js';

export const onRequestGet: PagesFunction<AppEnv, 'path'> = async (context) => {
  const path = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : context.params.path || '';

  if (path !== 'client-metadata.json') {
    return jsonError('Not found', 404);
  }

  return json(getClientMetadata(context.env), {
    headers: {
      'cache-control': 'public, max-age=300'
    }
  });
};
