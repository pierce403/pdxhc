<script setup>
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundPlus,
  Wrench
} from '@lucide/vue';
import heroUrl from './assets/pdxhc-hero.webp';

const profileCards = [
  {
    name: 'Embedded systems',
    focus: 'Hardware bring-up, sensor pipelines, field debugging',
    availability: 'Fractional',
    tags: ['Firmware', 'IoT', 'Bench testing']
  },
  {
    name: 'Web operations',
    focus: 'Fast internal tools, integrations, deployment cleanup',
    availability: '2-6 week blocks',
    tags: ['Vue', 'Workers', 'Automation']
  },
  {
    name: 'Security review',
    focus: 'Threat modeling, basic hardening, incident triage',
    availability: 'Short audits',
    tags: ['AppSec', 'Cloudflare', 'Response']
  }
];

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
          <a class="button primary" href="#hackers">
            <UserRoundPlus :size="19" aria-hidden="true" />
            Join as a hacker
          </a>
          <a class="button secondary" href="#businesses">
            <Search :size="19" aria-hidden="true" />
            Find local help
          </a>
        </div>
        <div class="signal-row" aria-label="Project signals">
          <span><MapPin :size="16" aria-hidden="true" /> Portland metro</span>
          <span><CalendarClock :size="16" aria-hidden="true" /> Short contracts</span>
          <span><ShieldCheck :size="16" aria-hidden="true" /> Profiles in progress</span>
        </div>
      </div>
    </section>

    <section class="intro-band" aria-label="What this is">
      <div class="intro-copy">
        <p class="section-kicker">The directory is being built now</p>
        <h2>One place for trusted local technical capacity.</h2>
      </div>
      <p>
        Hackers will manage profiles with specialties, availability, proof of work, and preferred contract shape. Business owners will browse the directory and start focused conversations with people who understand the local context.
      </p>
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
      <div class="section-heading">
        <p class="section-kicker">Early directory preview</p>
        <h2>Profiles will be built for scanning, not résumé theater.</h2>
      </div>
      <div class="directory-grid">
        <article v-for="profile in profileCards" :key="profile.name" class="profile-card">
          <div class="profile-topline">
            <span class="profile-icon"><Wrench :size="20" aria-hidden="true" /></span>
            <span>{{ profile.availability }}</span>
          </div>
          <h3>{{ profile.name }}</h3>
          <p>{{ profile.focus }}</p>
          <div class="tag-row">
            <span v-for="tag in profile.tags" :key="tag">{{ tag }}</span>
          </div>
        </article>
      </div>
    </section>

    <section class="cta-band">
      <div>
        <p class="section-kicker">Next build target</p>
        <h2>Landing page first. Login, profiles, search, and Cloudflare-backed app paths next.</h2>
      </div>
      <a class="button primary" href="mailto:hello@pdxhc.org">
        <BriefcaseBusiness :size="19" aria-hidden="true" />
        Start a conversation
        <ArrowRight :size="18" aria-hidden="true" />
      </a>
    </section>
  </main>
</template>
