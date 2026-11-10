"""Convert the VSL HamNoSys dictionary into SiGML <hns_sign> documents.

Valid tag/value sets are scanned at runtime from read-only reference material:
  - BSLExamples/**/*.sigml            (hns_sign examples)
  - jas/loc2025/sigml/*.sigml         (hns_sign + gestural nonmanual examples)
  - jas/loc2025/cwa/h2s.xsl           (hnm_* -> gestural element mapping, verified pass-through)
  - jas/loc2025/cwa/allcsa.js         (quoted "ham..." strings = HamNoSys tag table in CWASA)
Nothing in jas/ or BSLExamples/ is modified.

Writes:
  <test-out>/*.sigml               selected test entries (git-ignored)
  <reports>/m2_selection.md        concrete selection details (git-ignored)
  docs/SIGML_REPORT.md             statistics only

Usage: python tools/dict_to_sigml.py [--data DIR] [--bsl DIR] [--jas DIR]
                                     [--test-out DIR] [--reports DIR] [--report FILE]
"""
import argparse
import collections
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import quoteattr

DICT_FILE = "Dictionary VSL HamNoSys"
HAM_RE = re.compile(r"^ham[a-z0-9]+$")
MOUTH_CODE_RE = re.compile(r"^[A-Z]\d\d$")

# Dictionary column -> (hns element, gestural element, gestural attribute).
# Order follows the hamnosys_nonmanual content model quoted in jas h2s.xsl.
NM_COLUMNS = [
    ("Shoulder", "hnm_shoulder", "shoulder_movement", "movement"),
    ("Body", "hnm_body", "body_movement", "movement"),
    ("Head", "hnm_head", "head_movement", "movement"),
    ("Eyegaze", "hnm_eyegaze", "eye_gaze", "direction"),
    ("Eyebrow", "hnm_eyebrows", "eye_brows", "movement"),
    ("Eyelids", "hnm_eyelids", "eye_lids", "movement"),
    ("Mouth", "hnm_mouthgesture", "mouth_gesture", "movement"),
]

SELECT_MIN_TAGS, SELECT_MAX_TAGS = 8, 25
N_DIGITS, N_COMMON = 3, 5


def strip_diacritics(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", s)
                   if unicodedata.category(ch) != "Mn")


# ---------------------------------------------------------------- reference scan
def scan_references(bsl_dir, jas_dir):
    """Return (hand_tags: {tag: set(sources)}, nm_values: {column: {value: set(sources)}}, notes)."""
    hand = collections.defaultdict(set)
    nm = {c: collections.defaultdict(set) for c, *_ in NM_COLUMNS}
    notes = []
    hns_to_col = {h: c for c, h, _, _ in NM_COLUMNS}
    gest_to_col = {(g, a): c for c, _, g, a in NM_COLUMNS}

    def scan_sigml(path, source):
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"<hamnosys_manual>(.*?)</hamnosys_manual>", text, re.S):
            for t in re.findall(r"<(ham[a-z0-9]+)\s*/>", m.group(1)):
                hand[t].add(source)
        for el, val in re.findall(r'<(hnm_[a-z]+)\s+tag\s*=\s*"([^"]*)"', text):
            if el in hns_to_col:
                nm[hns_to_col[el]][val].add(source)
        for el, attr, val in re.findall(r'<([a-z_]+)\s+([a-z_]+)\s*=\s*"([^"]*)"', text):
            col = gest_to_col.get((el, attr))
            if col:
                nm[col][val].add(source + "(gestural)")

    bsl_files = sorted(bsl_dir.rglob("*.sigml")) if bsl_dir.exists() else []
    for p in bsl_files:
        scan_sigml(p, "BSLExamples")
    notes.append(f"BSLExamples: {len(bsl_files)} file .sigml")

    jas_sigml = jas_dir / "sigml"
    jas_files = sorted(jas_sigml.glob("*.sigml")) if jas_sigml.exists() else []
    for p in jas_files:
        scan_sigml(p, "jas/sigml")
    notes.append(f"jas/loc2025/sigml: {len(jas_files)} file .sigml")

    # Verify h2s.xsl maps every hnm_* element we use by copying @tag verbatim.
    h2s = jas_dir / "cwa" / "h2s.xsl"
    h2s_ok = {}
    if h2s.exists():
        x = h2s.read_text(encoding="utf-8", errors="replace")
        for col, hns, gest, attr in NM_COLUMNS:
            pat = (r'<xsl:template match="' + hns + r'">.*?<xsl:element name="' + gest +
                   r'">\s*<xsl:attribute name="' + attr + r'">\s*<xsl:value-of select="@tag"/>')
            h2s_ok[col] = bool(re.search(pat, x, re.S))
        notes.append("h2s.xsl: ánh xạ hnm_*→gestural sao chép nguyên @tag: " +
                     ", ".join(f"{c}={'có' if v else 'KHÔNG'}" for c, v in h2s_ok.items()))
    else:
        notes.append("h2s.xsl: không tìm thấy")
    # Gestural values only count if h2s confirms the pass-through for that column.
    for col, vals in nm.items():
        if not h2s_ok.get(col):
            for v in list(vals):
                vals[v] = {s for s in vals[v] if not s.endswith("(gestural)")}
                if not vals[v]:
                    del vals[v]

    allcsa = jas_dir / "cwa" / "allcsa.js"
    if allcsa.exists():
        js = allcsa.read_text(encoding="utf-8", errors="replace")
        found = set(re.findall(r'"(ham[a-z0-9]+)"', js))
        for t in found:
            hand[t].add("allcsa.js")
        notes.append(f"allcsa.js: {len(found)} chuỗi \"ham...\" (bảng thẻ HamNoSys trong CWASA)")
    else:
        notes.append("allcsa.js: không tìm thấy")
    notes.append("Không tìm thấy file lược đồ DTD/XSD/RNG riêng trong jas/loc2025; "
                 "devdoc/index.html chỉ trỏ tới javadoc dạng ZIP.")
    return hand, nm, notes


