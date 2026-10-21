# Считает темы жалоб из ../negativ/raw/*.jsonl → data/topics.json.
# На сайт (он публичный) уходят только цифры: без текстов, названий и ссылок.
import json, pathlib, collections, datetime

root = pathlib.Path(__file__).resolve().parent.parent
raw = root.parent / 'negativ' / 'raw'

NAMES = {
    'доплаты': 'Доплаты на месте', 'грязь': 'Грязь', 'фото_не_соответствует': 'Фото не как в жизни',
    'холодно': 'Холодно', 'шум': 'Шум', 'животные': 'С животными нельзя / доплата',
    'предоплата_возврат': 'Не вернули предоплату', 'хозяин_хамит': 'Хозяин хамит',
    'баня_чан': 'Баня или чан не готовы', 'дорога_доступ': 'Дорога', 'вода_туалет': 'Вода и туалет',
    'насекомые': 'Насекомые', 'другое': 'Другое',
}

seen, topics, sources, objects = set(), collections.Counter(), collections.Counter(), set()
by_topic_source = collections.defaultdict(collections.Counter)
for f in sorted(raw.glob('*.jsonl')):
    for line in f.read_text(encoding='utf-8').splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        key = ' '.join((r.get('text') or '').lower().split())[:120]
        if key in seen:
            continue
        seen.add(key)
        t = r.get('topic') or 'другое'
        topics[t] += 1
        sources[r.get('source', f.stem)] += 1
        by_topic_source[t][r.get('source', f.stem)] += 1
        objects.add((r.get('object') or '').strip().lower())

out = {
    'built': datetime.date.today().isoformat(),
    'total': sum(topics.values()),
    'objects': len(objects),
    'sources': dict(sources.most_common()),
    'topics': [{'key': k, 'name': NAMES.get(k, k), 'count': n, 'sources': dict(by_topic_source[k].most_common())}
               for k, n in topics.most_common()],
}
(root / 'data' / 'topics.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(out['total'], 'отзывов,', out['objects'], 'объектов')
