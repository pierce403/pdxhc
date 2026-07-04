<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
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
  'Get discovered by businesses looking for your kind of work'
];

const currentPath = ref(window.location.pathname);
const sessionLoading = ref(true);
const authHandle = ref('');
const authLoading = ref(false);
const authError = ref('');
const authNotice = ref('');
const saveLoading = ref(false);
const saveNotice = ref('');
const saveError = ref('');
const syncLoading = ref(false);
const syncNotice = ref('');
const syncError = ref('');
const copiedProfileLink = ref(false);
const profile = ref(null);
const publicProfile = ref(null);
const publicProfileLoading = ref(false);
const publicProfileError = ref('');
const skillsText = ref('');
const directoryProfiles = ref([]);
const directoryQuery = ref('');
const directoryLoading = ref(true);
const directoryError = ref('');
let directorySearchTimer;
let copyTimer;

const profileForm = reactive({
  display_name: '',
  headline: '',
  location: 'Portland, OR',
  availability: '',
  website: '',
  linkedin_url: '',
  bio: ''
});

const routeName = computed(() => {
  if (currentPath.value.startsWith('/u/')) {
    return 'publicProfile';
  }

  if (currentPath.value === '/account') {
    return 'account';
  }

  return 'home';
});

const publicProfileDid = computed(() => {
  if (!currentPath.value.startsWith('/u/')) {
    return '';
  }

  return safeDecode(currentPath.value.slice('/u/'.length));
});

const isAuthenticated = computed(() => Boolean(profile.value?.did));
const ownProfilePath = computed(() => (profile.value?.did ? publicProfilePath(profile.value) : ''));
const ownProfileUrl = computed(() =>
  ownProfilePath.value ? `${window.location.origin}${ownProfilePath.value}` : ''
);
const authNavName = computed(() => {
  if (!profile.value) {
    return 'Bluesky';
  }

  return profileName(profile.value);
});
const authNavStatus = computed(() => {
  if (sessionLoading.value) {
    return 'Checking';
  }

  return isAuthenticated.value ? 'Signed in' : 'Log in';
});
const authNavLabel = computed(() =>
  isAuthenticated.value ? `Signed in as ${authNavName.value}` : 'Log in with Bluesky'
);
const isOwnPublicProfile = computed(
  () => Boolean(profile.value?.did && publicProfile.value?.did && profile.value.did === publicProfile.value.did)
);
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
  window.addEventListener('popstate', handlePopState);
  await Promise.all([loadSession(), loadDirectory()]);
  await handleRouteLoad();
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
  window.clearTimeout(directorySearchTimer);
  window.clearTimeout(copyTimer);
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
        returnTo: '/account?auth=success'
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
    if (publicProfile.value?.did === data.profile.did) {
      publicProfile.value = data.profile;
    }
    saveNotice.value = 'Profile saved';
    await loadDirectory();
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Unable to save profile';
  } finally {
    saveLoading.value = false;
  }
}

