// Node helper for tools/build_pack.py (prints JSON to stdout).
//   node tools/pack_node.mjs inputs [--data DIR]   sentences + dictionary entries needed for the demo pack
//   node tools/pack_node.mjs check  [--pack FILE]  run the browser pipeline on the pack only
import { readFileSync } from 'node:fs';
import { tokenize, PUNCT } from '../src/gloss_rules.js';
import { buildLexicon, lookupGloss } from '../src/lexicon.js';
import { textToSiGML } from '../src/pipeline.js';
import { DEFAULT_DATA, loadPairs, alignedNonEmpty, loadDictionaryWords, loadSynonyms } from './lib_data.mjs';

const [cmd, ...args] = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const PACK_KINDS = ['exact', 'synonym']; // never diacritic-stripped matches for the pack

function inputs(dataDir) {
  const words = loadDictionaryWords(dataDir);
  const lex = buildLexicon(words, loadSynonyms(dataDir));
  const a = alignedNonEmpty(loadPairs(dataDir, 'DataTrain1.txt'), loadPairs(dataDir, 'DataTrain2.txt'));
  const seen = new Set();
  const unique = a.signed.filter(([s, t]) => { const k = s + '\t' + t; if (seen.has(k)) return false; seen.add(k); return true; });

  const entries = new Map();   // index -> word
  const synonyms = new Map();  // form -> entry word
  const sentences = [];
  const collect = (lookups) => {
    for (const r of lookups) {
      if (r.kind === 'missing') continue;
      entries.set(r.index, r.entry);
      if (r.kind === 'synonym') synonyms.set(r.form.toLowerCase(), r.entry);
    }
  };
  for (const [source, reference] of unique) {
    const refTokens = tokenize(reference).filter((t) => !PUNCT.has(t));
    const refLookups = lookupGloss(refTokens, lex, { kinds: PACK_KINDS });
    if (refLookups.some((r) => r.kind === 'missing')) continue; // M3 "ký được hoàn toàn" (exact + Synonyms)
    const rule = textToSiGML(source, lex, {}, { kinds: PACK_KINDS });
    collect(refLookups);
    collect(rule.lookups);
    sentences.push({
      source,
      reference,
      referenceEntries: refLookups.map((r) => r.index),
      ruleEntries: rule.lookups.filter((r) => r.kind !== 'missing').map((r) => r.index),
      ruleMissing: rule.lookups.filter((r) => r.kind === 'missing').map((r) => r.token),
    });
  }
  return {
    uniquePairs: unique.length,
    sentences,
    entries: [...entries].sort((x, y) => x[0] - y[0]).map(([index, word]) => ({ index, word })),
    synonyms: [...synonyms].sort(),
  };
}

function check(packFile) {
  const pack = JSON.parse(readFileSync(packFile, 'utf8'));
  const lex = buildLexicon(Object.keys(pack.signs), pack.synonyms);
  return pack.sentences.map((s) => {
    const out = {};
    for (const [name, text] of [['source', s.source], ['reference', s.reference]]) {
      // The reference is already a gloss: look it up directly (no rules).
      const r = name === 'source'
        ? textToSiGML(text, lex, pack.signs)
        : (() => {
          const lookups = lookupGloss(tokenize(text).filter((t) => !PUNCT.has(t)), lex, { kinds: ['exact', 'synonym', 'plain'] });
          const missing = lookups.filter((x) => x.kind === 'missing' || !pack.signs[x.entry]).map((x) => x.token);
          const frags = lookups.filter((x) => x.kind !== 'missing' && pack.signs[x.entry]).map((x) => pack.signs[x.entry]);
          return { gloss: text, missing, uncertain: lookups.filter((x) => x.uncertain),
            sigml: frags.length ? `<sigml>\n${frags.join('\n')}\n</sigml>\n` : '' };
        })();
      out[name] = { gloss: r.gloss, missing: r.missing, uncertain: r.uncertain.length, sigml: r.sigml };
    }
    return out;
  });
}

if (cmd === 'inputs') process.stdout.write(JSON.stringify(inputs(opt('--data', DEFAULT_DATA))));
else if (cmd === 'check') process.stdout.write(JSON.stringify(check(opt('--pack', 'data/pack/demo_pack.json'))));
else { console.error('usage: node tools/pack_node.mjs inputs|check [--data DIR] [--pack FILE]'); process.exit(2); }