# ---------------------------------------------------------------- dictionary
def load_dictionary(path):
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    header = lines[0].split("\t")
    rows = []
    for i, l in enumerate(lines[1:], start=2):  # file line number
        if l.strip():
            rows.append((i, dict(zip(header, l.split("\t")))))
    return header, rows


def parens_balanced(tokens):
    depth = 0
    for t in tokens:
        if t == "hamparbegin":
            depth += 1
        elif t == "hamparend":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


def build_entry(row, hand_valid, nm_valid, stats):
    """Return (entry dict or None, drop_reason)."""
    tokens = [t.strip() for t in row["Hand"].split(",") if t.strip()]
    if not tokens:
        return None, "hand_empty"
    if any(not HAM_RE.match(t) for t in tokens):
        return None, "malformed_token"
    if not parens_balanced(tokens):
        return None, "unbalanced_par"
    unknown = [t for t in tokens if t not in hand_valid]
    if unknown:
        stats["unknown_hand_tags"].update(unknown)
        return None, "unknown_hand_tag"

    nonmanual = []
    for col, hns, _, _ in NM_COLUMNS:
        v = (row.get(col) or "").strip()
        if not v:
            continue
        if col == "Mouth" and not MOUTH_CODE_RE.match(v):
            stats["skipped_nm"]["Mouth:text"] += 1
            continue
        if v in nm_valid[col]:
            nonmanual.append((hns, v))
            stats["mapped_nm"][f"{col}:{v}"] += 1
        else:
            stats["skipped_nm"][f"{col}:{v}"] += 1
    return {"word": row["Word"], "hand": tokens, "nonmanual": nonmanual}, None


def to_hns_sign(entry, indent="  "):
    """One <hns_sign> element (no <sigml> wrapper), lines joined by newline."""
    i1, i2, i3 = indent, indent * 2, indent * 3
    out = [f"{i1}<hns_sign gloss={quoteattr(entry['word'])}>", f"{i2}<hamnosys_nonmanual>"]
    out += [f'{i3}<{el} tag={quoteattr(v)}/>' for el, v in entry["nonmanual"]]
    out += [f"{i2}</hamnosys_nonmanual>", f"{i2}<hamnosys_manual>"]
    out += [f"{i3}<{t}/>" for t in entry["hand"]]
    out += [f"{i2}</hamnosys_manual>", f"{i1}</hns_sign>"]
    return "\n".join(out)


def to_sigml(entry):
    return "<sigml>\n" + to_hns_sign(entry) + "\n</sigml>\n"


def validate(xml_text, entry):
    root = ET.fromstring(xml_text)
    assert root.tag == "sigml"
    sign = root.find("hns_sign")
    assert sign is not None and sign.get("gloss") == entry["word"]
    manual = sign.find("hamnosys_manual")
    assert [c.tag for c in manual] == entry["hand"]
    nm = sign.find("hamnosys_nonmanual")
    assert [(c.tag, c.get("tag")) for c in nm] == entry["nonmanual"]


