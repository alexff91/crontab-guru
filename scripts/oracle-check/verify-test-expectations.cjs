// Вытаскивает ВСЕ ожидания вида runs('expr', n, 'from') → [...] из файла тестов
// и проверяет их чужими библиотеками. Наш код здесь не запускается: если бы я
// вписал ожидание "из головы", оно бы тут и всплыло.
const fs = require('fs');
const path = require('path');
const cp = require('cron-parser');

const testFile = process.argv[2];
const src = fs.readFileSync(testFile, 'utf8').replace(/\/\/[^\n]*/g, '');

const re = /runs\('([^']+)',\s*(\d+),\s*'([^']+)'\)\s*\)\s*\.toEqual\(\[([\s\S]*?)\]\)/g;
const found = [];
let m;
while ((m = re.exec(src)) !== null) {
  const expected = Array.from(m[4].matchAll(/'([^']+)'/g)).map((x) => x[1]);
  found.push({ expr: m[1], count: Number(m[2]), from: m[3], expected });
}

const f = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const forCroniter = [];
let bad = 0;
for (const c of found) {
  const [dp, tp] = c.from.split('T');
  const [y, mo, da] = dp.split('-').map(Number);
  const [hh, mi] = tp.split(':').map(Number);
  const base = new Date(y, mo - 1, da, hh, mi, 0);
  let theirs;
  try {
    const it = cp.CronExpressionParser.parse(c.expr, { currentDate: base });
    theirs = Array.from({ length: c.expected.length }, () => f(it.next().toDate()));
  } catch (e) {
    console.log(`cron-parser ERROR on ${c.expr}: ${e.message}`);
    bad++;
    continue;
  }
  if (JSON.stringify(theirs) !== JSON.stringify(c.expected)) {
    bad++;
    console.log(`\nEXPECTATION WRONG: runs('${c.expr}', ${c.count}, '${c.from}')`);
    console.log('   test says  :', c.expected.join(' | '));
    console.log('   cron-parser:', theirs.join(' | '));
  }
  if (c.expected.length !== c.count) {
    console.log(`\nCOUNT MISMATCH in test for ${c.expr}: asks ${c.count}, expects ${c.expected.length} values`);
    bad++;
  }
  forCroniter.push([c.expr, c.from, c.expected]);
}

fs.writeFileSync(path.join(__dirname, 'test-expectations.json'), JSON.stringify(forCroniter));
console.log(`\nchecked ${found.length} expectations against cron-parser, problems: ${bad}`);
