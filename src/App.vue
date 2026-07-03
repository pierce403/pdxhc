<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ExternalLink,
  Globe2,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from '@lucide/vue';
import heroUrl from './assets/pdxhc-hero.webp';

const businessNeeds = [
  'A prototype that needs a practical technical owner',
  'An internal workflow that is stuck in spreadsheets',
  'A reliability, security, or deployment problem blocking launch'
];

const hackerValue = [
  'Keep a current profile for short local contracts',
  'Show availability, specialties, and preferred work shape',
  'Get matched with businesses that need the work you actually do'
];

const sessionLoading = ref(true);
const authHandle = ref('');
const authLoading = ref(false);
const authError = ref('');
const authNotice = ref('');
const saveLoading = ref(false);
const saveNotice = ref('');
const saveError = ref('');
const profile = ref(null);
const skillsText = ref('');
const directoryProfiles = ref([]);
const directoryQuery = ref('');
const directoryLoading = ref(true);
const directoryError = ref('');
let directorySearchTimer;

const profileForm = reactive({
  display_name: '',
  headline: '',
  location: 'Portland, OR',
  availability: '',
  website: '',
  bio: ''
});

const isAuthenticated = computed(() => Boolean(profile.value?.did));
const directorySummary = computed(() => {
  const count = directoryProfiles.value.length;
  const profileLabel = count === 1 ? 'profile' : 'profiles';
  return directoryQuery.value.trim()
    ? `${count} matching ${profileLabel}`
    : `${count} listed ${profileLabel}`;
});
const emptyDirectoryMessage = computed(() =>
  directoryQuery.value.trim() ? 'No matching profiles yet' : 'No profiles listed yet'
);

onMounted(async () => {
  readAuthRedirect();
  await Promise.all([loadSession(), loadDirectory()]);
});

async function loadSession() {
  sessionLoading.value = true;

  try {
    const response = await fetch('/api/auth/session', {
      headers: { accept: 'application/json' }
    });

    if (!response.headers.get('content-type')?.includes('application/json')) {
      return;
    }

    const data = await response.json();
    if (response.ok && data.authenticated && data.profile) {
      applyProfile(data.profile);
    }
  } catch {
    profile.value = null;
  } finally {
    sessionLoading.value = false;
  }
}

async function startBlueskyLogin() {
  authError.value = '';
  authNotice.value = '';
  authLoading.value = true;

  try {
    const response = await fetch('/api/auth/bluesky/start', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        handle: authHandle.value,
        returnTo: '/?auth=success#profile'
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      throw new Error(data.error || 'Unable to start Bluesky login');
    }

    window.location.assign(data.url);
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unable to start Bluesky login';
    authLoading.value = false;
  }
}

async function saveProfile() {
  saveError.value = '';
  saveNotice.value = '';
  saveLoading.value = true;

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        ...profileForm,
        skills: splitSkills(skillsText.value)
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.profile) {
      throw new Error(data.error || 'Unable to save profile');
    }

    applyProfile(data.profile);
    saveNotice.value = 'Profile saved';
    await loadDirectory();
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Unable to save profile';
  } finally {
    saveLoading.value = false;
  }
}

