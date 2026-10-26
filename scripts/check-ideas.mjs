// Проверка data/ideas.json перед публикацией (её запускает облачная задача Claude перед коммитом).
// node scripts/check-ideas.mjs  — печатает ошибки и выходит с кодом 1, если они есть.
// Позитив и посты @zavidovobarn проверяются теми же правилами, что и «ОК» (scripts/rules.js),
// негатив — для личного аккаунта владелицы — только на длину и отсутствие ссылок.
import { readFileSync } from 'node:fs';
import { check } from './rules.js';

const PER_DAY = 5, MAX = 500;
const DUMMY_URL = 'https://www.threads.com/@x/post/IDEA';   // rules.js требует ссылку на пост — для идей она не важна
const LINK = /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?/i;

export function checkIdeas(data, { rules = loadJson('data/rules.json'), docs = { changed: false } } = {}) {
  const errs = [];
  if (!data || !Array.isArray(data.days)) return ['нет списка days'];
  const ids = new Set(), texts = new Map();
  const seen = (where, t) => { const k = String(t || '').trim().toLowerCase(); if (!k) return;
    if (texts.has(k)) errs.push(`${where}: повтор текста (уже есть в ${texts.get(k)})`); else texts.set(k, where); };
  const brand = (where, t) => {
    if (!t || !String(t).trim()) { errs.push(`${where}: пустой текст`); return; }
    if (t.length > MAX) errs.push(`${where}: длиннее ${MAX} символов (${t.length})`);
    const v = check({ text: t, replyUrl: DUMMY_URL, rules, log: [], docs });
    if (!v.ok) errs.push(`${where}: ${v.reason}`);
  };
  data.days.forEach((day, di) => {
    const d = day.date || `день ${di + 1}`;
    for (const [k, list] of [['pairs', day.pairs], ['posts', day.posts]]) {
      if (!Array.isArray(list)) { errs.push(`${d}: нет списка ${k}`); continue; }
      if (di === 0 && list.length !== PER_DAY) errs.push(`${d}: в ${k} должно быть ${PER_DAY}, сейчас ${list.length}`);
    }
    for (const [i, p] of (day.pairs || []).entries()) {
      const w = `${d} пара ${i + 1}`;
      for (const f of ['id', 'topic', 'negative', 'positive']) if (!p[f]) errs.push(`${w}: нет поля ${f}`);
      if (p.id) { if (ids.has(p.id)) errs.push(`${w}: id ${p.id} повторяется`); ids.add(p.id); }
      if (p.negative) {
        if (p.negative.length > MAX) errs.push(`${w} негатив: длиннее ${MAX} символов (${p.negative.length})`);
        if (LINK.test(p.negative)) errs.push(`${w} негатив: ссылки в негативе не нужны`);
        seen(`${w} негатив`, p.negative);
      }
      if (p.positive) { brand(`${w} позитив`, p.positive); seen(`${w} позитив`, p.positive); }
    }
    for (const [i, p] of (day.posts || []).entries()) {
      const w = `${d} пост ${i + 1}`;
      for (const f of ['id', 'text', 'why']) if (!p[f]) errs.push(`${w}: нет поля ${f}`);
      if (p.id) { if (ids.has(p.id)) errs.push(`${w}: id ${p.id} повторяется`); ids.add(p.id); }
      if (p.text) { brand(w, p.text); seen(w, p.text); }
    }
  });
  return errs;
}

function loadJson(rel) { return JSON.parse(readFileSync(new URL('../' + rel, import.meta.url), 'utf8')); }

if (process.argv[1] && process.argv[1].endsWith('check-ideas.mjs')) {
  const errs = checkIdeas(loadJson('data/ideas.json'));
  if (errs.length) { console.error('ОШИБКИ:\n- ' + errs.join('\n- ')); process.exit(1); }
  console.log('ideas.json в порядке');
}
