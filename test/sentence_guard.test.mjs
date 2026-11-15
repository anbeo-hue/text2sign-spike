// Tests for unified/v2/sentence.js (classic browser script, loaded into globalThis).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(readFileSync(new URL('../unified/v2/sentence.js', import.meta.url), 'utf8'));
const S = globalThis.VSLSentence;
S.setRetryWaitMs(5);
const CFG = { endpoint: 'https://example.invalid/v1/chat/completions', model: 'm', key: 'k' };
const reply = (content, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content } }] }) });

test('validate: accepts function words only', () => {
  assert.equal(S.validate(['Cháu', 'Đi', 'Nhà'], 'Cháu đang đi nhà.').ok, true);
  assert.equal(S.validate(['Tôi', 'Cảm ơn', 'Anh'], 'Tôi cảm ơn anh ạ').ok, true);
  assert.equal(S.validate(['Cháu', 'Nhà'], 'Cháu nhà').ok, true);
});
test('validate: rejects new content words', () => {
  assert.equal(S.validate(['Cháu', 'Nhà'], 'Cháu đang về nhà').ok, false);
  assert.equal(S.validate(['Tôi', 'Ăn'], 'Tôi ăn cơm').ok, false);
});
test('validate: rejects dropped or reordered words', () => {
  assert.equal(S.validate(['Tôi', 'Ăn', 'Sách'], 'Tôi ăn').ok, false);
  assert.equal(S.validate(['Tôi', 'Ăn'], 'Ăn tôi').ok, false);
  assert.equal(S.validate(['Cảm ơn'], 'ơn cảm').ok, false);
});
test('validate: rejects empty, long or multi-line answers', () => {
  assert.equal(S.validate(['Tôi', 'Ăn'], '').ok, false);
  assert.equal(S.validate(['Tôi', 'Ăn'], 'Tôi ăn\nTôi ăn').ok, false);
  assert.equal(S.validate(['Tôi', 'Ăn'], 'Tôi ăn ' + 'và '.repeat(80)).ok, false);
});
test('compose: no config -> raw words, no request', async () => {
  let called = 0;
  const r = await S.compose(['Cháu', 'Nhà'], { endpoint: '', model: '', key: '' }, async () => { called++; });
  assert.deepEqual([r.text, r.source, called], ['Cháu Nhà', 'raw', 0]);
});
test('compose: one word -> raw, no request', async () => {
  let called = 0;
  const r = await S.compose(['Cháu'], CFG, async () => { called++; });
  assert.deepEqual([r.text, r.source, called], ['Cháu', 'raw', 0]);
});
test('compose: valid AI answer is used', async () => {
  const r = await S.compose(['Cháu', 'Đi', 'Nhà'], CFG, reply('"Cháu đang đi nhà."'));
  assert.deepEqual([r.text, r.source], ['Cháu đang đi nhà.', 'ai']);
});
test('compose: AI answer with invented word -> raw', async () => {
  const r = await S.compose(['Cháu', 'Nhà'], CFG, reply('Cháu đang về nhà.'));
  assert.equal(r.source, 'raw');
  assert.equal(r.text, 'Cháu Nhà');
  assert.match(r.reason, /về/);
});
test('compose: HTTP error, network error -> raw', async () => {
  assert.equal((await S.compose(['Cháu', 'Nhà'], CFG, reply('x', 401))).source, 'raw');
  assert.equal((await S.compose(['Cháu', 'Nhà'], CFG, async () => { throw new TypeError('net'); })).source, 'raw');
});
test('compose: 400 retries once with the bare request', async () => {
  const bodies = [];
  const f = async (_u, init) => {
    bodies.push(JSON.parse(init.body));
    return bodies.length === 1 ? { ok: false, status: 400, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Cháu ở nhà' } }] }) };
  };
  const r = await S.compose(['Cháu', 'Nhà'], CFG, f);
  assert.equal(r.source, 'ai');
  assert.equal('temperature' in bodies[0], true);
  assert.equal('temperature' in bodies[1], false);
  assert.equal('reasoning_effort' in bodies[1], false);
});
test('compose: only words are sent', async () => {
  let sent = null;
  await S.compose(['Cháu', 'Nhà'], CFG, async (_u, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Cháu ở nhà' } }] }) }; });
  assert.deepEqual(Object.keys(sent).sort(), ['messages', 'model', 'reasoning_effort', 'temperature']);
  assert.equal(sent.messages[1].content, 'Chuỗi từ: Cháu, Nhà');
});
test('compose: 503 retries once, then uses the answer', async () => {
  let n = 0;
  const f = async () => (++n === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Bây giờ mưa' } }] }) });
  const r = await S.compose(['Bây giờ', 'Mưa'], CFG, f);
  assert.deepEqual([r.source, r.text, n], ['ai', 'Bây giờ mưa', 2]);
});
test('compose: 503 twice -> raw with a clear reason', async () => {
  let n = 0;
  const r = await S.compose(['Mưa', 'Bây giờ'], CFG, async () => { n++; return { ok: false, status: 503, json: async () => ({}) }; });
  assert.deepEqual([r.source, r.text, n], ['raw', 'Mưa Bây giờ', 2]);
  assert.match(r.reason, /503/);
});
