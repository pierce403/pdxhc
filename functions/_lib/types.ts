export type AppEnv = Env;
export type AppContext<P extends string = any> = EventContext<AppEnv, P, Record<string, unknown>>;
export type JsonObject = Record<string, unknown>;

export interface AppSession {
  id: string;
  did: string;
  expires_at: number;
}

export interface NewAppSession {
  id: string;
  did: string;
  expiresAt: number;
}

export interface BlueskyProfile {
  handle?: string;
  displayName?: string;
  avatar?: string;
  banner?: string;
  description?: string;
}

export interface Profile {
  did: string;
  handle: string;
  display_name: string;
  avatar_url: string;
  banner_url: string;
  headline: string;
  location: string;
  availability: string;
  skills: string[];
  website: string;
  linkedin_url: string;
  bio: string;
  created_at: number | null;
  updated_at: number | null;
}

export interface DirectoryProfile extends Omit<Profile, 'created_at'> {}

export interface SkillEndorsement {
  skill: string;
  skill_key: string;
  count: number;
  endorsed_by_viewer: boolean;
}

export interface TimelineEvent {
  id: string;
  type: string;
  skill: string;
  message: string;
  created_at: number | null;
  actor: {
    did: string;
    handle: string;
    display_name: string;
    avatar_url: string;
  };
}

export interface PublicProfile extends Profile {
  skill_endorsements: SkillEndorsement[];
  timeline: TimelineEvent[];
}

