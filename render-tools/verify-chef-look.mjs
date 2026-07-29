// Manual visual check of the chez-samoa-3D chef look (dreadlocks + her
// colors) added to Short Order's makeChef/makePlayer. Opens
// ../public/short-order/index.html directly (no build step) and screenshots.
// Not part of any automated suite -- run by hand: node verify-chef-look.mjs
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const shotDir = process.argv[2] || '.';
const file = pathToFileURL(path.resolve('../public/short-order/index.html')).href;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

// This sandbox blocks the CDN Short Order loads three.js from (unrelated to
// this change -- real browsers reach it fine). Serve the exact same r128
// build locally instead, fetched via npm (which IS reachable), just for this
// verification screenshot.
const threePath = '/tmp/claude-0/-home-user-chez-samoa-3D/234177ff-2e28-5213-ab16-65925c6a618f/scratchpad/three128/package/build/three.min.js';
await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', (route) =>
  route.fulfill({ path: threePath, contentType: 'application/javascript' })
);

await page.goto(file, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.click('#playBtn').catch(() => {});
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(shotDir, 'chef-look-1-title.png') });

await browser.close();
console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