# ---------------------------------------------------------------- selection
def select(entries, word_counts, target_freq):
    """Pick digits and common words; return (picked, rejected) with reasons."""
    picked, rejected = [], []

    def check(e):
        reasons = []
        if word_counts[e["word"]] != 1:
            reasons.append(f"{word_counts[e['word']]} mục trùng từ")
        n = len(e["hand"])
        if not (SELECT_MIN_TAGS <= n <= SELECT_MAX_TAGS):
            reasons.append(f"{n} thẻ Hand (ngoài {SELECT_MIN_TAGS}-{SELECT_MAX_TAGS})")
        return reasons

    by_word = collections.defaultdict(list)
    for e in entries:
        by_word[e["word"]].append(e)

    # Digits: smallest numbers first.
    digit_words = sorted((w for w in by_word if w.isdigit()), key=int)
    for w in digit_words:
        if sum(1 for p in picked if p["kind"] == "chữ số") >= N_DIGITS:
            break
        r = check(by_word[w][0])
        if r:
            rejected.append({"word": w, "kind": "chữ số", "reasons": r})
        else:
            picked.append({**by_word[w][0], "kind": "chữ số",
                           "why": f"chữ số nhỏ, {len(by_word[w][0]['hand'])} thẻ"})

    # Common words: most frequent target tokens in DataTrain1 that are dictionary words.
    for w, f in target_freq.most_common():
        if sum(1 for p in picked if p["kind"] == "từ thông dụng") >= N_COMMON:
            break
        if w.isdigit() or w not in by_word:
            continue
        r = check(by_word[w][0])
        if r:
            rejected.append({"word": w, "kind": "từ thông dụng", "freq": f, "reasons": r})
        else:
            picked.append({**by_word[w][0], "kind": "từ thông dụng",
                           "why": f"xuất hiện {f} lần ở vế đích DataTrain1, "
                                  f"{len(by_word[w][0]['hand'])} thẻ"})
    return picked, rejected


def safe_name(idx, word):
    slug = re.sub(r"[^A-Za-z0-9_]+", "_", strip_diacritics(word)).strip("_") or "x"
    return f"{idx:02d}_{slug}.sigml"


