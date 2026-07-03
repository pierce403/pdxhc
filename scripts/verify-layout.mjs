import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const screenshotDir = path.join(root, 'tmp/playwright');
const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
const port = Number(process.env.VERIFY_LAYOUT_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const mockProfile = {
  did: 'did:plc:layouttest',
  handle: 'layout.bsky.social',
  display_name: 'Layout Tester',
  avatar_url: '',
  banner_url: '',
  headline: 'Cloudflare Workers, Vue, and app security',
  location: 'Portland, OR',
  availability: 'Fractional contracts',
  skills: ['Cloudflare Workers', 'Vue', 'AppSec'],
  website: 'https://example.com',
  linkedin_url: 'https://www.linkedin.com/in/layouttester',
  bio: 'Builds practical web apps, deployment pipelines, and security-minded internal tools for local teams.',
  updated_at: 1783120000
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
]);

await mkdir(screenshotDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', baseUrl);
    const requestedPath = decodeURIComponent(url.pathname);

    if (requestedPath === '/api/auth/session') {
      const isMockAuthenticated = request.headers.cookie?.includes('mock-auth=1');
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ authenticated: isMockAuthenticated, profile: isMockAuthenticated ? mockProfile : null }));
      return;
    }

    if (requestedPath === '/api/directory') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ profiles: [mockProfile] }));
      return;
    }

    if (requestedPath === `/api/profiles/${mockProfile.did}`) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ profile: mockProfile }));
      return;
    }

    const normalizedPath = requestedPath === '/' ? '/index.html' : requestedPath;
    const filePath = path.normalize(path.join(distDir, normalizedPath));

    if (!filePath.startsWith(distDir)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    let body;
    let servedPath = filePath;
    try {
      await stat(servedPath);
      body = await readFile(servedPath);
    } catch {
      servedPath = path.join(distDir, 'index.html');
      body = await readFile(servedPath);
    }

    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(servedPath)) || 'application/octet-stream'
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500);
    response.end(error instanceof Error ? error.message : 'Unknown error');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const browser = await chromium.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-gpu']
});

