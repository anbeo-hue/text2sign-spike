// Rule-based Vietnamese text -> VSL gloss (word order of the VSL HamNoSys dataset).
// Pure ES module, no I/O: works in the browser and in Node.
//
// Every rule group is a small, explainable function tokens -> tokens that logs
// what it did. Word lists were chosen by inspecting ONLY the training split
// (see tools/eval_gloss.mjs); they describe the dataset, not verified VSL grammar.

export const PUNCT = new Set([',', '.', '!', '?', ':', ';', '"', '“', '”', '…', '...', '(', ')', '-', '–']);

// Function words deleted in the targets in most of their training occurrences
// (deletion rate >= ~0.65 and >= 8 occurrences in train; kept only if the
// group did not reduce train exact match, see docs/GLOSS_REPORT.md).
export const DELETE_WORDS = new Set([
  'thì', 'là', 'đã', 'mà', 'cũng', 'của', 'rất', 'để', 'sẽ', 'càng', 'đấy', 'những', 'vẫn',
  'à', 'ạ', 'nữa', 'lại', 'chỉ',
]);

// Classifiers deleted before a noun. In training targets "quyển/cuốn/con/các"
// are usually kept, so only "cái" and "chiếc" are deleted.
export const CLASSIFIERS = new Set(['cái', 'chiếc']);
export const CLASSIFIER_KEEP_NEXT = new Set(['này', 'kia', 'ấy', 'đó', 'nào']); // "cái này" etc.

export const NEGATIONS = new Set(['không', 'chẳng', 'chưa', 'đừng', 'chả']);
// "không phải", "không hết", "chẳng có" stay in place in training targets.
export const NEGATION_KEEP_NEXT = new Set(['phải', 'hết', 'có']);

export const QUESTION_WORDS = new Set(['ai', 'gì', 'nào', 'đâu', 'bao_nhiêu', 'mấy', 'bao_giờ', 'sao']);
// Words marking a multi-clause sentence; question movement is skipped there.
export const CLAUSE_MARKERS = new Set([',', 'thì', 'nhưng', 'vì', 'mà', 'nếu', 'khi']);

export const NUMBER_WORDS = new Map([
  ['hai', '2'], ['ba', '3'], ['bốn', '4'], ['năm', '5'], ['sáu', '6'], ['bảy', '7'],
  ['tám', '8'], ['chín', '9'], ['mười', '10'],
]);

// Transitive verbs seen with an object in training sentences.
// ("làm", "chơi" removed: mostly not followed by an object in training sentences.)
export const VERBS = new Set([
  'thích', 'xem', 'đọc', 'nghe', 'hút', 'mua', 'lấy', 'mở', 'ăn', 'uống', 'học',
  'viết', 'đánh', 'cấm', 'yêu', 'mặc', 'gặp', 'tìm', 'bán', 'nấu', 'giặt', 'vẽ',
]);
export const VERB_MODIFIERS = new Set(['nhất', 'được', 'xong']);

/** Rule groups in application order. */
export const RULE_GROUPS = ['punctuation', 'function_words', 'classifiers', 'numbers', 'negation', 'object_verb', 'question'];

const lc = (t) => t.toLowerCase();