async function loadDirectory() {
  directoryLoading.value = true;
  directoryError.value = '';

  try {
    const params = new URLSearchParams();
    const query = directoryQuery.value.trim();
    if (query) {
      params.set('q', query);
    }

    const response = await fetch(`/api/directory${params.size ? `?${params}` : ''}`, {
      headers: { accept: 'application/json' }
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      directoryProfiles.value = [];
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(data.profiles)) {
      throw new Error(data.error || 'Unable to load directory');
    }

    directoryProfiles.value = data.profiles;
  } catch (error) {
    directoryError.value = error instanceof Error ? error.message : 'Unable to load directory';
  } finally {
    directoryLoading.value = false;
  }
}

function scheduleDirectorySearch() {
  window.clearTimeout(directorySearchTimer);
  directorySearchTimer = window.setTimeout(() => {
    loadDirectory();
  }, 250);
}

async function logout() {
  await fetch('/api/auth/session', {
    method: 'DELETE',
    headers: { accept: 'application/json' }
  }).catch(() => {});

  profile.value = null;
  saveNotice.value = '';
  saveError.value = '';
}

function applyProfile(nextProfile) {
  profile.value = nextProfile;
  profileForm.display_name = nextProfile.display_name || '';
  profileForm.headline = nextProfile.headline || '';
  profileForm.location = nextProfile.location || 'Portland, OR';
  profileForm.availability = nextProfile.availability || '';
  profileForm.website = nextProfile.website || '';
  profileForm.bio = nextProfile.bio || '';
  skillsText.value = Array.isArray(nextProfile.skills) ? nextProfile.skills.join(', ') : '';
}

function splitSkills(value) {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function readAuthRedirect() {
  const url = new URL(window.location.href);
  const authState = url.searchParams.get('auth');

  if (authState === 'success') {
    authNotice.value = 'Signed in with Bluesky';
  } else if (authState === 'error') {
    authError.value = 'Bluesky login did not complete';
  }

  if (authState) {
    url.searchParams.delete('auth');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

function profileName(directoryProfile) {
  return directoryProfile.display_name || directoryProfile.handle || 'Local hacker';
}

function profileSummary(directoryProfile) {
  return (
    directoryProfile.headline ||
    directoryProfile.bio ||
    'Available for short local technical contracts.'
  );
}

function profileLink(directoryProfile) {
  if (directoryProfile.website) {
    return directoryProfile.website;
  }

  if (directoryProfile.handle) {
    return `https://bsky.app/profile/${directoryProfile.handle}`;
  }

  return '';
}

function profileLinkLabel(directoryProfile) {
  return directoryProfile.website ? 'Website' : 'Bluesky';
}
</script>

<template>
  <main>
    <section class="hero" :style="{ '--hero-image': `url(${heroUrl})` }">
      <nav class="topbar" aria-label="Primary navigation">
        <a class="brand" href="#top" aria-label="Portland Hacker Collective home">
          <span class="brand-mark">PHC</span>
          <span>Portland Hacker Collective</span>
        </a>
        <div class="nav-links">
          <a href="#businesses">Businesses</a>
          <a href="#hackers">Hackers</a>
          <a href="#profile">Profile</a>
          <a href="#directory">Directory</a>
        </div>
      </nav>

      <div id="top" class="hero-content">
        <p class="eyebrow">Local hackers. Local contracts. Practical delivery.</p>
        <h1>Portland Hacker Collective</h1>
        <p class="hero-copy">
          A Portland-first directory for short-term technical work, connecting nearby businesses with hackers who can ship, repair, automate, secure, and explain.
        </p>
        <div class="hero-actions" aria-label="Primary actions">
          <a class="button primary" href="#profile">
            <UserRoundPlus :size="19" aria-hidden="true" />
            Join as a hacker
          </a>
          <a class="button secondary" href="#directory">
            <Search :size="19" aria-hidden="true" />
            Find local help
          </a>
        </div>
        <div class="signal-row" aria-label="Project signals">
          <span><MapPin :size="16" aria-hidden="true" /> Portland metro</span>
          <span><CalendarClock :size="16" aria-hidden="true" /> Short contracts</span>
          <span><ShieldCheck :size="16" aria-hidden="true" /> Bluesky login</span>
        </div>
      </div>
    </section>

    <section class="intro-band" aria-label="What this is">
      <div class="intro-copy">
        <p class="section-kicker">The directory is being built now</p>
        <h2>One place for trusted local technical capacity.</h2>
      </div>
      <p>
        Hackers can start profiles with Bluesky identity, specialties, availability, proof of work, and preferred contract shape. Business owners will browse the directory and start focused conversations with people who understand the local context.
      </p>
    </section>

    <section class="account-section" id="profile">
      <div class="section-heading account-heading">
        <p class="section-kicker">Hacker profiles</p>
        <h2>Log in with Bluesky and keep your local contract profile current.</h2>
        <p>
          Profiles start with a verified Bluesky identity and add the practical details local businesses need to scan quickly: availability, skills, location, links, and working style.
        </p>
      </div>

      <div class="account-panel">
        <div v-if="sessionLoading" class="panel-state">
          <LoaderCircle class="spinner" :size="22" aria-hidden="true" />
          <span>Checking session</span>
        </div>

        <form v-else-if="!isAuthenticated" class="login-form" @submit.prevent="startBlueskyLogin">
          <div class="login-title">
            <span class="login-icon"><AtSign :size="21" aria-hidden="true" /></span>
            <div>
              <h3>Bluesky sign in</h3>
              <p>Use your handle to create or edit a Portland Hacker Collective profile.</p>
            </div>
          </div>

          <label class="field" for="bluesky-handle">
            <span>Bluesky handle</span>
            <input
              id="bluesky-handle"
              v-model="authHandle"
              type="text"
              autocomplete="username"
              inputmode="url"
              placeholder="yourname.bsky.social"
              required
            />
          </label>

          <p v-if="authNotice" class="status success">{{ authNotice }}</p>
          <p v-if="authError" class="status error">{{ authError }}</p>

          <button class="button primary account-button" type="submit" :disabled="authLoading">
            <LoaderCircle v-if="authLoading" class="spinner" :size="18" aria-hidden="true" />
            <LogIn v-else :size="18" aria-hidden="true" />
            Continue with Bluesky
          </button>
        </form>

        <form v-else class="profile-form" @submit.prevent="saveProfile">
          <div class="profile-editor-top">
            <img
              v-if="profile.avatar_url"
              class="profile-avatar"
              :src="profile.avatar_url"
              alt=""
              width="64"
              height="64"
            />
            <span v-else class="profile-avatar avatar-fallback"><AtSign :size="24" aria-hidden="true" /></span>
            <div class="profile-editor-title">
              <p class="editor-kicker">Signed in as</p>
              <h3>{{ profile.display_name || profile.handle || 'Hacker profile' }}</h3>
              <p class="handle-line">@{{ profile.handle || profile.did }}</p>
            </div>
            <button class="icon-button" type="button" title="Sign out" aria-label="Sign out" @click="logout">
              <LogOut :size="20" aria-hidden="true" />
            </button>
          </div>

          <p v-if="authNotice" class="status success">{{ authNotice }}</p>

          <div class="form-grid">
            <label class="field" for="display-name">
              <span>Display name</span>
              <input id="display-name" v-model="profileForm.display_name" type="text" autocomplete="name" />
            </label>

            <label class="field" for="headline">
              <span>Headline</span>
              <input id="headline" v-model="profileForm.headline" type="text" placeholder="Automation, firmware, security review" />
            </label>

            <label class="field" for="location">
              <span>Location</span>
              <input id="location" v-model="profileForm.location" type="text" autocomplete="address-level2" />
            </label>

            <label class="field" for="availability">
              <span>Availability</span>
              <input id="availability" v-model="profileForm.availability" type="text" placeholder="Weekends, fractional, 2-week blocks" />
            </label>

            <label class="field wide" for="skills">
              <span>Skills</span>
              <input id="skills" v-model="skillsText" type="text" placeholder="Vue, Workers, AppSec, hardware debugging" />
            </label>

            <label class="field wide" for="website">
              <span>Website</span>
              <span class="input-with-icon">
                <Globe2 :size="18" aria-hidden="true" />
                <input id="website" v-model="profileForm.website" type="url" autocomplete="url" placeholder="https://example.com" />
              </span>
            </label>
          </div>

          <label class="field wide" for="bio">
            <span>Profile bio</span>
            <textarea id="bio" v-model="profileForm.bio" rows="5" placeholder="What kind of work should local business owners bring you?"></textarea>
          </label>

          <div class="form-actions">
            <div class="form-status" aria-live="polite">
              <p v-if="saveNotice" class="status success">{{ saveNotice }}</p>
              <p v-if="saveError" class="status error">{{ saveError }}</p>
            </div>
            <button class="button primary" type="submit" :disabled="saveLoading">
              <LoaderCircle v-if="saveLoading" class="spinner" :size="18" aria-hidden="true" />
              <Save v-else :size="18" aria-hidden="true" />
              Save profile
            </button>
          </div>
        </form>
      </div>
    </section>

    <section class="split-section" id="businesses">
      <div class="section-heading">
        <p class="section-kicker">For businesses</p>
        <h2>Find someone who can make the next technical step real.</h2>
      </div>
      <div class="check-list">
        <article v-for="need in businessNeeds" :key="need" class="check-item">
          <span class="check-icon"><Check :size="18" aria-hidden="true" /></span>
          <p>{{ need }}</p>
        </article>
      </div>
    </section>

    <section class="split-section hacker-section" id="hackers">
      <div class="section-heading">
        <p class="section-kicker">For hackers</p>
        <h2>Keep your profile ready for the work you want to take.</h2>
      </div>
      <div class="check-list">
        <article v-for="item in hackerValue" :key="item" class="check-item">
          <span class="check-icon"><BadgeCheck :size="18" aria-hidden="true" /></span>
          <p>{{ item }}</p>
        </article>
      </div>
    </section>

    <section class="directory-section" id="directory">
      <div class="directory-heading">
        <div class="section-heading">
          <p class="section-kicker">Directory</p>
          <h2>Search local hacker profiles.</h2>
        </div>

        <form class="directory-search" role="search" @submit.prevent="loadDirectory">
          <label class="search-field" for="directory-search">
            <Search :size="19" aria-hidden="true" />
            <input
              id="directory-search"
              v-model="directoryQuery"
              type="search"
              autocomplete="off"
              placeholder="Search skills, availability, handle"
              @input="scheduleDirectorySearch"
            />
          </label>
          <button class="icon-button search-submit" type="submit" title="Search directory" aria-label="Search directory">
            <Search :size="19" aria-hidden="true" />
          </button>
          <button class="icon-button" type="button" title="Refresh directory" aria-label="Refresh directory" @click="loadDirectory">
            <RefreshCw :class="{ spinner: directoryLoading }" :size="19" aria-hidden="true" />
          </button>
        </form>
      </div>

      <div class="directory-meta" aria-live="polite">
        <span>{{ directorySummary }}</span>
      </div>

      <div v-if="directoryLoading" class="directory-state">
        <LoaderCircle class="spinner" :size="22" aria-hidden="true" />
        <span>Loading directory</span>
      </div>

      <div v-else-if="directoryError" class="directory-state error-state">
        <span>{{ directoryError }}</span>
        <button class="button profile-link" type="button" @click="loadDirectory">Try again</button>
      </div>

      <div v-else-if="directoryProfiles.length === 0" class="directory-state empty-state">
        <UsersRound :size="24" aria-hidden="true" />
        <span>{{ emptyDirectoryMessage }}</span>
      </div>

      <div v-else class="directory-grid">
        <article v-for="person in directoryProfiles" :key="person.did" class="profile-card">
          <div class="directory-profile-head">
            <img
              v-if="person.avatar_url"
              class="directory-avatar"
              :src="person.avatar_url"
              alt=""
              width="48"
              height="48"
            />
            <span v-else class="directory-avatar avatar-fallback"><AtSign :size="20" aria-hidden="true" /></span>
            <div>
              <h3>{{ profileName(person) }}</h3>
              <p v-if="person.handle" class="handle-line">@{{ person.handle }}</p>
            </div>
          </div>

          <div class="profile-topline">
            <span><MapPin :size="16" aria-hidden="true" /> {{ person.location || 'Portland metro' }}</span>
            <span>{{ person.availability || 'Availability open' }}</span>
          </div>

          <p>{{ profileSummary(person) }}</p>
          <p v-if="person.headline && person.bio" class="profile-bio">{{ person.bio }}</p>

          <div v-if="person.skills.length" class="tag-row">
            <span v-for="skill in person.skills" :key="`${person.did}-${skill}`">{{ skill }}</span>
          </div>

          <a
            v-if="profileLink(person)"
            class="button profile-link"
            :href="profileLink(person)"
            target="_blank"
            rel="noreferrer"
          >
            {{ profileLinkLabel(person) }}
            <ExternalLink :size="16" aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>

    <section class="cta-band">
      <div>
        <p class="section-kicker">Now taking shape</p>
        <h2>Profiles and search are live. Directory filters and business owner flows come next.</h2>
      </div>
      <a class="button primary" href="mailto:hello@pdxhc.org">
        <BriefcaseBusiness :size="19" aria-hidden="true" />
        Start a conversation
        <ArrowRight :size="18" aria-hidden="true" />
      </a>
    </section>
  </main>
</template>
