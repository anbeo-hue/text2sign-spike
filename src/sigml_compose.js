// Compose one <sigml> document from dictionary lookups. Pure ES module.
//
// `signs` maps a dictionary entry word -> its <hns_sign>...</hns_sign> fragment
// (generated offline by tools/build_pack.py). Lookups without a sign are
// reported as missing; they are NOT fingerspelled (not implemented yet).

/**
 * @param {Array<{token:string, kind:string, entry?:string, uncertain?:boolean, via?:string}>} lookups
 *   output of lookupGloss()
 * @param {Record<string,string>} signs
 * @returns {{sigml: string, signed: object[], missing: string[], uncertain: object[]}}
 */
export function composeSiGML(lookups, signs) {
  const parts = [];
  const signed = [];
  const missing = [];
  for (const r of lookups) {
    const frag = r.kind !== 'missing' && r.entry != null ? signs[r.entry] : undefined;
    if (!frag) { missing.push(r.token); continue; }
    parts.push(frag);
    signed.push({ token: r.token, entry: r.entry, kind: r.kind, uncertain: !!r.uncertain, via: r.via });
  }
  const sigml = parts.length ? `<sigml>\n${parts.join('\n')}\n</sigml>\n` : '';
  return { sigml, signed, missing, uncertain: signed.filter((s) => s.uncertain) };
}
