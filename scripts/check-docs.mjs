// Раз в неделю: перечитывает страницы правил Threads/Meta.
// Если текст изменился — ставит docs-status.changed, и сайт перестаёт публиковать,
// пока правила не сверят и не сбросят флаг.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const rules = JSON.parse(readFileSync('data/rules.json', 'utf8'));
const hashes = JSON.parse(readFileSync('data/docs-hashes.json', 'utf8'));
const status = JSON.parse(readFileSync('data/docs-status.json', 'utf8'));

const clean = html => html
  .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\d{6,}/g, '') // служебные id меняются при каждой сборке
  .replace(/\s+/g, ' ')
  .trim();

const changed = [], failed = [];
for (const url of rules.sources) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const h = createHash('sha256').update(clean(await r.text())).digest('hex');
    if (hashes[url] && hashes[url] !== h) changed.push(url);
    hashes[url] = h;
  } catch (e) {
    failed.push(url + ' — ' + e.message);
  }
}

status.checked = new Date().toISOString();
status.failed = failed;
if (changed.length) {
  status.changed = true;
  status.since = new Date().toISOString().slice(0, 10);
  status.pages = changed;
}
writeFileSync('data/docs-hashes.json', JSON.stringify(hashes, null, 2) + '\n');
writeFileSync('data/docs-status.json', JSON.stringify(status, null, 2) + '\n');
console.log(changed.length ? 'Изменились: ' + changed.join(', ') : 'Без изменений', failed.length ? '\nНе открылись: ' + failed.join('; ') : '');