# ---------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", default="data/external/vsl-hamnosys")
    ap.add_argument("--bsl", default="BSLExamples")
    ap.add_argument("--jas", default="jas/loc2025")
    ap.add_argument("--test-out", default="data/sigml/test")
    ap.add_argument("--reports", default="data/reports")
    ap.add_argument("--report", default="docs/SIGML_REPORT.md")
    args = ap.parse_args(argv)

    data_dir = Path(args.data)
    if not (data_dir / DICT_FILE).exists():
        sys.exit(f"missing {data_dir / DICT_FILE}")
    hand_ref, nm_ref, notes = scan_references(Path(args.bsl), Path(args.jas))
    if not any(nm_ref.values()):
        sys.exit("Không có giá trị phi tay nào trong tài liệu tham chiếu -> dừng.")

    header, rows = load_dictionary(data_dir / DICT_FILE)
    stats = {"drop": collections.Counter(), "unknown_hand_tags": collections.Counter(),
             "mapped_nm": collections.Counter(), "skipped_nm": collections.Counter()}
    entries = []
    drop_lines = collections.defaultdict(list)
    xml_ok = xml_fail = 0
    for line_no, row in rows:
        e, reason = build_entry(row, hand_ref, nm_ref, stats)
        if e is None:
            stats["drop"][reason] += 1
            drop_lines[reason].append(line_no)
            continue
        try:
            validate(to_sigml(e), e)
            xml_ok += 1
        except (ET.ParseError, AssertionError):
            xml_fail += 1
            stats["drop"]["xml_invalid"] += 1
            continue
        e["line"] = line_no
        entries.append(e)

    word_counts = collections.Counter(r["Word"] for _, r in rows)
    dict_words = set(word_counts)
    target_freq = collections.Counter()
    for l in (data_dir / "DataTrain1.txt").read_text(encoding="utf-8-sig").splitlines():
        parts = l.split("\t")
        if len(parts) == 2:
            target_freq.update(t for t in parts[1].split() if t in dict_words)
    picked, rejected = select(entries, word_counts, target_freq)

    # Write test files (git-ignored).
    out = Path(args.test_out)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for i, e in enumerate(picked, 1):
        name = safe_name(i, e["word"])
        text = to_sigml(e)
        (out / name).write_text(text, encoding="utf-8")
        # Re-parse from disk.
        ET.parse(out / name)
        validate((out / name).read_text(encoding="utf-8"), e)
        written.append((name, e))

    # Concrete details (git-ignored).
    rep_dir = Path(args.reports)
    rep_dir.mkdir(parents=True, exist_ok=True)
    R = ["# M2 selection (local only, third-party data)", "", "## Chọn"]
    for name, e in written:
        R.append(f"- `{name}` gloss={e['word']!r} dòng {e['line']} [{e['kind']}] {e['why']}; "
                 f"phi tay={e['nonmanual']}")
    R += ["", "## Ứng viên bị loại"]
    R += [f"- {r['word']!r} [{r['kind']}]" + (f" tần suất {r['freq']}" if "freq" in r else "") +
          ": " + "; ".join(r["reasons"]) for r in rejected]
    R += ["", "## Dòng bị bỏ (số dòng trong file từ điển, tính cả tiêu đề)"]
    R += [f"- {k}: {v}" for k, v in drop_lines.items()]
    R += ["", "## Thẻ Hand không có trong tập tham chiếu", str(stats["unknown_hand_tags"].most_common())]
    (rep_dir / "m2_selection.md").write_text("\n".join(R) + "\n", encoding="utf-8")

    write_report(Path(args.report), notes, hand_ref, nm_ref, rows, entries, stats,
                 xml_ok, xml_fail, written, rejected)

    print(f"rows={len(rows)} generated={len(entries)} dropped={sum(stats['drop'].values())} "
          f"{dict(stats['drop'])}")
    print(f"xml_ok={xml_ok} xml_fail={xml_fail} test_files={len(written)} -> {out}")
    print(f"wrote {args.report} and {rep_dir / 'm2_selection.md'}")


