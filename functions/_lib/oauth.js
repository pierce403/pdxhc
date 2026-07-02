import { Agent } from '@atproto/api';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { createD1RequestLock, createJsonStore } from './data.js';

export function getPublicOrigin(env) {
  return (env.PUBLIC_ORIGIN || 'https://pdxhc.org').replace(/\/+$/, '');
}

export function getClientMetadata(env) {
  const origin = getPublicOrigin(env);

  return {
    client_id: `${origin}/oauth/client-metadata.json`,
    client_name: 'Portland Hacker Collective',
    client_uri: origin,
    logo_uri: `${origin}/og-card.png`,
    redirect_uris: [`${origin}/api/auth/bluesky/callback`],
    scope: 'atproto',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true
  };
}

export function createOAuthClient(env) {
  return new NodeOAuthClient({
    clientMetadata: getClientMetadata(env),
    stateStore: createJsonStore(env.DB, 'oauth_states', { ttlSeconds: 10 * 60 }),
    sessionStore: createJsonStore(env.DB, 'oauth_sessions'),
    requestLock: createD1RequestLock(env.DB),
    didResolver: createWorkersDidResolver(),
    handleResolver: 'https://bsky.social',
    fetch: fetchWithoutRedirects
  });
}

export async function getBlueskyProfile(session) {
  const agent = new Agent(session);
  const actor = session.did;

  if (!actor) {
    return {};
  }

  const response = await agent.getProfile({ actor });
  return response.data || {};
}

function createWorkersDidResolver() {
  return {
    async resolve(did, options = {}) {
      const url = didToDocumentUrl(did);
      const response = await fetchWithoutRedirects(url, {
        redirect: 'error',
        headers: {
          accept: 'application/did+ld+json, application/json'
        },
        signal: options.signal
      });

      if (!response.ok) {
        response.body?.cancel?.();
        throw new Error(`Unable to resolve DID ${did}: ${response.status}`);
      }

      const document = await response.json();
      if (!document || document.id !== did) {
        throw new Error(`Resolved DID document does not match ${did}`);
      }

      return document;
    }
  };
}

function didToDocumentUrl(did) {
  if (did.startsWith('did:plc:')) {
    return `https://plc.directory/${encodeURIComponent(did)}`;
  }

  if (!did.startsWith('did:web:')) {
    throw new Error(`Unsupported DID method for ${did}`);
  }

  const parts = did.slice('did:web:'.length).split(':');
  const host = parts.shift()?.replaceAll('%3A', ':');
  if (!host) {
    throw new Error(`Invalid did:web identifier: ${did}`);
  }

  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  if (parts.length === 0) {
    return `${protocol}://${host}/.well-known/did.json`;
  }

  return `${protocol}://${host}/${parts.join('/')}/did.json`;
}

async function fetchWithoutRedirects(input, init = {}) {
  if (init.redirect !== 'error') {
    return globalThis.fetch(input, init);
  }

  const response = await globalThis.fetch(input, {
    ...init,
    redirect: 'manual'
  });

  if (response.status >= 300 && response.status < 400) {
    response.body?.cancel?.();
    throw new TypeError(`Redirect rejected for ${new URL(input instanceof Request ? input.url : input).origin}`);
  }

  return response;
}
