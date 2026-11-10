"""Build data/pack/demo_pack.json for demo.html (local only, third-party data).

Steps:
  1. `node tools/pack_node.mjs inputs` -> demo sentences (M3 "ký được hoàn toàn":
     reference gloss fully found with exact diacritics + Synonyms, NO stripped
     matches) and the dictionary entries they need (reference + rule gloss).
  2. Build each needed entry's <hns_sign> with tools/dict_to_sigml.py logic
     (same valid-tag scan, same drop rules). Entries that fail are left out and
     sentences needing them are removed from the demo list.
  3. Write the pack, then `node tools/pack_node.mjs check` runs the browser
     pipeline on the pack only; every composed <sigml> is parsed with xml.etree.

Usage: python tools/build_pack.py [--data DIR] [--bsl DIR] [--jas DIR] [--out FILE]
"""
import argparse
import collections
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dict_to_sigml as d2s  # noqa: E402


def run_node(*args):
    r = subprocess.run(["node", "tools/pack_node.mjs", *args], capture_output=True, text=True,
                       encoding="utf-8")
    if r.returncode != 0:
        sys.exit(f"node failed: {r.stderr}")
    return json.loads(r.stdout)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", default="data/external/vsl-hamnosys")
    ap.add_argument("--bsl", default="BSLExamples")
    ap.add_argument("--jas", default="jas/loc2025")
    ap.add_argument("--out", default="data/pack/demo_pack.json")
    args = ap.parse_args(argv)

    inp = run_node("inputs", "--data", args.data)
    hand_ref, nm_ref, _notes = d2s.scan_references(Path(args.bsl), Path(args.jas))
    _header, rows = d2s.load_dictionary(Path(args.data) / d2s.DICT_FILE)

    stats = {"drop": collections.Counter(), "unknown_hand_tags": collections.Counter(),
             "mapped_nm": collections.Counter(), "skipped_nm": collections.Counter()}
    signs, failed = {}, {}
    for e in inp["entries"]:
        _line, row = rows[e["index"]]
        if row["Word"] != e["word"]:
            sys.exit(f"index mismatch at {e['index']}: {row['Word']!r} != {e['word']!r}")
        entry, reason = d2s.build_entry(row, hand_ref, nm_ref, stats)
        if entry is None:
            failed[e["index"]] = reason
            continue
        frag = d2s.to_hns_sign(entry)
        ET.fromstring(f"<sigml>{frag}</sigml>")  # well-formed
        signs[e["word"]] = frag

    ok_index = {e["index"] for e in inp["entries"] if e["index"] not in failed}
    sentences = [
        {"source": s["source"], "reference": s["reference"]}
        for s in inp["sentences"]
        if all(i in ok_index for i in s["referenceEntries"])
    ]
    used_words = set(signs)
    synonyms = [[f, w] for f, w in inp["synonyms"] if w in used_words]

    pack = {
        "meta": {
            "generator": "tools/build_pack.py",
            "source": "raianrido/VSL (GPL-3.0) - local test only, do not redistribute",
            "lookup": "exact diacritics + Synonyms (no stripped matches)",
            "sentences": len(sentences),
            "signs": len(signs),
            "synonyms": len(synonyms),
        },
        "signs": dict(sorted(signs.items())),
        "synonyms": synonyms,
        "sentences": sentences,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(pack, ensure_ascii=False, indent=1)
    out.write_text(text + "\n", encoding="utf-8", newline="\n")

    # End-to-end check through the browser pipeline (pack only).
    checked = run_node("check", "--pack", str(out))
    xml_ok = xml_bad = 0
    src_full = ref_full = src_uncertain = 0
    src_missing = collections.Counter()
    for c in checked:
        for side in ("source", "reference"):
            sg = c[side]["sigml"]
            if sg:
                try:
                    root = ET.fromstring(sg)
                    assert root.tag == "sigml" and all(ch.tag == "hns_sign" for ch in root)
                    xml_ok += 1
                except (ET.ParseError, AssertionError):
                    xml_bad += 1
        if not c["source"]["missing"]:
            src_full += 1
        src_missing.update(c["source"]["missing"])
        if not c["reference"]["missing"]:
            ref_full += 1
        if c["source"]["uncertain"]:
            src_uncertain += 1

    print(f"unique_pairs={inp['uniquePairs']} candidate_sentences={len(inp['sentences'])} "
          f"kept_sentences={len(sentences)}")
    print(f"entries_needed={len(inp['entries'])} signs={len(signs)} failed={len(failed)} "
          f"{dict(collections.Counter(failed.values()))} synonyms={len(synonyms)}")
    print(f"pack_bytes_on_disk={out.stat().st_size} -> {out}")
    print(f"check: composed_sigml_xml_ok={xml_ok} xml_bad={xml_bad}")
    print(f"check: reference_fully_signed={ref_full}/{len(checked)} "
          f"rule_gloss_fully_signed={src_full}/{len(checked)} "
          f"rule_gloss_with_uncertain={src_uncertain}")
    print(f"check: rule_gloss_missing_token_types={len(src_missing)} "
          f"occurrences={sum(src_missing.values())}")
    if xml_bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
