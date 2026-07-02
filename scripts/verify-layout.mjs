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
