import { renameSync, rmSync } from 'node:fs';

// Cloudflare Pages uses this bundled Worker instead of rebuilding /functions.
renameSync('dist/.functions/index.js', 'dist/_worker.js');
rmSync('dist/.functions', { recursive: true });
