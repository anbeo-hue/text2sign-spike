// Unit tests with self-written sentences (no third-party data copied).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textToGloss, tokenize, RULE_GROUPS } from '../src/gloss_rules.js';
import { buildLexicon, lookupGloss } from '../src/lexicon.js';
import { splitPairs, stripDiacritics, mulberry32 } from '../src/split.js';

const g = (s, groups) => textToGloss(s, groups ? { groups } : undefined).gloss;

test('tokenize separates punctuation', () => {
  assert.deepEqual(tokenize('chào bạn, khỏe không?'), ['chào', 'bạn', ',', 'khỏe', 'không', '?']);
});

test('punctuation group drops punctuation', () => {
  assert.equal(g('chào bạn , khỏe', ['punctuation']), 'chào bạn khỏe');
});

test('function_words drops listed words but never empties the sentence', () => {
  assert.equal(g('em đã ăn cơm rồi', ['function_words']), 'em ăn cơm rồi');
  assert.equal(g('là', ['function_words']), 'là');
});

test('classifiers: drop "cái" before a noun, keep before demonstrative/question word', () => {
  assert.equal(g('cái bàn đẹp', ['classifiers']), 'bàn đẹp');
  assert.equal(g('cái này đẹp', ['classifiers']), 'cái này đẹp');
  assert.equal(g('em thích cái gì', ['classifiers']), 'em thích cái gì');
});

test('numbers: number word moves after the noun as a digit', () => {
  assert.equal(g('hai quả cam', ['numbers']), 'quả 2 cam');
  assert.equal(g('năm 2020', ['numbers']), 'năm 2020');
});

test('negation: NEG X -> X NEG, except "không phải"', () => {
  assert.equal(g('trời không lạnh', ['negation']), 'trời lạnh không');
  assert.equal(g('đây không phải nhà', ['negation']), 'đây không phải nhà');
});

test('object_verb: object moves before the verb chain', () => {
  assert.equal(g('em thích cam', ['object_verb']), 'em cam thích');
  assert.equal(g('em thích nhất cam', ['object_verb']), 'em cam thích nhất');
  assert.equal(g('bố đọc báo', ['object_verb']), 'bố báo đọc');
  assert.equal(g('đọc báo', ['object_verb']), 'đọc báo'); // no subject: unchanged
});

test('question: wh-word to end, "mấy N" -> "N mấy", skipped in multi-clause sentences', () => {
  assert.equal(g('ai mua cam', ['question']), 'mua cam ai');
  assert.equal(g('mấy giờ rồi', ['question']), 'giờ mấy rồi');
  assert.equal(g('ai đến thì mở cửa', ['question']), 'ai đến thì mở cửa');
});

test('full pipeline logs applied rules', () => {
  // object_verb is skipped because the object contains a question word;
  // question then turns "mấy quả" into "quả mấy".
  const r = textToGloss('bạn đã ăn mấy quả ?');
  assert.ok(r.applied.some((a) => a.group === 'punctuation'));
  assert.ok(r.applied.some((a) => a.group === 'function_words'));
  assert.ok(!r.applied.some((a) => a.group === 'object_verb'));
  assert.equal(r.gloss, 'bạn ăn quả mấy');
  assert.deepEqual(RULE_GROUPS.slice(0, 2), ['punctuation', 'function_words']);
});

test('stripDiacritics handles đ and tones', () => {
  assert.equal(stripDiacritics('Đường đẹp quá'), 'Duong dep qua');
});

test('lexicon: exact with "_" joining, synonym fallback, plain marked uncertain, first of duplicates', () => {
  const lex = buildLexicon(['cô_ấy', 'mèo', 'ba', 'bàn', 'bàn', 'xe_đạp'], [['xe_máy', 'xe_đạp'], ['mèo', 'miu']]);
  const r = lookupGloss(['cô', 'ấy', 'bà', 'mèo', 'xe_máy', 'chó', 'bàn'], lex);
  assert.deepEqual(r.map((x) => [x.token, x.kind]), [
    ['cô ấy', 'exact'], ['bà', 'plain'], ['mèo', 'exact'], ['xe_máy', 'synonym'], ['chó', 'missing'], ['bàn', 'exact'],
  ]);
  assert.equal(r[1].uncertain, true);
  assert.equal(r[1].entry, 'ba');
  assert.equal(r[1].candidates, 1); // only "ba" strips to "ba" ("bàn" -> "ban")
});

test('lexicon: exact beats plain even when plain span is longer; ambiguous count', () => {
  const lex = buildLexicon(['ba', 'ba', 'ba_ba'], []);
  const r = lookupGloss(['ba', 'bá'], lex);
  assert.deepEqual(r.map((x) => [x.token, x.kind]), [['ba', 'exact'], ['bá', 'plain']]);
  assert.equal(r[0].ambiguous, 2);
  assert.equal(r[0].index, 0);
});

test('split: deterministic, no group on both sides, unsigned twin on same side', () => {
  const signed = [], unsigned = [];
  for (let i = 0; i < 50; i++) {
    const p = [`câu số ${i}`, `số ${i} câu`];
    signed.push(p, p); // duplicates
    unsigned.push(p.map(stripDiacritics), p.map(stripDiacritics));
  }
  const a = splitPairs(signed, unsigned, { seed: 7 });
  const b = splitPairs(signed, unsigned, { seed: 7 });
  assert.deepEqual(a.test.map((x) => x.key), b.test.map((x) => x.key));
  assert.equal(a.stats.groups, 50);
  assert.equal(a.train.length + a.test.length, 50);
  assert.equal(a.test.length, 15);
  const trainKeys = new Set(a.train.map((x) => x.key));
  assert.ok(a.test.every((x) => !trainKeys.has(x.key)));
  for (const grp of [...a.train, ...a.test]) {
    assert.equal(grp.signed.length, 1);
    assert.equal(grp.unsigned[0][0], stripDiacritics(grp.signed[0][0]));
  }
});

test('mulberry32 is deterministic', () => {
  const r1 = mulberry32(1), r2 = mulberry32(1);
  assert.equal(r1(), r2());
});
