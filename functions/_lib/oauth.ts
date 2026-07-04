import {
  NodeOAuthClient,
  type NodeOAuthClientOptions,
  type NodeSavedSession,
  type NodeSavedSessionStore,
  type NodeSavedState,
  type NodeSavedStateStore,
  type OAuthSession,
  type RuntimeLock
} from '@atproto/oauth-client-node';
import { createD1RequestLock, createJsonStore } from './data.js';
import type { AppEnv, BlueskyProfile } from './types.js';

type DidResolverOption = NonNullable<NodeOAuthClientOptions['didResolver']>;
type ClientMetadataInput = NodeOAuthClientOptions['clientMetadata'];

interface DidDocument {
  id?: string;
  [key: string]: unknown;
}

export function getPublicOrigin(env: AppEnv): string {
  return (env.PUBLIC_ORIGIN || 'https://pdxhc.org').replace(/\/+$/, '');
}

export function getClientMetadata(env: AppEnv): ClientMetadataInput {
  const origin = getPublicOrigin(env) as `https://${string}`;

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

export function createOAuthClient(env: AppEnv): NodeOAuthClient {
  return new NodeOAuthClient({
    clientMetadata: getClientMetadata(env),
    stateStore: createJsonStore<NodeSavedState>(env.DB, 'oauth_states', { ttlSeconds: 10 * 60 }) as NodeSavedStateStore,
    sessionStore: createJsonStore<NodeSavedSession>(env.DB, 'oauth_sessions') as NodeSavedSessionStore,
    requestLock: createD1RequestLock(env.DB) as RuntimeLock,
    didResolver: createWorkersDidResolver() as DidResolverOption,
    handleResolver: 'https://bsky.social',
    fetch: fetchWithoutRedirects
  });
}

export async function getBlueskyProfile(sessionOrDid: string | Pick<OAuthSession, 'did'>): Promise<BlueskyProfile> {
  const actor = typeof sessionOrDid === 'string' ? sessionOrDid : sessionOrDid.did;
  if (!actor) {
    return {};
  }

  const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');
  url.searchParams.set('actor', actor);

  const response = await fetchWithoutRedirects(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    response.body?.cancel?.();
    throw new Error(`Unable to fetch Bluesky profile: ${response.status}`);
  }

  const body = await response.json();
  return isRecord(body) ? (body as BlueskyProfile) : {};
}

function createWorkersDidResolver() {
  return {
    async resolve(did: string, options: { signal?: AbortSignal } = {}) {
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
      if (!isDidDocument(document) || document.id !== did) {
        throw new Error(`Resolved DID document does not match ${did}`);
      }

      return document;
    }
  };
}

function didToDocumentUrl(did: string): string {
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

async function fetchWithoutRedirects(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (init.redirect !== 'error') {
    return globalThis.fetch(input, init);
  }

  const response = await globalThis.fetch(input, {
    ...init,
    redirect: 'manual'
  });

  if (response.status >= 300 && response.status < 400) {
    response.body?.cancel?.();
    throw new TypeError(`Redirect rejected for ${new URL(input instanceof Request ? input.url : input.toString()).origin}`);
  }

  return response;
}

function isDidDocument(value: unknown): value is DidDocument {
  return isRecord(value) && typeof value.id === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