export function tokenize(text) {
  return text
    .replace(/\.\.\./g, ' … ')
    .replace(/([,.!?:;"“”…()])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
}

// ------------------------------------------------------------------ groups
const GROUPS = {
  punctuation(tokens, log) {
    return tokens.filter((t) => {
      if (PUNCT.has(t)) { log('punctuation', 'drop', t); return false; }
      return true;
    });
  },

  function_words(tokens, log) {
    if (tokens.length <= 1) return tokens;
    const out = tokens.filter((t) => {
      if (DELETE_WORDS.has(lc(t))) { log('function_words', 'drop', t); return false; }
      return true;
    });
    return out.length ? out : tokens; // never delete everything
  },

  classifiers(tokens, log) {
    const out = [];
    tokens.forEach((t, i) => {
      const next = tokens[i + 1];
      if (CLASSIFIERS.has(lc(t)) && next && !CLASSIFIER_KEEP_NEXT.has(lc(next))
          && !NUMBER_WORDS.has(lc(next)) && !QUESTION_WORDS.has(lc(next))) {
        log('classifiers', 'drop', t);
        return;
      }
      out.push(t);
    });
    return out;
  },

  // "<number word> N" -> "N <digit>"  (few examples: not a confident rule)
  numbers(tokens, log) {
    const out = [...tokens];
    for (let i = 0; i < out.length - 1; i++) {
      const d = NUMBER_WORDS.get(lc(out[i]));
      const next = out[i + 1];
      if (d && next && !/^\d+$/.test(next) && !NUMBER_WORDS.has(lc(next)) && !QUESTION_WORDS.has(lc(next))) {
        log('numbers', 'num-after-noun', `${out[i]} ${next}`);
        out.splice(i, 2, next, d);
        i++;
      }
    }
    return out;
  },

  // "NEG X" -> "X NEG"  (negation after the predicate)
  negation(tokens, log) {
    const out = [...tokens];
    for (let i = 0; i < out.length - 1; i++) {
      const next = lc(out[i + 1]);
      if (NEGATIONS.has(lc(out[i])) && !NEGATIONS.has(next) && !QUESTION_WORDS.has(next)
          && !NEGATION_KEEP_NEXT.has(next)) {
        log('negation', 'neg-after', `${out[i]} ${out[i + 1]}`);
        [out[i], out[i + 1]] = [out[i + 1], out[i]];
        i++;
      }
    }
    return out;
  },

  // "S V(+V)(+mod) O" -> "S O V..": object before the verb chain.
  object_verb(tokens, log) {
    const isVerb = (t) => VERBS.has(lc(t));
    const i = tokens.findIndex((t, k) => k > 0 && isVerb(t));
    if (i < 0) return tokens;
    let j = i;
    const chain = [];
    while (j < tokens.length && (isVerb(tokens[j]) || (chain.length && VERB_MODIFIERS.has(lc(tokens[j]))))) {
      if (VERB_MODIFIERS.has(lc(tokens[j])) && chain.length) chain[chain.length - 1].push(tokens[j]);
      else chain.push([tokens[j]]);
      j++;
    }
    const object = tokens.slice(j);
    if (!object.length || object.some((t) => isVerb(t) || QUESTION_WORDS.has(lc(t)) || NEGATIONS.has(lc(t)))) {
      return tokens;
    }
    const verbs = chain.reverse().flat();
    log('object_verb', 'object-before-verb', `${verbs.join(' ')} | ${object.join(' ')}`);
    return [...tokens.slice(0, i), ...object, ...verbs];
  },

  // Move a question word (with a noun before "nào"/after "mấy") to the end.
  // Skipped for multi-clause sentences (ctx.multiClause), "gì đâu" (rhetorical
  // negation), correlative "bao_nhiêu ... bấy_nhiêu" and "bao_giờ" (often "ever").
  question(tokens, log, ctx) {
    if (ctx.multiClause) return tokens;
    const k = tokens.findIndex((t) => QUESTION_WORDS.has(lc(t)) && lc(t) !== 'bao_giờ');
    if (k < 0 || k === tokens.length - 1) return tokens;
    const w = lc(tokens[k]);
    if (w === 'gì' && tokens.some((t) => lc(t) === 'đâu')) return tokens;
    if (w === 'bao_nhiêu' && tokens.some((t) => lc(t) === 'bấy_nhiêu')) return tokens;
    let start = k, end = k + 1;
    if (w === 'nào' && k > 0) start = k - 1;               // "đứa nào" moves as a unit
    if (w === 'mấy' && k + 1 < tokens.length) {            // "mấy giờ" -> "giờ mấy"
      const out = [...tokens];
      out.splice(k, 2, tokens[k + 1], tokens[k]);
      log('question', 'mấy-after-noun', `${tokens[k]} ${tokens[k + 1]}`);
      return out;
    }
    if (start === 0 && end === tokens.length) return tokens;
    const phrase = tokens.slice(start, end);
    log('question', 'wh-to-end', phrase.join(' '));
    return [...tokens.slice(0, start), ...tokens.slice(end), ...phrase];
  },
};

/**
 * @param {string} text Vietnamese sentence (compound words may be joined with "_")
 * @param {{groups?: string[]}} [opts] subset of RULE_GROUPS to apply (order fixed)
 * @returns {{tokens: string[], gloss: string, applied: {group:string, rule:string, detail:string}[]}}
 */
export function textToGloss(text, { groups = RULE_GROUPS } = {}) {
  const applied = [];
  const log = (group, rule, detail) => applied.push({ group, rule, detail });
  let tokens = tokenize(text.trim());
  const ctx = { multiClause: tokens.some((t) => CLAUSE_MARKERS.has(lc(t))) };
  for (const g of RULE_GROUPS) {
    if (groups.includes(g)) tokens = GROUPS[g](tokens, log, ctx);
  }
  return { tokens, gloss: tokens.join(' '), applied };
}
