import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const heroPath = path.join(root, 'src/assets/pdxhc-hero.webp');
const outputPath = path.join(root, 'public/og-card.png');
const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';

const hero = await readFile(heroPath);
const heroDataUrl = `data:image/webp;base64,${hero.toString('base64')}`;

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-gpu']
});

const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1
});

await page.setContent(
  `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        :root {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #fffdf8;
          background: #0a120f;
        }

        * {
          box-sizing: border-box;
        }

        body {
          width: 1200px;
          height: 630px;
          margin: 0;
          overflow: hidden;
        }

        .card {
          position: relative;
          width: 1200px;
          height: 630px;
          padding: 58px 72px 54px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background:
            linear-gradient(90deg, rgba(10, 18, 15, 0.98), rgba(10, 18, 15, 0.88) 43%, rgba(10, 18, 15, 0.36) 76%),
            url('${heroDataUrl}');
          background-size: cover;
          background-position: center;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 18px;
          font-size: 28px;
          font-weight: 850;
        }

        .mark {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border: 2px solid rgba(255, 253, 248, 0.54);
          border-radius: 10px;
          background: rgba(255, 253, 248, 0.12);
          font-size: 22px;
          font-weight: 900;
        }

        .copy {
          max-width: 760px;
        }

        .kicker {
          margin: 0 0 14px;
          color: #f3c05f;
          font-size: 21px;
          line-height: 1.1;
          font-weight: 900;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 94px;
          line-height: 0.94;
          letter-spacing: 0;
          font-weight: 900;
        }

        .summary {
          max-width: 720px;
          margin: 18px 0 0;
          color: rgba(255, 253, 248, 0.9);
          font-size: 30px;
          line-height: 1.18;
          font-weight: 650;
        }

        .signals {
          display: flex;
          gap: 14px;
          font-size: 21px;
          font-weight: 800;
          color: rgba(255, 253, 248, 0.88);
        }

        .signals span {
          padding: 10px 15px;
          border: 1px solid rgba(255, 253, 248, 0.28);
          border-radius: 10px;
          background: rgba(10, 18, 15, 0.46);
        }
      </style>
    </head>
    <body>
      <main class="card" aria-label="Open Graph preview card">
        <div class="brand">
          <div class="mark">PHC</div>
          <div>Portland Hacker Collective</div>
        </div>
        <section class="copy">
          <p class="kicker">Local hackers. Local contracts.</p>
          <h1>Portland Hacker Collective</h1>
          <p class="summary">Short-term technical help for Portland businesses.</p>
        </section>
        <footer class="signals">
          <span>pdxhc.org</span>
          <span>Portland metro</span>
          <span>Directory coming online</span>
        </footer>
      </main>
    </body>
  </html>`,
  { waitUntil: 'load' }
);

await page.screenshot({ path: outputPath, type: 'png' });
await browser.close();

console.log(`Generated ${path.relative(root, outputPath)}`);
