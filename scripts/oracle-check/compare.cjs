// Сверяет наши ответы с тремя чужими реализациями cron.
// Смысл проверки: наш код не должен оказываться единственным несогласным.
// Библиотека, которая на выражении ругнулась, в голосовании не участвует.
//
// Возвращает код 1, если хотя бы на одном случае мы разошлись с БОЛЬШИНСТВОМ
// ответивших библиотек — тогда, скорее всего, неправы мы.
const fs = require('fs');
const path = require('path');
const cp = require('cron-parser');
const { Cron } = require('croner');

const N = 8;
const f = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'ours.json'), 'utf8'));
const croniterOut = JSON.parse(fs.readFileSync(path.join(__dirname, 'croniter-out.json'), 'utf8'));

function baseDate(base) {
  const [d, t] = base.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [hh, mi, ss] = t.split(':').map(Number);
  return new Date(y, mo - 1, da, hh, mi, ss);
}

const ERR = Symbol('err');
const stats = { compared: 0, allAgree: 0, oneOracleDiffers: 0, weAreTheOutlier: 0 };
const outliers = new Map();
const oracleOddOneOut = { croniter: new Set(), 'cron-parser': new Set(), croner: new Set() };
const weRejectTheyDont = new Map();

cases.forEach((c, idx) => {
  const from = baseDate(c.base);
  const a = {};
  a.ours = c.error ? ERR : c.runs.join('|');
  a.croniter = croniterOut[idx].error ? ERR : croniterOut[idx].runs.join('|');

  try {
    const it = cp.CronExpressionParser
      ? cp.CronExpressionParser.parse(c.expr, { currentDate: from })
      : cp.parseExpression(c.expr, { currentDate: from });
    a['cron-parser'] = Array.from({ length: N }, () => f(it.next().toDate())).join('|');
  } catch { a['cron-parser'] = ERR; }

  try {
    const r = new Cron(c.expr).nextRuns(N, from);
    a.croner = r.length === N ? r.map(f).join('|') : ERR;
  } catch { a.croner = ERR; }

  const oracles = ['croniter', 'cron-parser', 'croner'].filter((o) => a[o] !== ERR);

  if (a.ours === ERR) {
    if (oracles.length > 0 && !weRejectTheyDont.has(c.expr)) {
      weRejectTheyDont.set(c.expr, { err: c.error, sample: `${oracles[0]}: ${a[oracles[0]].split('|')[0]}` });
    }
    return;
  }
  if (oracles.length === 0) return;

  stats.compared++;
  const disagreeing = oracles.filter((o) => a[o] !== a.ours);
  if (disagreeing.length === 0) {
    stats.allAgree++;
    return;
  }
  if (disagreeing.length * 2 <= oracles.length) {
    stats.oneOracleDiffers++;
    disagreeing.forEach((o) => oracleOddOneOut[o].add(c.expr));
    return;
  }
  stats.weAreTheOutlier++;
  if (!outliers.has(c.expr)) {
    outliers.set(c.expr, {
      base: c.base,
      ours: c.runs.slice(0, 3).join(' | '),
      others: Object.fromEntries(disagreeing.map((o) => [o, a[o].split('|').slice(0, 3).join(' | ')])),
    });
  }
});

console.log(JSON.stringify(stats, null, 2));
console.log('\nвыражения, где чужая библиотека осталась в меньшинстве против нас:');
for (const [k, v] of Object.entries(oracleOddOneOut)) console.log(`   ${k}: ${v.size}`);

if (weRejectTheyDont.size) {
  console.log(`\nмы отвергаем, а кто-то считает (${weRejectTheyDont.size}):`);
  for (const [expr, d] of weRejectTheyDont) console.log(`   ${expr} -> ${d.err}   [${d.sample}]`);
}

if (outliers.size === 0) {
  console.log('\nOK: ни на одном случае мы не оказались в меньшинстве.');
  process.exit(0);
}

console.log(`\nПРОБЛЕМА: на ${outliers.size} выражениях большинство считает иначе, чем мы:`);
for (const [expr, d] of outliers) {
  console.log(`\n${expr}   (от ${d.base})`);
  console.log('   ours       :', d.ours);
  for (const [o, v] of Object.entries(d.others)) console.log(`   ${o.padEnd(11)}:`, v);
}
process.exit(1);
