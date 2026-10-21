// Общая проверка: её вызывают и сайт (до нажатия), и сервер (перед публикацией).
// check() возвращает { ok, reason, waitMinutes }.

const HOUR = 60 * 60 * 1000;

export function shortcodeFromUrl(url) {
  const m = /^https:\/\/(www\.)?threads\.(com|net)\/@[\w.]+\/post\/([\w-]+)/.exec(url || '');
  return m ? m[3] : null;
}

// Короткий код поста Threads → числовой id (тот же алфавит, что у Instagram)
export function mediaIdFromShortcode(code) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = 0n;
  for (const ch of code) {
    const i = abc.indexOf(ch);
    if (i < 0) return null;
    id = id * 64n + BigInt(i);
  }
  return id.toString();
}

function linksIn(text) {
  return text.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?/gi) || [];
}

export function check({ text, replyUrl, rules, log, docs, now = Date.now() }) {
  const t = (text || '').trim();
  const no = (reason, waitMinutes = 0) => ({ ok: false, reason, waitMinutes });

  if (docs && docs.changed) {
    return no('Документация Threads изменилась ' + (docs.since || '') + '. Подожди, пока правила сверят заново.');
  }
  if (!t) return no('Текст пустой.');
  if (t.length > rules.api.maxTextLength) return no(`Длиннее ${rules.api.maxTextLength} символов (сейчас ${t.length}).`);
  if ((t.match(/#/g) || []).length > rules.api.maxTopicTags) return no('В Threads можно только одну тему (#) на пост.');

  const bad = linksIn(t).find(l => !rules.allowedLinks.some(a => l.toLowerCase().includes(a)));
  if (bad) return no('Ссылка не на наш сайт: ' + bad);

  for (const f of rules.forbidden) {
    if (new RegExp(f.re, 'iu').test(t)) return no(f.why + '.');
  }

  if (!shortcodeFromUrl(replyUrl)) return no('Вставь ссылку на свой пост в Threads (threads.com/@ник/post/…).');

  const sent = (log || []).filter(e => e.ok);
  const day = sent.filter(e => now - Date.parse(e.at) < 24 * HOUR);

  if (rules.ours.oneReplyPerPost && sent.some(e => e.replyUrl && shortcodeFromUrl(e.replyUrl) === shortcodeFromUrl(replyUrl))) {
    return no('На этот пост мы уже ответили.');
  }
  if (day.some(e => (e.text || '').trim() === t)) {
    return no(rules.repetition.why + '. Измени хотя бы пару слов.');
  }
  if (day.length >= rules.ours.repliesPer24h) {
    const oldest = Math.min(...day.map(e => Date.parse(e.at)));
    return no(`Лимит ${rules.ours.repliesPer24h} ответов в сутки исчерпан.`, Math.ceil((oldest + 24 * HOUR - now) / 60000));
  }
  const last = Math.max(0, ...sent.map(e => Date.parse(e.at)));
  const gap = rules.ours.minIntervalMinutes * 60000;
  if (now - last < gap) {
    return no(`Между ответами нужна пауза ${rules.ours.minIntervalMinutes} мин.`, Math.ceil((last + gap - now) / 60000));
  }
  return { ok: true, reason: '', waitMinutes: 0 };
}

export function waitText(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return 'Подожди ' + (h ? h + ' ч ' : '') + (m ? m + ' мин' : '') + '.';
}
