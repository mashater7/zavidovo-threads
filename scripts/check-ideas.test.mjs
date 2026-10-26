// node --test scripts/check-ideas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIdeas } from './check-ideas.mjs';

const pair = n => ({ id: `i-2026-10-26-${n}`, topic: 'доплаты',
  negative: `Сняли домик, а на месте всё платное, вариант ${n}. У вас так бывало?`,
  positive: `У нас баня или чан уже в стоимости, дрова и халаты тоже, вариант ${n}. zavidovobarn.ru` });
const post = n => ({ id: `p-2026-10-26-${n}`, text: `Любители бани, вопрос номер ${n}: веник берёзовый или дубовый?`, why: 'вовлечение' });
const good = () => ({ updated: '2026-10-26T07:40:00Z', days: [{ date: '2026-10-26',
  pairs: [1, 2, 3, 4, 5].map(pair), posts: [1, 2, 3, 4, 5].map(post) }] });

test('хороший файл проходит', () => assert.deepEqual(checkIdeas(good()), []));
test('пустой журнал идей проходит', () => assert.deepEqual(checkIdeas({ updated: '', days: [] }), []));

const bad = (name, mutate, expect) => test(name, () => {
  const d = good(); mutate(d); const errs = checkIdeas(d);
  assert.ok(errs.some(e => expect.test(e)), `ждали ошибку ${expect}, получили: ${JSON.stringify(errs)}`);
});
bad('нет поля positive', d => delete d.days[0].pairs[0].positive, /positive/);
bad('длиннее 500', d => { d.days[0].posts[0].text = 'а'.repeat(501); }, /500/);
bad('цена в позитиве', d => { d.days[0].pairs[1].positive = 'Домик за 5000 ₽ в сутки'; }, /[Цц]ен/);
bad('ссылка на чужой сайт', d => { d.days[0].posts[1].text = 'Смотрите avito.ru/dom'; }, /[Сс]сылк/);
bad('ссылка в негативе', d => { d.days[0].pairs[2].negative = 'Вот этот ужас: example.com/x'; }, /[Сс]сылк/);
bad('повтор текста', d => { d.days[0].posts[1].text = d.days[0].posts[0].text; }, /[Пп]овтор/);
bad('дубль id', d => { d.days[0].pairs[1].id = d.days[0].pairs[0].id; }, /id/);
bad('не 5 пар в новом дне', d => { d.days[0].pairs.pop(); }, /5/);
bad('хозяйка в тексте', d => { d.days[0].posts[2].text = 'Хозяйка Мария ждёт вас'; }, /хозяйк/i);