async function syncBlueskyProfile() {
  syncError.value = '';
  syncNotice.value = '';
  syncLoading.value = true;

  try {
    const response = await fetch('/api/profile/sync-bluesky', {
      method: 'POST',
      headers: { accept: 'application/json' }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.profile) {
      throw new Error(data.error || 'Unable to sync Bluesky profile');
    }

    applyProfile(data.profile);
    if (publicProfile.value?.did === data.profile.did) {
      publicProfile.value = data.profile;
    }
    syncNotice.value = 'Bluesky profile synced';
    await loadDirectory();
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'Unable to sync Bluesky profile';
  } finally {
    syncLoading.value = false;
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

async function loadPublicProfile(did) {
  publicProfileLoading.value = true;
  publicProfileError.value = '';
  publicProfile.value = null;

  try {
    const response = await fetch(`/api/profiles/${encodeURIComponent(did)}`, {
      headers: { accept: 'application/json' }
    });

    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Profile data is unavailable right now');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.profile) {
      throw new Error(data.error || 'Profile not found');
    }

    publicProfile.value = data.profile;
  } catch (error) {
    publicProfileError.value = error instanceof Error ? error.message : 'Profile not found';
  } finally {
    publicProfileLoading.value = false;
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
  syncNotice.value = '';
  syncError.value = '';
}

function applyProfile(nextProfile) {
  profile.value = nextProfile;
  profileForm.display_name = nextProfile.display_name || '';
  profileForm.headline = nextProfile.headline || '';
  profileForm.location = nextProfile.location || 'Portland, OR';
  profileForm.availability = nextProfile.availability || '';
  profileForm.website = nextProfile.website || '';
  profileForm.linkedin_url = nextProfile.linkedin_url || '';
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
    currentPath.value = window.location.pathname;
  }
}

function handlePopState() {
  currentPath.value = window.location.pathname;
  void handleRouteLoad();
}

async function handleRouteLoad() {
  if (routeName.value === 'publicProfile' && publicProfileDid.value) {
    await loadPublicProfile(publicProfileDid.value);
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }

  publicProfile.value = null;
  publicProfileError.value = '';
  publicProfileLoading.value = false;
}

function navigate(path) {
  window.history.pushState(null, '', path);
  currentPath.value = window.location.pathname;
  void handleRouteLoad();

  if (!path.includes('#')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function navigateHomeSection(hash) {
  window.history.pushState(null, '', `/${hash}`);
  currentPath.value = window.location.pathname;
  void handleRouteLoad();
  requestAnimationFrame(() => {
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  });
}

async function copyOwnProfileLink() {
  if (!ownProfileUrl.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(ownProfileUrl.value);
    copiedProfileLink.value = true;
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copiedProfileLink.value = false;
    }, 1800);
  } catch {
    saveError.value = 'Profile link could not be copied';
  }
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
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

function publicProfilePath(directoryProfile) {
  return directoryProfile?.did ? `/u/${directoryProfile.did}` : '/';
}

function blueskyProfileUrl(directoryProfile) {
  return directoryProfile?.handle ? `https://bsky.app/profile/${directoryProfile.handle}` : '';
}

function profileCoverStyle(profileLike) {
  if (!profileLike?.banner_url) {
    return {};
  }

  try {
    const url = new URL(profileLike.banner_url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {};
    }

    return { '--cover-image': `url("${url.href}")` };
  } catch {
    return {};
  }
}
</script>

<template>
  <main>
    <template v-if="routeName === 'home'">
      <section class="hero" :style="{ '--hero-image': `url(${heroUrl})` }">
        <nav class="topbar" aria-label="Primary navigation">
          <a class="brand" href="/" aria-label="Portland Hacker Collective home" @click.prevent="navigate('/')">
            <span class="brand-mark">PHC</span>
            <span>Portland Hacker Collective</span>
          </a>
          <div class="nav-links">
            <a href="#businesses" @click.prevent="navigateHomeSection('#businesses')">Businesses</a>
            <a href="#hackers" @click.prevent="navigateHomeSection('#hackers')">Hackers</a>
            <a href="#profile" @click.prevent="navigateHomeSection('#profile')">Profile</a>
            <a href="#directory" @click.prevent="navigateHomeSection('#directory')">Directory</a>
          </div>
          <a
            class="nav-auth-button"
            :class="{ authenticated: isAuthenticated }"
            href="/account"
            :aria-label="authNavLabel"
            @click.prevent="navigate('/account')"
          >
            <img
              v-if="isAuthenticated && profile.avatar_url"
              class="nav-auth-avatar"
              :src="profile.avatar_url"
              alt=""
              width="28"
              height="28"
            />
            <span v-else class="nav-auth-icon">
              <LoaderCircle v-if="sessionLoading" class="spinner" :size="17" aria-hidden="true" />
              <UserRound v-else-if="isAuthenticated" :size="17" aria-hidden="true" />
              <LogIn v-else :size="17" aria-hidden="true" />
            </span>
            <span class="nav-auth-copy">
              <span class="nav-auth-status">{{ authNavStatus }}</span>
              <span class="nav-auth-name">{{ authNavName }}</span>
            </span>
          </a>
        </nav>

        <div id="top" class="hero-content">
          <p class="eyebrow">Local hackers. Local contracts. Practical delivery.</p>
          <h1>Portland Hacker Collective</h1>
          <p class="hero-copy">
            A Portland-first directory for short-term technical work, connecting nearby businesses with hackers who can ship, repair, automate, secure, and explain.
          </p>
          <div class="hero-actions" aria-label="Primary actions">
            <a class="button primary" href="/account" @click.prevent="navigate('/account')">
              <UserRoundPlus :size="19" aria-hidden="true" />
              Join as a hacker
            </a>
            <a class="button secondary" href="#directory" @click.prevent="navigateHomeSection('#directory')">
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
          <p class="section-kicker">Local technical directory</p>
          <h2>One place for trusted technical capacity nearby.</h2>
        </div>
        <p>
          Hackers can publish Bluesky-backed profiles with specialties, availability, links, and preferred contract shape. Businesses can search the directory and start focused conversations with people who understand the local context.
        </p>
      </section>

      <section class="account-section" id="profile">
        <div class="section-heading account-heading">
          <p class="section-kicker">Hacker profiles</p>
          <h2>Create or update your local contract profile.</h2>
          <p>
            Profiles combine a verified Bluesky identity with the details local businesses need: availability, skills, location, links, and working style.
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

          <div v-else class="signed-in-card">
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
            <p v-if="syncNotice" class="status success">{{ syncNotice }}</p>
            <p v-if="syncError" class="status error">{{ syncError }}</p>

            <div class="signed-in-actions">
              <a class="button primary" href="/account" @click.prevent="navigate('/account')">
                <Pencil :size="18" aria-hidden="true" />
                Edit profile
              </a>
              <a class="button profile-link" :href="ownProfilePath" @click.prevent="navigate(ownProfilePath)">
                <UserRound :size="18" aria-hidden="true" />
                View public profile
              </a>
              <button class="button profile-link" type="button" :disabled="syncLoading" @click="syncBlueskyProfile">
                <LoaderCircle v-if="syncLoading" class="spinner" :size="18" aria-hidden="true" />
                <RefreshCw v-else :size="18" aria-hidden="true" />
                Sync Bluesky
              </button>
            </div>
          </div>
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

            <div class="directory-card-actions">
              <a class="button profile-link" :href="publicProfilePath(person)" @click.prevent="navigate(publicProfilePath(person))">
                <UserRound :size="16" aria-hidden="true" />
                View profile
              </a>
              <a
                v-if="person.linkedin_url"
                class="button profile-link"
                :href="person.linkedin_url"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
                <ExternalLink :size="16" aria-hidden="true" />
              </a>
              <a
                v-if="person.website"
                class="button profile-link"
                :href="person.website"
                target="_blank"
                rel="noreferrer"
              >
                Website
                <ExternalLink :size="16" aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
      </section>

      <section class="cta-band">
        <div>
          <p class="section-kicker">Portland technical help</p>
          <h2>Profiles are live for local hackers and the businesses looking for them.</h2>
        </div>
        <a class="button primary" href="mailto:hello@pdxhc.org">
          <BriefcaseBusiness :size="19" aria-hidden="true" />
          Start a conversation
          <ArrowRight :size="18" aria-hidden="true" />
        </a>
      </section>
    </template>

    <template v-else-if="routeName === 'account'">
      <nav class="topbar app-topbar" aria-label="Primary navigation">
        <a class="brand" href="/" aria-label="Portland Hacker Collective home" @click.prevent="navigate('/')">
          <span class="brand-mark">PHC</span>
          <span>Portland Hacker Collective</span>
        </a>
        <div class="nav-links">
          <a href="/#directory" @click.prevent="navigateHomeSection('#directory')">Directory</a>
          <a href="/#businesses" @click.prevent="navigateHomeSection('#businesses')">Businesses</a>
        </div>
        <a
          class="nav-auth-button"
          :class="{ authenticated: isAuthenticated }"
          href="/account"
          :aria-label="authNavLabel"
          @click.prevent="navigate('/account')"
        >
          <img
            v-if="isAuthenticated && profile.avatar_url"
            class="nav-auth-avatar"
            :src="profile.avatar_url"
            alt=""
            width="28"
            height="28"
          />
          <span v-else class="nav-auth-icon">
            <LoaderCircle v-if="sessionLoading" class="spinner" :size="17" aria-hidden="true" />
            <UserRound v-else-if="isAuthenticated" :size="17" aria-hidden="true" />
            <LogIn v-else :size="17" aria-hidden="true" />
          </span>
          <span class="nav-auth-copy">
            <span class="nav-auth-status">{{ authNavStatus }}</span>
            <span class="nav-auth-name">{{ authNavName }}</span>
          </span>
        </a>
      </nav>

      <section class="page-shell account-page">
        <div class="page-heading">
          <p class="section-kicker">Your PDXHC account</p>
          <h1>Keep your local contract profile ready.</h1>
          <p>
            Show business owners the details they need to contact you: identity, headline, availability, skills, and links.
          </p>
        </div>

        <div v-if="sessionLoading" class="page-state">
          <LoaderCircle class="spinner" :size="24" aria-hidden="true" />
          <span>Checking session</span>
        </div>

        <form v-else-if="!isAuthenticated" class="account-panel account-login" @submit.prevent="startBlueskyLogin">
          <div class="login-title">
            <span class="login-icon"><AtSign :size="21" aria-hidden="true" /></span>
            <div>
              <h3>Bluesky sign in</h3>
              <p>Use your Bluesky handle to create or edit your Portland Hacker Collective profile.</p>
            </div>
          </div>

          <label class="field" for="account-bluesky-handle">
            <span>Bluesky handle</span>
            <input
              id="account-bluesky-handle"
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

        <form v-else class="account-editor" @submit.prevent="saveProfile">
          <article class="profile-hero-card">
            <div class="profile-cover" :style="profileCoverStyle(profile)"></div>
            <div class="profile-hero-body">
              <img
                v-if="profile.avatar_url"
                class="profile-large-avatar"
                :src="profile.avatar_url"
                alt=""
                width="112"
                height="112"
              />
              <span v-else class="profile-large-avatar avatar-fallback">
                <AtSign :size="36" aria-hidden="true" />
              </span>

              <div class="profile-hero-copy">
                <p class="editor-kicker">Signed in as @{{ profile.handle || profile.did }}</p>
                <h2>{{ profile.display_name || profile.handle || 'Hacker profile' }}</h2>
                <p>{{ profile.headline || 'Add a concise headline for the kind of local work you want.' }}</p>
                <div class="profile-meta-row">
                  <span><MapPin :size="16" aria-hidden="true" /> {{ profile.location || 'Portland metro' }}</span>
                  <span>{{ profile.availability || 'Availability open' }}</span>
                </div>
              </div>

              <div class="profile-action-row">
                <button class="button profile-link" type="button" :disabled="syncLoading" @click="syncBlueskyProfile">
                  <LoaderCircle v-if="syncLoading" class="spinner" :size="18" aria-hidden="true" />
                  <RefreshCw v-else :size="18" aria-hidden="true" />
                  Sync Bluesky
                </button>
                <a class="button profile-link" :href="ownProfilePath" @click.prevent="navigate(ownProfilePath)">
                  <UserRound :size="18" aria-hidden="true" />
                  View public
                </a>
                <button class="icon-button" type="button" :title="copiedProfileLink ? 'Copied' : 'Copy public profile link'" :aria-label="copiedProfileLink ? 'Copied public profile link' : 'Copy public profile link'" @click="copyOwnProfileLink">
                  <Copy :size="19" aria-hidden="true" />
                </button>
                <button class="icon-button" type="button" title="Sign out" aria-label="Sign out" @click="logout">
                  <LogOut :size="20" aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>

          <div class="editor-status" aria-live="polite">
            <p v-if="authNotice" class="status success">{{ authNotice }}</p>
            <p v-if="saveNotice" class="status success">{{ saveNotice }}</p>
            <p v-if="syncNotice" class="status success">{{ syncNotice }}</p>
            <p v-if="copiedProfileLink" class="status success">Profile link copied</p>
            <p v-if="saveError" class="status error">{{ saveError }}</p>
            <p v-if="syncError" class="status error">{{ syncError }}</p>
          </div>

          <div class="editor-layout">
            <div class="editor-main">
              <section class="editor-panel">
                <div class="panel-title">
                  <UserRound :size="20" aria-hidden="true" />
                  <h3>Intro</h3>
                </div>
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
                </div>
              </section>

              <section class="editor-panel">
                <div class="panel-title">
                  <BadgeCheck :size="20" aria-hidden="true" />
                  <h3>About and skills</h3>
                </div>
                <label class="field wide" for="skills">
                  <span>Skills</span>
                  <input id="skills" v-model="skillsText" type="text" placeholder="Vue, Workers, AppSec, hardware debugging" />
                </label>

                <label class="field wide" for="bio">
                  <span>Profile bio</span>
                  <textarea id="bio" v-model="profileForm.bio" rows="5" placeholder="What kind of work should local business owners bring you?"></textarea>
                </label>
              </section>
            </div>

            <aside class="editor-side">
              <section class="editor-panel">
                <div class="panel-title">
                  <Link2 :size="20" aria-hidden="true" />
                  <h3>Links</h3>
                </div>

                <label class="field wide" for="website">
                  <span>Website</span>
                  <span class="input-with-icon">
                    <Globe2 :size="18" aria-hidden="true" />
                    <input id="website" v-model="profileForm.website" type="url" autocomplete="url" placeholder="https://example.com" />
                  </span>
                </label>

                <label class="field wide" for="linkedin-url">
                  <span>LinkedIn</span>
                  <span class="input-with-icon">
                    <Link2 :size="18" aria-hidden="true" />
                    <input id="linkedin-url" v-model="profileForm.linkedin_url" type="url" autocomplete="url" placeholder="https://www.linkedin.com/in/yourname" />
                  </span>
                </label>

                <div class="public-url-box">
                  <span>Public profile</span>
                  <a :href="ownProfilePath" @click.prevent="navigate(ownProfilePath)">{{ ownProfileUrl }}</a>
                </div>
              </section>

              <section class="editor-panel compact-panel">
                <div class="panel-title">
                  <AtSign :size="20" aria-hidden="true" />
                  <h3>Bluesky identity</h3>
                </div>
                <p class="side-copy">@{{ profile.handle || profile.did }}</p>
                <a
                  v-if="blueskyProfileUrl(profile)"
                  class="button profile-link"
                  :href="blueskyProfileUrl(profile)"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Bluesky
                  <ExternalLink :size="16" aria-hidden="true" />
                </a>
              </section>
            </aside>
          </div>

          <div class="form-actions editor-save-row">
            <div class="form-status" aria-live="polite"></div>
            <button class="button primary" type="submit" :disabled="saveLoading">
              <LoaderCircle v-if="saveLoading" class="spinner" :size="18" aria-hidden="true" />
              <Save v-else :size="18" aria-hidden="true" />
              Save profile
            </button>
          </div>
        </form>
      </section>
    </template>

    <template v-else>
      <nav class="topbar app-topbar" aria-label="Primary navigation">
        <a class="brand" href="/" aria-label="Portland Hacker Collective home" @click.prevent="navigate('/')">
          <span class="brand-mark">PHC</span>
          <span>Portland Hacker Collective</span>
        </a>
        <div class="nav-links">
          <a href="/#directory" @click.prevent="navigateHomeSection('#directory')">Directory</a>
        </div>
        <a
          class="nav-auth-button"
          :class="{ authenticated: isAuthenticated }"
          href="/account"
          :aria-label="authNavLabel"
          @click.prevent="navigate('/account')"
        >
          <img
            v-if="isAuthenticated && profile.avatar_url"
            class="nav-auth-avatar"
            :src="profile.avatar_url"
            alt=""
            width="28"
            height="28"
          />
          <span v-else class="nav-auth-icon">
            <LoaderCircle v-if="sessionLoading" class="spinner" :size="17" aria-hidden="true" />
            <UserRound v-else-if="isAuthenticated" :size="17" aria-hidden="true" />
            <LogIn v-else :size="17" aria-hidden="true" />
          </span>
          <span class="nav-auth-copy">
            <span class="nav-auth-status">{{ authNavStatus }}</span>
            <span class="nav-auth-name">{{ authNavName }}</span>
          </span>
        </a>
      </nav>

      <section class="page-shell public-page">
        <div v-if="publicProfileLoading" class="page-state">
          <LoaderCircle class="spinner" :size="24" aria-hidden="true" />
          <span>Loading profile</span>
        </div>

        <div v-else-if="publicProfileError" class="page-state error-state">
          <UserRound :size="28" aria-hidden="true" />
          <span>{{ publicProfileError }}</span>
          <a class="button profile-link" href="/#directory" @click.prevent="navigateHomeSection('#directory')">Back to directory</a>
        </div>

        <article v-else-if="publicProfile" class="public-profile">
          <section class="profile-hero-card public-profile-card">
            <div class="profile-cover" :style="profileCoverStyle(publicProfile)"></div>
            <div class="profile-hero-body">
              <img
                v-if="publicProfile.avatar_url"
                class="profile-large-avatar"
                :src="publicProfile.avatar_url"
                alt=""
                width="112"
                height="112"
              />
              <span v-else class="profile-large-avatar avatar-fallback">
                <AtSign :size="36" aria-hidden="true" />
              </span>

              <div class="profile-hero-copy">
                <p class="editor-kicker">@{{ publicProfile.handle || publicProfile.did }}</p>
                <h1>{{ profileName(publicProfile) }}</h1>
                <p>{{ publicProfile.headline || 'Available for short local technical contracts.' }}</p>
                <div class="profile-meta-row">
                  <span><MapPin :size="16" aria-hidden="true" /> {{ publicProfile.location || 'Portland metro' }}</span>
                  <span>{{ publicProfile.availability || 'Availability open' }}</span>
                </div>
              </div>

              <div class="profile-action-row">
                <a
                  v-if="publicProfile.website"
                  class="button profile-link"
                  :href="publicProfile.website"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe2 :size="17" aria-hidden="true" />
                  Website
                </a>
                <a
                  v-if="publicProfile.linkedin_url"
                  class="button profile-link"
                  :href="publicProfile.linkedin_url"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link2 :size="17" aria-hidden="true" />
                  LinkedIn
                </a>
                <a
                  v-if="blueskyProfileUrl(publicProfile)"
                  class="button profile-link"
                  :href="blueskyProfileUrl(publicProfile)"
                  target="_blank"
                  rel="noreferrer"
                >
                  <AtSign :size="17" aria-hidden="true" />
                  Bluesky
                </a>
                <a v-if="isOwnPublicProfile" class="button primary" href="/account" @click.prevent="navigate('/account')">
                  <Pencil :size="17" aria-hidden="true" />
                  Edit profile
                </a>
              </div>
            </div>
          </section>

          <div class="profile-details-grid">
            <section class="editor-panel">
              <div class="panel-title">
                <UserRound :size="20" aria-hidden="true" />
                <h2>About</h2>
              </div>
              <p class="detail-copy">
                {{ publicProfile.bio || 'This profile does not have a bio yet.' }}
              </p>
            </section>

            <section class="editor-panel">
              <div class="panel-title">
                <BadgeCheck :size="20" aria-hidden="true" />
                <h2>Skills</h2>
              </div>
              <div v-if="publicProfile.skills.length" class="tag-row">
                <span v-for="skill in publicProfile.skills" :key="`${publicProfile.did}-${skill}`">{{ skill }}</span>
              </div>
              <p v-else class="detail-copy">No skills listed yet.</p>
            </section>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>