try {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const meta = await page.evaluate(() => {
    const read = (selector) => document.querySelector(selector)?.getAttribute('content') || null;
    return {
      title: read('meta[property="og:title"]'),
      description: read('meta[property="og:description"]'),
      url: read('meta[property="og:url"]'),
      image: read('meta[property="og:image"]'),
      imageWidth: read('meta[property="og:image:width"]'),
      imageHeight: read('meta[property="og:image:height"]'),
      twitterCard: read('meta[name="twitter:card"]')
    };
  });

  const expectedMeta = {
    title: 'Portland Hacker Collective',
    url: 'https://pdxhc.org/',
    image: 'https://pdxhc.org/og-card.png',
    imageWidth: '1200',
    imageHeight: '630',
    twitterCard: 'summary_large_image'
  };

  for (const [key, expected] of Object.entries(expectedMeta)) {
    if (meta[key] !== expected) {
      throw new Error(`Unexpected ${key}: expected "${expected}", got "${meta[key]}"`);
    }
  }

  if (!meta.description?.includes('Local hackers')) {
    throw new Error(`Unexpected Open Graph description: ${meta.description}`);
  }

  const viewports = [
    { name: 'desktop', width: 1440, height: 1100 },
    { name: 'tablet', width: 820, height: 1000 },
    { name: 'mobile', width: 390, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, `home-${viewport.name}.png`),
      fullPage: false
    });

    const layout = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.getBoundingClientRect();
      const body = document.body.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        h1Left: h1?.left ?? null,
        h1Right: h1?.right ?? null,
        bodyLeft: body.left,
        bodyRight: body.right
      };
    });

    if (layout.scrollWidth > layout.clientWidth + 1) {
      throw new Error(`${viewport.name} has horizontal overflow: ${layout.scrollWidth} > ${layout.clientWidth}`);
    }

    if (layout.h1Left === null || layout.h1Left < -1 || layout.h1Right > layout.clientWidth + 1) {
      throw new Error(`${viewport.name} H1 is outside the viewport: ${JSON.stringify(layout)}`);
    }

    await page.locator('#profile').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(screenshotDir, `profile-${viewport.name}.png`),
      fullPage: false
    });

    const profileLayout = await page.evaluate(() => {
      const panel = document.querySelector('.account-panel')?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        panelLeft: panel?.left ?? null,
        panelRight: panel?.right ?? null
      };
    });

    if (
      profileLayout.panelLeft === null ||
      profileLayout.panelLeft < -1 ||
      profileLayout.panelRight > profileLayout.clientWidth + 1
    ) {
      throw new Error(`${viewport.name} profile panel is outside the viewport: ${JSON.stringify(profileLayout)}`);
    }

    await page.locator('#directory').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(screenshotDir, `directory-${viewport.name}.png`),
      fullPage: false
    });

    const directoryLayout = await page.evaluate(() => {
      const search = document.querySelector('.directory-search')?.getBoundingClientRect();
      const grid = document.querySelector('.directory-grid, .directory-state')?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        searchLeft: search?.left ?? null,
        searchRight: search?.right ?? null,
        listingLeft: grid?.left ?? null,
        listingRight: grid?.right ?? null
      };
    });

    if (
      directoryLayout.searchLeft === null ||
      directoryLayout.searchLeft < -1 ||
      directoryLayout.searchRight > directoryLayout.clientWidth + 1 ||
      directoryLayout.listingLeft === null ||
      directoryLayout.listingLeft < -1 ||
      directoryLayout.listingRight > directoryLayout.clientWidth + 1
    ) {
      throw new Error(`${viewport.name} directory layout is outside the viewport: ${JSON.stringify(directoryLayout)}`);
    }

    await page.goto(`${baseUrl}/account`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, `account-${viewport.name}.png`),
      fullPage: false
    });

    const accountLayout = await page.evaluate(() => {
      const shell = document.querySelector('.page-shell')?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        shellLeft: shell?.left ?? null,
        shellRight: shell?.right ?? null
      };
    });

    if (
      accountLayout.shellLeft === null ||
      accountLayout.shellLeft < -1 ||
      accountLayout.shellRight > accountLayout.clientWidth + 1
    ) {
      throw new Error(`${viewport.name} account layout is outside the viewport: ${JSON.stringify(accountLayout)}`);
    }

    await page.context().addCookies([
      {
        name: 'mock-auth',
        value: '1',
        domain: '127.0.0.1',
        path: '/'
      }
    ]);
    await page.goto(`${baseUrl}/account`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, `account-auth-${viewport.name}.png`),
      fullPage: false
    });

    const editorLayout = await page.evaluate(() => {
      const hero = document.querySelector('.profile-hero-card')?.getBoundingClientRect();
      const editor = document.querySelector('.editor-layout')?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        heroLeft: hero?.left ?? null,
        heroRight: hero?.right ?? null,
        editorLeft: editor?.left ?? null,
        editorRight: editor?.right ?? null
      };
    });

    if (
      editorLayout.heroLeft === null ||
      editorLayout.heroLeft < -1 ||
      editorLayout.heroRight > editorLayout.clientWidth + 1 ||
      editorLayout.editorLeft === null ||
      editorLayout.editorLeft < -1 ||
      editorLayout.editorRight > editorLayout.clientWidth + 1
    ) {
      throw new Error(`${viewport.name} account editor layout is outside the viewport: ${JSON.stringify(editorLayout)}`);
    }

    await page.context().clearCookies();

    await page.goto(`${baseUrl}/u/${mockProfile.did}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(screenshotDir, `public-profile-${viewport.name}.png`),
      fullPage: false
    });

    const publicLayout = await page.evaluate(() => {
      const card = document.querySelector('.profile-hero-card')?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        cardLeft: card?.left ?? null,
        cardRight: card?.right ?? null
      };
    });

    if (
      publicLayout.cardLeft === null ||
      publicLayout.cardLeft < -1 ||
      publicLayout.cardRight > publicLayout.clientWidth + 1
    ) {
      throw new Error(`${viewport.name} public profile layout is outside the viewport: ${JSON.stringify(publicLayout)}`);
    }
  }

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`${baseUrl}/og-card.png`, { waitUntil: 'load' });
  const ogSize = await page.locator('img').evaluate((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight
  }));

  if (ogSize.width !== 1200 || ogSize.height !== 630) {
    throw new Error(`Unexpected OG image size: ${ogSize.width}x${ogSize.height}`);
  }

  await page.screenshot({
    path: path.join(screenshotDir, 'og-card.png'),
    fullPage: false
  });

  console.log(`Verified layout screenshots in ${path.relative(root, screenshotDir)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
