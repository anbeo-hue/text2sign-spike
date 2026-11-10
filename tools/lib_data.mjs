// Node-only loaders for the (git-ignored) third-party VSL dataset.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_DATA = 'data/external/vsl-hamnosys';

function lines(path) {
  return readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
}

/** All pair lines (blank/half-empty kept, so line i of DataTrain1 aligns with DataTrain2). */
export function loadPairs(dataDir, file) {
  const raw = readFileSync(join(dataDir, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  if (raw.length && raw[raw.length - 1] === '') raw.pop();
  return raw.map((l) => {
    const p = l.split('\t');
    if (p.length !== 2) throw new Error(`bad line in ${file}: ${l.slice(0, 40)}`);
    return [p[0].trim(), p[1].trim()];
  });
}

/** Keep aligned pairs where both sides of the signed pair are non-empty. */
export function alignedNonEmpty(signed, unsigned) {
  const s = [], u = [];
  let blank = 0, half = 0;
  signed.forEach((p, i) => {
    if (!p[0] && !p[1]) blank++;
    else if (!p[0] || !p[1]) half++;
    else { s.push(p); u.push(unsigned[i]); }
  });
  return { signed: s, unsigned: u, blank, half };
}

/** Dictionary word list in file order (duplicates kept). */
export function loadDictionaryWords(dataDir) {
  const ls = lines(join(dataDir, 'Dictionary VSL HamNoSys'));
  const header = ls[0].split('\t');
  const wi = header.indexOf('Word');
  return ls.slice(1).map((l) => l.split('\t')[wi]);
}

/** Synonyms as [word, similar] rows, header skipped. */
export function loadSynonyms(dataDir) {
  const ls = lines(join(dataDir, 'Synonyms.txt'));
  return ls.slice(1).map((l) => l.split('\t')).filter((r) => r.length === 2);
}
