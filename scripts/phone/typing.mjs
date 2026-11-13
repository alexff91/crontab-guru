// Types a whole cron line into the top box the way a person does — one key at a
// time, no Enter, no blur — and checks that the sentence and the next-run list
// follow every keystroke. Run against the live site or a local build:
//     node scripts/phone/typing.mjs [url]
//     SITE_DIR=dist node scripts/phone/typing.mjs     (the local build, no server)
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
import { phone } from '../../../genefix/tests/phone/lib.mjs';
const url = process.argv[2] || 'https://cron.alftech.space/';
const { b, p, errs } = await phone();
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
if (process.env.SITE_DIR) await p.route(new URL(url).origin + '/**', r => {
  let f = join(process.env.SITE_DIR, new URL(r.request().url()).pathname); if (f.endsWith('/')) f += 'index.html';
  const type = { html: 'text/html', js: 'text/javascript', css: 'text/css', woff2: 'font/woff2', png: 'image/png' }[f.split('.').pop()] || 'text/plain';
  existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: type }) : r.fulfill({ status: 404, body: '' });
});
try {
  await p.goto(url, { waitUntil: 'networkidle' });
  const sentence = () => p.locator('.wb-slab').innerText();
  const runs = () => p.locator('.wb-grid2').innerText();
  const before = await sentence(); const runsBefore = await runs();
  await p.click('#whole'); await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.press('Backspace');
  await p.keyboard.type('*/15 2 * *', { delay: 20 });
  ok(/Expected 5 fields, got 4/.test(await sentence()), 'four fields typed: says so instead of the old sentence');
  await p.keyboard.type(' 0', { delay: 20 });
  const after = await sentence(); const runsAfter = await runs();
  ok(after !== before && /15th minute/i.test(after) && /Sunday/i.test(after), 'fifth field typed, no Enter: sentence is the new schedule — ' + after.split('\n').find(l => /minute/i.test(l)));
  ok(runsAfter !== runsBefore && /Sun/.test(runsAfter) && /02:\d\d|2:\d\d/.test(runsAfter), 'next runs follow without Enter');
  ok(await p.evaluate(() => document.activeElement?.id === 'whole'), 'the box keeps focus while typing');
  ok(await p.inputValue('#whole') === '*/15 2 * * 0', 'the box holds exactly what was typed');
  ok(await p.getByLabel('Hour — type').inputValue() === '2', 'the five fields below follow');
  await p.keyboard.type(' ', { delay: 20 });
  ok(await p.inputValue('#whole') === '*/15 2 * * 0 ', 'a trailing space is not eaten');
  await p.getByLabel('Minute — type').fill('30');
  ok(await p.inputValue('#whole') === '30 2 * * 0', 'editing a field below rewrites the box');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at 390');
  ok(errs.length === 0, 'no script errors ' + errs.join('; '));
} finally { await b.close(); }
process.exit(bad ? 1 : 0);
