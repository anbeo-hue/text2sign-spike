// Text -> segmented tokens -> gloss (M3 rules) -> lookups -> SiGML.
// Shared by demo.html and the Node pack checker so both run the same code.
import { segment } from './segmenter.js';
import { textToGloss } from './gloss_rules.js';
import { lookupGloss } from './lexicon.js';
import { composeSiGML } from './sigml_compose.js';

export const DEMO_LOOKUP_KINDS = ['exact', 'synonym', 'plain'];

/**
 * @param {string} text
 * @param {object} lex buildLexicon() result
 * @param {Record<string,string>} signs entry word -> hns_sign fragment
 * @param {{kinds?: string[], enableQuestion?: boolean}} [opts]
 */
export function textToSiGML(text, lex, signs, { kinds = DEMO_LOOKUP_KINDS, enableQuestion = false } = {}) {
  const segmented = segment(text, lex);
  const g = textToGloss(segmented.join(' '), { enableQuestion });
  const lookups = lookupGloss(g.tokens, lex, { kinds });
  const composed = composeSiGML(lookups, signs);
  return { segmented, gloss: g.gloss, applied: g.applied, lookups, ...composed };
}