def write_report(path, notes, hand_ref, nm_ref, rows, entries, stats, xml_ok, xml_fail,
                 written, rejected):
    L = []
    a = L.append
    a("# Báo cáo Từ điển → SiGML (M2)\n")
    a("> Sinh tự động bởi `tools/dict_to_sigml.py`. Chỉ thống kê, tên thẻ, tỉ lệ; không chép mục "
      "từ điển. Chi tiết cụ thể ở `data/reports/m2_selection.md` (không commit).\n")
    a("## 1. Nguồn tập thẻ hợp lệ (chỉ đọc)\n")
    for n in notes:
        a(f"- {n}")
    src_count = dict(sorted(collections.Counter(s for v in hand_ref.values() for s in v).items()))
    a(f"- Tập thẻ Hand hợp lệ (hợp các nguồn): {len(hand_ref)} thẻ; theo nguồn: {dict(src_count)}")
    a("- Lưu ý: allcsa.js là mã đã rút gọn; chuỗi \"ham...\" trong đó được coi là bảng thẻ CWASA "
      "nhận biết, nhưng chưa kiểm chứng bằng cách chạy avatar.\n")
    a("### Giá trị phi tay hợp lệ theo cột (cột từ điển → thẻ hns)\n")
    a("| Cột | Thẻ hns | Số giá trị hợp lệ | Giá trị dùng trong từ điển có trong tập? |")
    a("|---|---|---|---|")
    used = collections.defaultdict(collections.Counter)
    for _, r in rows:
        for col, *_ in NM_COLUMNS:
            v = (r.get(col) or "").strip()
            if v:
                used[col][v] += 1
    for col, hns, _, _ in NM_COLUMNS:
        u = used[col]
        if col == "Mouth":
            codes = {v: n for v, n in u.items() if MOUTH_CODE_RE.match(v)}
            ok = sum(n for v, n in codes.items() if v in nm_ref[col])
            txt = sum(n for v, n in u.items() if not MOUTH_CODE_RE.match(v))
            desc = (f"mã: {ok}/{sum(codes.values())} ô hợp lệ ({len(codes)} mã khác nhau); "
                    f"{txt} ô chữ viết → bỏ, không chuyển thành khẩu hình")
        elif not u:
            desc = "cột rỗng"
        else:
            desc = ", ".join(f"{v}:{n} ô → {'hợp lệ' if v in nm_ref[col] else 'KHÔNG có, bỏ'}"
                             for v, n in u.most_common())
        a(f"| {col} | `{hns}` | {len(nm_ref[col])} | {desc} |")
    ad = nm_ref["Eyegaze"].get("AD")
    a("")
    a(f"- **Eyegaze `AD`**: {'hợp lệ' if ad else 'không tìm thấy'}"
      + (f" — nguồn: {sorted(ad)}. Trong jas/loc2025/sigml/nonmanuals-eyegaze.sigml có "
         "`<eye_gaze direction=\"AD\"/>` (gloss \"AD_towards_addressee\"), và h2s.xsl chuyển "
         "`hnm_eyegaze/@tag` sang `eye_gaze/@direction` nguyên văn → ánh xạ `hnm_eyegaze tag=\"AD\"`."
         if ad else " → bỏ qua."))
    a("- **Kết luận:** SiGML sinh ra gần như chỉ có tay, cùng lông mày `RB`, mắt nhắm/chớp `BB` "
      "và nhìn `AD` (Body/Head/Shoulder rỗng trong dữ liệu gốc; Mouth chỉ có số ít mã).\n")
    a("## 2. Kết quả chuyển đổi toàn bộ từ điển (trong bộ nhớ)\n")
    a(f"- Số mục đọc: {len(rows)}")
    a(f"- Sinh được và qua kiểm tra xml.etree: **{len(entries)}** (xml_ok={xml_ok}, xml_fail={xml_fail})")
    a(f"- Bị bỏ: **{sum(stats['drop'].values())}**")
    labels = {"unbalanced_par": "ngoặc hamparbegin/hamparend không cân bằng",
              "malformed_token": "token Hand sai dạng (không khớp `ham[a-z0-9]+`)",
              "unknown_hand_tag": "thẻ Hand không có trong tập hợp lệ",
              "hand_empty": "Hand rỗng", "xml_invalid": "XML không hợp lệ"}
    for k, v in stats["drop"].most_common():
        a(f"  - {labels.get(k, k)}: {v}")
    if stats["unknown_hand_tags"]:
        a(f"- Thẻ Hand lạ: {dict(stats['unknown_hand_tags'].most_common())}")
    a("- Phi tay đã ánh xạ (lượt): " + ", ".join(f"{k}={v}" for k, v in stats["mapped_nm"].most_common()))
    sk = stats["skipped_nm"]
    a("- Phi tay bỏ qua (lượt): " + (", ".join(f"{k}={v}" for k, v in sk.most_common()) or "không"))
    a("- Từ trùng: không gộp; mỗi dòng sinh một hns_sign riêng. Khi chọn mục thử, chỉ lấy từ có đúng 1 mục.\n")
    a("## 3. Mục thử (`data/sigml/test/`, không commit)\n")
    a(f"- Tiêu chí: mọi thẻ Hand và giá trị phi tay nằm trong tập hợp lệ; từ chỉ có 1 mục; "
      f"{SELECT_MIN_TAGS}-{SELECT_MAX_TAGS} thẻ Hand; {N_DIGITS} chữ số nhỏ nhất đạt tiêu chí + "
      f"{N_COMMON} từ xuất hiện nhiều nhất ở vế đích DataTrain1 đạt tiêu chí.")
    kinds = collections.Counter(e["kind"] for _, e in written)
    a(f"- Đã ghi {len(written)} file ({dict(kinds)}); mỗi file được đọc lại từ đĩa bằng "
      "`xml.etree.ElementTree.parse` và đối chiếu cấu trúc.")
    a(f"- Số thẻ Hand trong các mục thử: {sorted(len(e['hand']) for _, e in written)}")
    a(f"- Có `hamparbegin`: {sum('hamparbegin' in e['hand'] for _, e in written)}/{len(written)}")
    rc = collections.Counter(reason.split(' (')[0].split(' ', 1)[1] if reason[0].isdigit() else reason
                             for r in rejected for reason in r["reasons"])
    a(f"- Ứng viên bị loại: {len(rejected)}; lý do: {dict(rc)}")
    a("\n## 4. Chưa kiểm chứng\n")
    a("- Chưa phát các file trên avatar CWASA (việc sau M3).")
    a("- Tập thẻ từ allcsa.js suy từ chuỗi trong mã, chưa có lược đồ chính thức.")
    a("- Chưa có người hiểu VSL xác nhận ký hiệu.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
