// Tests for the segmenter, SiGML composition and the demo pipeline (self-written data only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLexicon, lookupGloss, hasWord } from '../src/lexicon.js';
import { segment } from '../src/segmenter.js';
import { composeSiGML } from '../src/sigml_compose.js';
import { textToSiGML } from '../src/pipeline.js';

const WORDS = ['học_sinh', 'học', 'sinh_viên', 'thành_phố_hồ_chí_minh', 'thành_phố', 'xe_đạp', 'đi', 'tôi', 'cam'];
const SYN = [['xe_máy', 'xe_đạp']];
const lex = buildLexicon(WORDS, SYN);

test('hasWord: exact diacritics (case-insensitive) or Synonyms key only', () => {
  assert.ok(hasWord(lex, 'Học_Sinh'));
  assert.ok(hasWord(lex, 'xe_máy'));
  assert.ok(!hasWord(lex, 'hoc_sinh')); // stripped form is not used for segmentation
});

test('segment: longest syllable match joined with "_"', () => {
  assert.deepEqual(segment('học sinh đi học', lex), ['học_sinh', 'đi', 'học']);
  assert.deepEqual(segment('thành phố hồ chí minh', lex), ['thành_phố_hồ_chí_minh']);
  assert.deepEqual(segment('thành phố nhỏ', lex), ['thành_phố', 'nhỏ']);
});

test('segment: keeps existing "_" units, does not join across punctuation, uses Synonyms keys', () => {
  assert.deepEqual(segment('sinh_viên đi xe máy', lex), ['sinh_viên', 'đi', 'xe_máy']);
  assert.deepEqual(segment('học , sinh', lex), ['học', ',', 'sinh']);
});

test('segment: unknown syllables stay separate; no stripped-diacritic joins', () => {
  assert.deepEqual(segment('hoc sinh', lex), ['hoc', 'sinh']);
  assert.deepEqual(segment('', lex), []);
});

test('segment respects maxSpan', () => {
  assert.deepEqual(segment('thành phố hồ chí minh', lex, { maxSpan: 2 }), ['thành_phố', 'hồ', 'chí', 'minh']);
});

const SIGNS = {
  'tôi': '  <hns_sign gloss="tôi"><hamnosys_manual><hamfist/></hamnosys_manual></hns_sign>',
  'xe_đạp': '  <hns_sign gloss="xe_đạp"><hamnosys_manual><hamflathand/></hamnosys_manual></hns_sign>',
  'cam': '  <hns_sign gloss="cam"><hamnosys_manual><hamfinger2/></hamnosys_manual></hns_sign>',
};

test('composeSiGML: one <sigml> with fragments in gloss order; missing listed, not spelled', () => {
  const lookups = lookupGloss(['tôi', 'xe_máy', 'bay'], lex);
  const r = composeSiGML(lookups, SIGNS);
  assert.equal(r.sigml, `<sigml>\n${SIGNS['tôi']}\n${SIGNS['xe_đạp']}\n</sigml>\n`);
  assert.deepEqual(r.missing, ['bay']);
  assert.deepEqual(r.signed.map((s) => [s.token, s.kind, s.entry]), [['tôi', 'exact', 'tôi'], ['xe_máy', 'synonym', 'xe_đạp']]);
  assert.equal((r.sigml.match(/<hns_sign /g) || []).length, 2);
});

test('composeSiGML: entry known to lexicon but absent from signs counts as missing', () => {
  const r = composeSiGML(lookupGloss(['đi'], lex), SIGNS);
  assert.equal(r.sigml, '');
  assert.deepEqual(r.missing, ['đi']);
});

test('composeSiGML: stripped match is signed but flagged uncertain', () => {
  const r = composeSiGML(lookupGloss(['cám'], lex), SIGNS);
  assert.equal(r.signed.length, 1);
  assert.equal(r.uncertain.length, 1);
  assert.equal(r.uncertain[0].entry, 'cam');
});

test('textToSiGML: segment -> rules -> lookup -> compose', () => {
  const r = textToSiGML('tôi thích cam', lex, SIGNS);
  // object_verb: "tôi thích cam" -> "tôi cam thích"; "thích" has no sign
  assert.equal(r.gloss, 'tôi cam thích');
  assert.deepEqual(r.missing, ['thích']);
  assert.equal(r.sigml, `<sigml>\n${SIGNS['tôi']}\n${SIGNS['cam']}\n</sigml>\n`);
});
