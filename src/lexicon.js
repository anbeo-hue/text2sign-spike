// Gloss tokens -> dictionary entries. Pure ES module (browser + Node).
//
// Lookup order for each position (longest span first, up to MAX_SPAN tokens joined by "_"):
//   1. exact   : same diacritics (case-insensitive)                 -> certain
//   2. synonym : word absent; a synonym exists with exact diacritics -> certain-ish, labelled
//   3. plain   : diacritic-stripped match                           -> "chưa chắc" (homophones)
//   4. missing
import { stripDiacritics } from './split.js';

export const MAX_SPAN = 4;

/**
 * @param {string[]} words dictionary Word column in file order (duplicates allowed)
 * @param {Array<[string,string]>} synonyms rows [word, similar]
 */
export function buildLexicon(words, synonyms = []) {
  const exact = new Map();   // lower -> {word, index, count}
  const plain = new Map();   // stripped lower -> [{word,index}]
  words.forEach((w, index) => {
    const k = w.toLowerCase();
    const e = exact.get(k);
    if (e) e.count++;
    else exact.set(k, { word: w, index, count: 1 });
    const p = stripDiacritics(k);
    if (!plain.has(p)) plain.set(p, []);
    if (!plain.get(p).some((x) => x.word.toLowerCase() === k)) plain.get(p).push({ word: w, index });
  });
  const syn = new Map();
  for (const [w, s] of synonyms) {
    const k = w.toLowerCase();
    if (!syn.has(k)) syn.set(k, []);
    syn.get(k).push(s);
  }
  return { exact, plain, syn };
}

/** True if `form` is a known word with exact diacritics (dictionary or Synonyms key). */
export function hasWord(lex, form) {
  const k = form.toLowerCase();
  return lex.exact.has(k) || lex.syn.has(k);
}

function lookupOne(lex, form, kind) {
  const k = form.toLowerCase();
  if (kind === 'exact') {
    const e = lex.exact.get(k);
    return e ? { kind, entry: e.word, index: e.index, ambiguous: e.count > 1 ? e.count : 0 } : null;
  }
  if (kind === 'synonym') {
    if (lex.exact.has(k)) return null; // synonyms only when the word itself is absent
    for (const s of lex.syn.get(k) || []) {
      const se = lex.exact.get(s.toLowerCase());
      if (se) return { kind, entry: se.word, index: se.index, via: s, ambiguous: se.count > 1 ? se.count : 0 };
    }
    return null;
  }
  if (kind === 'plain') {
    const p = lex.plain.get(stripDiacritics(k));
    return p ? { kind, entry: p[0].word, index: p[0].index, uncertain: true, candidates: p.length } : null;
  }
  return null;
}

/**
 * Greedy longest-match lookup over gloss tokens.
 * A span may join tokens with "_" (e.g. ["cô","ấy"] -> "cô_ấy").
 * Spans are tried longest-first but an exact match of a shorter span beats a
 * plain (uncertain) match of a longer one.
 * @param {{kinds?: string[]}} [opts] which lookup kinds are enabled
 */
export function lookupGloss(tokens, lex, { kinds = ['exact', 'synonym', 'plain'] } = {}) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    let best = null;
    for (const kind of kinds) {
      for (let n = Math.min(MAX_SPAN, tokens.length - i); n >= 1; n--) {
        const form = tokens.slice(i, i + n).join('_');
        const r = lookupOne(lex, form, kind);
        if (r) { best = { ...r, form, span: n }; break; }
      }
      if (best) break;
    }
    if (best) {
      out.push({ token: tokens.slice(i, i + best.span).join(' '), ...best });
      i += best.span;
    } else {
      out.push({ token: tokens[i], kind: 'missing' });
      i++;
    }
  }
  return out;
}
