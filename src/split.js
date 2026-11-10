// Deterministic train/test split over UNIQUE pairs.
// Pairs are grouped by their diacritic-stripped form so that a pair and its
// unsigned twin (DataTrain2) always land on the same side.

export function stripDiacritics(s) {
  return s
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

// mulberry32 PRNG: small, seedable, deterministic across platforms.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array<[string,string]>} signed   DataTrain1 pairs
 * @param {Array<[string,string]>} unsigned DataTrain2 pairs (same line order)
 * @returns {{train: Group[], test: Group[], stats: object}}
 * Group = { key, signed: [src,tgt][] (unique), unsigned: [src,tgt][] (unique), lines: number[] }
 */
export function splitPairs(signed, unsigned, { seed = 20261110, testRatio = 0.3 } = {}) {
  if (signed.length !== unsigned.length) throw new Error('length mismatch');
  const groups = new Map();
  signed.forEach(([s, t], i) => {
    const key = stripDiacritics(s) + '\t' + stripDiacritics(t);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, signed: new Map(), unsigned: new Map(), lines: [] }));
    g.signed.set(s + '\t' + t, [s, t]);
    const [us, ut] = unsigned[i];
    g.unsigned.set(us + '\t' + ut, [us, ut]);
    g.lines.push(i + 1);
  });
  const list = [...groups.values()]
    .map((g) => ({ ...g, signed: [...g.signed.values()], unsigned: [...g.unsigned.values()] }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const rnd = mulberry32(seed);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const nTest = Math.round(list.length * testRatio);
  const test = list.slice(0, nTest);
  const train = list.slice(nTest);
  const uniqueSigned = new Set(signed.map(([s, t]) => s + '\t' + t)).size;
  return {
    train,
    test,
    stats: {
      lines: signed.length,
      uniqueSignedPairs: uniqueSigned,
      groups: list.length,
      groupsWithMultipleSignedVariants: list.filter((g) => g.signed.length > 1).length,
      train: train.length,
      test: test.length,
      seed,
      testRatio,
    },
  };
}
