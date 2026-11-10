// Vietnamese word segmentation by longest syllable match against the lexicon.
// Pure ES module (browser + Node).
//
// Input units are whitespace tokens (punctuation split off by tokenize()).
// Units already joined with "_" are kept as they are. Consecutive units are
// joined with "_" when the joined form is a known word with EXACT diacritics
// (dictionary Word or Synonyms key); longest span first, up to SEGMENT_MAX_SPAN units.
// Diacritic-stripped matches are never used for segmentation.
import { tokenize, PUNCT } from './gloss_rules.js';
import { hasWord } from './lexicon.js';

// The VSL dictionary has words of up to 6 syllables (11 entries with 5-6).
export const SEGMENT_MAX_SPAN = 6;

/**
 * @param {string} text
 * @param {object} lex lexicon from buildLexicon()
 * @param {{maxSpan?: number}} [opts]
 * @returns {string[]} tokens, multi-syllable words joined by "_"
 */
export function segment(text, lex, { maxSpan = SEGMENT_MAX_SPAN } = {}) {
  const units = tokenize(text.trim());
  const out = [];
  let i = 0;
  while (i < units.length) {
    if (PUNCT.has(units[i])) { out.push(units[i]); i++; continue; }
    let taken = 1;
    for (let n = Math.min(maxSpan, units.length - i); n >= 2; n--) {
      const span = units.slice(i, i + n);
      if (span.some((u) => PUNCT.has(u))) continue;
      if (hasWord(lex, span.join('_'))) { taken = n; break; }
    }
    out.push(units.slice(i, i + taken).join('_'));
    i += taken;
  }
  return out;
}
