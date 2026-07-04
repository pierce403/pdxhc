import { listProfiles } from '../_lib/profile.js';
import { handleError, json } from '../_lib/http.js';
import type { AppEnv } from '../_lib/types.js';

export const onRequestGet: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const profiles = await listProfiles(env, query);

    return json({
      profiles,
      count: profiles.length,
      query: query.trim()
    });
  } catch (error) {
    return handleError(error);
  }
};
