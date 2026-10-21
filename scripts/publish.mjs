// Запускается GitHub Actions по кнопке «ОК» на сайте.
// Проверяет правила, спрашивает у Threads остаток лимита и публикует ответ.
import { readFileSync, writeFileSync } from 'node:fs';
import { check, shortcodeFromUrl, mediaIdFromShortcode, waitText } from './rules.js';

const API = 'https://graph.threads.net/v1.0';
const token = process.env.THREADS_TOKEN;
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const p = event.client_payload || event.inputs || {};
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const rules = read('data/rules.json');
const log = read('data/log.json');
const docs = read('data/docs-status.json');

function finish(entry) {
  log.unshift({ id: p.id, text: p.text, replyUrl: p.reply_url, at: new Date().toISOString(), ...entry });
  writeFileSync('data/log.json', JSON.stringify(log, null, 2) + '\n');
  console.log(entry.ok ? 'Опубликовано' : 'Отказ: ' + entry.reason);
}

async function api(path, params, method = 'GET') {
  const q = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`${API}${path}?${q}`, { method });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error ? j.error.message : 'HTTP ' + r.status);
  return j;
}

const verdict = check({ text: p.text, replyUrl: p.reply_url, rules, log, docs });
if (!verdict.ok) {
  finish({ ok: false, reason: verdict.reason + ' ' + waitText(verdict.waitMinutes) });
} else if (!token) {
  finish({ ok: false, reason: 'Сервер ещё не подключён к Threads (нет токена).' });
} else {
  try {
    const lim = await api('/me/threads_publishing_limit', { fields: 'reply_quota_usage,reply_config' });
    const d = (lim.data || [])[0] || {};
    const total = d.reply_config ? d.reply_config.quota_total : rules.api.repliesPer24hApi;
    if (d.reply_quota_usage >= total) {
      finish({ ok: false, reason: `Threads: лимит ответов на сутки исчерпан (${d.reply_quota_usage}/${total}). Подожди до завтра.` });
    } else {
      const replyTo = mediaIdFromShortcode(shortcodeFromUrl(p.reply_url));
      const c = await api('/me/threads', { media_type: 'TEXT', text: p.text.trim(), reply_to_id: replyTo }, 'POST');
      await new Promise(r => setTimeout(r, 15000)); // Threads советует дать контейнеру обработаться
      const pub = await api('/me/threads_publish', { creation_id: c.id }, 'POST');
      finish({ ok: true, postId: pub.id });
    }
  } catch (e) {
    finish({ ok: false, reason: 'Threads ответил ошибкой: ' + e.message });
  }
}
