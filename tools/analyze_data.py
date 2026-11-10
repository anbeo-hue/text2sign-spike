"""Read-only statistics for the VSL HamNoSys dataset (raianrido/VSL, GPL-3.0).

Writes:
  docs/DATA_REPORT.md            statistics only (no verbatim entries/sentences)
  <out>/m1_examples.txt          concrete examples (git-ignored, local only)

Usage: python tools/analyze_data.py [--data DIR] [--out DIR] [--report FILE]
"""
import argparse
import collections
import re
import sys
import unicodedata
from pathlib import Path

DICT_FILE = "Dictionary VSL HamNoSys"
NON_MANUAL_COLS = ["Mouth", "Body", "Head", "Shoulder", "Eyegaze", "Eyebrow", "Eyelids"]
CODE_RE = re.compile(r"^[A-Z]{1,3}\d{0,2}$")


def read_lines(path):
    # utf-8-sig tolerates a BOM; splitlines handles CRLF
    return path.read_text(encoding="utf-8-sig").splitlines()


def strip_diacritics(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", s)
                   if unicodedata.category(ch) != "Mn")


def load_dictionary(path):
    lines = read_lines(path)
    header = lines[0].split("\t")
    rows = [l.split("\t") for l in lines[1:] if l.strip()]
    return header, rows


def load_pairs(path):
    pairs = []
    bad = 0
    for l in read_lines(path):
        parts = l.split("\t")
        if len(parts) != 2:
            bad += 1
            continue
        pairs.append((parts[0].strip(), parts[1].strip()))
    return pairs, bad


def pct(a, b):
    return f"{(100.0 * a / b):.1f}%" if b else "n/a"


def analyze(data_dir):
    s = {}
    header, rows = load_dictionary(data_dir / DICT_FILE)
    s["header"] = header
    s["n_entries"] = len(rows)
    s["col_count_dist"] = collections.Counter(len(r) for r in rows)
    col = {name: i for i, name in enumerate(header)}

    # Non-manual columns
    nm = {}
    for c in NON_MANUAL_COLS:
        vals = [r[col[c]] if col[c] < len(r) else "" for r in rows]
        nonempty = [v for v in vals if v]
        codes = [v for v in nonempty if CODE_RE.match(v)]
        nm[c] = {
            "empty": len(vals) - len(nonempty),
            "nonempty": len(nonempty),
            "code_like": collections.Counter(codes),
            "non_code": len(nonempty) - len(codes),
        }
    s["non_manual"] = nm
    words = [r[col["Word"]] for r in rows]
    mouth = [r[col["Mouth"]] for r in rows]
    s["mouth_equals_word"] = sum(1 for w, m in zip(words, mouth) if m and m == w)
    s["mouth_non_code_ascii"] = sum(1 for m in mouth if m and not CODE_RE.match(m) and m.isascii())

    # Words
    wc = collections.Counter(words)
    s["unique_words"] = len(wc)
    s["dup_words"] = sum(1 for w, n in wc.items() if n > 1)
    s["dup_extra_rows"] = sum(n - 1 for n in wc.values() if n > 1)
    s["words_with_underscore"] = sum(1 for w in wc if "_" in w)
    s["words_numeric"] = sum(1 for w in wc if w.isdigit())
    s["words_with_space"] = sum(1 for w in wc if " " in w)

    # Duplicate words with different Hand content
    by_word = collections.defaultdict(set)
    for r in rows:
        by_word[r[col["Word"]]].add(r[col["Hand"]])
    s["dup_words_diff_hand"] = sum(1 for w, hs in by_word.items() if len(hs) > 1)

    # Hand column
    hand_tokens = collections.Counter()
    hand_len = []
    par_ok = par_bad = 0
    non_ham = collections.Counter()
    empty_hand = 0
    for r in rows:
        h = r[col["Hand"]].strip()
        if not h:
            empty_hand += 1
            continue
        toks = [t.strip() for t in h.split(",") if t.strip()]
        hand_len.append(len(toks))
        hand_tokens.update(toks)
        for t in toks:
            if not re.fullmatch(r"ham[a-z0-9]+", t):
                non_ham[t] += 1
        depth = 0
        ok = True
        for t in toks:
            if t == "hamparbegin":
                depth += 1
            elif t == "hamparend":
                depth -= 1
                if depth < 0:
                    ok = False
        if depth != 0:
            ok = False
        par_ok += ok
        par_bad += (not ok)
    s["hand_empty"] = empty_hand
    s["hand_distinct_tags"] = len(hand_tokens)
    s["hand_top"] = hand_tokens.most_common(30)
    s["hand_len_min"] = min(hand_len) if hand_len else 0
    s["hand_len_max"] = max(hand_len) if hand_len else 0
    s["hand_len_mean"] = sum(hand_len) / len(hand_len) if hand_len else 0
    s["hand_par_balanced"] = par_ok
    s["hand_par_unbalanced"] = par_bad
    s["hand_non_ham_tokens"] = non_ham
    s["hand_entries_with_par"] = sum(1 for r in rows if "hamparbegin" in r[col["Hand"]])
    s["hand_entries_symm"] = sum(1 for r in rows if r[col["Hand"]].startswith("hamsymm"))

    # DataTrain
    p1, bad1 = load_pairs(data_dir / "DataTrain1.txt")
    p2, bad2 = load_pairs(data_dir / "DataTrain2.txt")
    s["dt1_n"], s["dt1_bad"] = len(p1), bad1
    s["dt2_n"], s["dt2_bad"] = len(p2), bad2
    eq_src = eq_tgt = eq_both = 0
    already_plain = 0
    for (a, b), (c, d) in zip(p1, p2):
        es, et = strip_diacritics(a) == c, strip_diacritics(b) == d
        eq_src += es
        eq_tgt += et
        eq_both += es and et
        already_plain += (a == c)
    s["dt_strip_eq_src"] = eq_src
    s["dt_strip_eq_tgt"] = eq_tgt
    s["dt_strip_eq_both"] = eq_both
    s["dt1_src_without_diacritics"] = already_plain

    pc = collections.Counter(p1)
    s["dt1_unique_pairs"] = len(pc)
    s["dt1_dup_pair_extra"] = sum(n - 1 for n in pc.values() if n > 1)
    src_to_tgt = collections.defaultdict(set)
    for a, b in p1:
        src_to_tgt[a].add(b)
    s["dt1_unique_src"] = len(src_to_tgt)
    s["dt1_src_multi_tgt"] = sum(1 for v in src_to_tgt.values() if len(v) > 1)
    s["dt1_identity_pairs"] = sum(1 for a, b in p1 if a == b)

    def toks(x):
        return x.lower().split()
    s["dt1_src_len_mean"] = sum(len(toks(a)) for a, _ in p1) / len(p1)
    s["dt1_tgt_len_mean"] = sum(len(toks(b)) for _, b in p1) / len(p1)
    same_bag = sum(1 for a, b in p1 if sorted(toks(a)) == sorted(toks(b)))
    s["dt1_same_token_bag"] = same_bag
    tgt_shorter = sum(1 for a, b in p1 if len(toks(b)) < len(toks(a)))
    s["dt1_tgt_shorter"] = tgt_shorter
    s["dt1_tgt_longer"] = sum(1 for a, b in p1 if len(toks(b)) > len(toks(a)))

    dict_lower = {w.lower() for w in wc}
    tgt_vocab = collections.Counter(t for _, b in p1 for t in toks(b))
    s["dt1_tgt_vocab"] = len(tgt_vocab)
    s["dt1_tgt_vocab_in_dict"] = sum(1 for t in tgt_vocab if t in dict_lower)
    s["dt1_tgt_tokens"] = sum(tgt_vocab.values())
    s["dt1_tgt_tokens_in_dict"] = sum(n for t, n in tgt_vocab.items() if t in dict_lower)
    src_vocab = collections.Counter(t for a, _ in p1 for t in toks(a))
    s["dt1_src_vocab"] = len(src_vocab)
    s["dt1_src_vocab_in_dict"] = sum(1 for t in src_vocab if t in dict_lower)
    s["dt1_tgt_has_digit"] = sum(1 for _, b in p1 if re.search(r"\d", b))
    s["dt1_src_has_digit"] = sum(1 for a, _ in p1 if re.search(r"\d", a))
    # Dictionary mixes Vietnamese with/without diacritics (and some English);
    # measure coverage when both sides are diacritic-stripped.
    s["dict_words_ascii"] = sum(1 for w in wc if w.isascii())
    s["dict_words_non_ascii"] = len(wc) - s["dict_words_ascii"]
    dict_plain = {strip_diacritics(w).lower() for w in wc}
    s["dict_plain_unique"] = len(dict_plain)
    s["dt1_tgt_vocab_in_dict_plain"] = sum(1 for t in tgt_vocab if strip_diacritics(t) in dict_plain)
    s["dt1_tgt_tokens_in_dict_plain"] = sum(
        n for t, n in tgt_vocab.items() if strip_diacritics(t) in dict_plain)

    # Synonyms
    syn_lines = read_lines(data_dir / "Synonyms.txt")
    s["syn_header"] = syn_lines[0].split("\t")
    syn = [l.split("\t") for l in syn_lines[1:] if l.strip()]
    s["syn_rows"] = len(syn)
    s["syn_bad_rows"] = sum(1 for r in syn if len(r) != 2)
    syn = [r for r in syn if len(r) == 2]
    syn_map = collections.defaultdict(set)
    for w, m in syn:
        syn_map[w].add(m)
    s["syn_dup_rows"] = len(syn) - len({(w, m) for w, m in syn})
    s["syn_unique_words"] = len(syn_map)
    sizes = [len(v) for v in syn_map.values()]
    s["syn_per_word_mean"] = sum(sizes) / len(sizes)
    s["syn_per_word_max"] = max(sizes)
    s["syn_word_in_dict"] = sum(1 for w in syn_map if w.lower() in dict_lower)
    sims = {m for v in syn_map.values() for m in v}
    s["syn_unique_similars"] = len(sims)
    s["syn_similar_in_dict"] = sum(1 for m in sims if m.lower() in dict_lower)
    s["syn_word_has_any_similar_in_dict"] = sum(
        1 for v in syn_map.values() if any(m.lower() in dict_lower for m in v))
    s["syn_self_rows"] = sum(1 for w, m in syn if w == m)
    s["syn_words_with_underscore"] = sum(1 for w in syn_map if "_" in w)
    s["syn_src_vocab_covered"] = sum(
        1 for t in src_vocab if t not in dict_lower and t in {w.lower() for w in syn_map})

    return s, rows, header, p1, p2, syn


def write_report(s, path):
    L = []
    a = L.append
    n = s["n_entries"]
    a("# Báo cáo dữ liệu VSL HamNoSys (M1)\n")
    a("> Sinh tự động bởi `tools/analyze_data.py`. Chỉ chứa thống kê, tên cột/thẻ và tỉ lệ; "
      "không chép mục từ điển hay câu. Nguồn: raianrido/VSL (GPL-3.0), chỉ dùng thử cục bộ.\n")
    a("## 1. Từ điển (`Dictionary VSL HamNoSys`)\n")
    a(f"- Cột: {', '.join(s['header'])}")
    a(f"- Số mục (dòng dữ liệu): **{n}**; phân bố số cột/dòng: {dict(s['col_count_dist'])}")
    a(f"- Số từ khác nhau: {s['unique_words']}; từ xuất hiện >1 lần: {s['dup_words']} "
      f"(thừa {s['dup_extra_rows']} dòng); trong đó khác nội dung Hand: {s['dup_words_diff_hand']}")
    a(f"- Từ có `_` (từ ghép): {s['words_with_underscore']}; từ là chữ số: {s['words_numeric']}; "
      f"từ có khoảng trắng: {s['words_with_space']}")
    a(f"- Từ chỉ gồm ASCII: {s['dict_words_ascii']}; có ký tự ngoài ASCII (có dấu): "
      f"{s['dict_words_non_ascii']}. **Khác mô tả:** cột Word lẫn tiếng Việt có dấu, tiếng Việt "
      "không dấu và từ tiếng Anh (quan sát thủ công trên mẫu ngẫu nhiên; chưa đếm tách được "
      f"không dấu/tiếng Anh). Số dạng khác nhau sau khi bỏ dấu + chữ thường: {s['dict_plain_unique']}\n")
    a("### Cột phi tay\n")
    a("| Cột | Rỗng | Có giá trị | Dạng mã (A-Z+số) | Không phải mã | Mã (tần suất) |")
    a("|---|---|---|---|---|---|")
    for c, d in s["non_manual"].items():
        top = ", ".join(f"{k}:{v}" for k, v in d["code_like"].most_common(15))
        more = "" if len(d["code_like"]) <= 15 else f" … (+{len(d['code_like']) - 15} mã)"
        a(f"| {c} | {d['empty']} | {d['nonempty']} | {sum(d['code_like'].values())} | "
          f"{d['non_code']} | {top}{more} |")
    a("")
    a(f"- Cột Mouth: ô không phải mã có {s['mouth_equals_word']} ô trùng nguyên văn cột Word; "
      f"{s['mouth_non_code_ascii']} ô chỉ gồm ký tự ASCII. Phần lớn là chữ viết (khẩu hình theo "
      "từ); một số ô trông giống SAMPA như `picture=` trong SiGML mẫu. Không tách chắc chắn được "
      "→ chưa ánh xạ, cần xác nhận.\n")
    a("### Cột Hand\n")
    a(f"- Mục rỗng: {s['hand_empty']}; số thẻ khác nhau: {s['hand_distinct_tags']}")
    a(f"- Số thẻ/mục: min {s['hand_len_min']}, max {s['hand_len_max']}, "
      f"trung bình {s['hand_len_mean']:.1f}")
    a(f"- Mục có `hamparbegin`: {s['hand_entries_with_par']}; cặp ngoặc cân bằng: "
      f"{s['hand_par_balanced']}, không cân bằng: {s['hand_par_unbalanced']}")
    a(f"- Mục bắt đầu bằng `hamsymm*`: {s['hand_entries_symm']}")
    nh = s["hand_non_ham_tokens"]
    a(f"- Token không khớp mẫu `ham[a-z0-9]+`: {len(nh)} loại, {sum(nh.values())} lần"
      + (f" (ví dụ: {', '.join(repr(k) for k, _ in nh.most_common(10))})" if nh else ""))
    a("\nTop-30 thẻ Hand:\n")
    a("| # | Thẻ | Số lần |")
    a("|---|---|---|")
    for i, (t, c) in enumerate(s["hand_top"], 1):
        a(f"| {i} | `{t}` | {c} |")
    a("")
    a("## 2. DataTrain1 / DataTrain2\n")
    a(f"- DataTrain1: {s['dt1_n']} cặp hợp lệ (dòng lỗi: {s['dt1_bad']}); "
      f"DataTrain2: {s['dt2_n']} cặp (dòng lỗi: {s['dt2_bad']})")
    a(f"- Kiểm chứng DataTrain2 = bỏ dấu(DataTrain1) theo từng dòng (NFD, bỏ dấu kết hợp, đ→d): "
      f"vế nguồn khớp {s['dt_strip_eq_src']}/{s['dt1_n']}, vế đích khớp {s['dt_strip_eq_tgt']}/"
      f"{s['dt1_n']}, cả hai {s['dt_strip_eq_both']}/{s['dt1_n']} → "
      + ("**DataTrain2 không phải dữ liệu độc lập.**" if s["dt_strip_eq_both"] == s["dt1_n"]
         else "**có dòng khác, xem data/reports/.**"))
    a(f"- Câu nguồn DataTrain1 vốn không có dấu: {s['dt1_src_without_diacritics']}")
    a(f"- Cặp khác nhau: {s['dt1_unique_pairs']}; cặp trùng (thừa): {s['dt1_dup_pair_extra']}")
    a(f"- Câu nguồn khác nhau: {s['dt1_unique_src']}; câu nguồn có >1 đích khác nhau: "
      f"{s['dt1_src_multi_tgt']}")
    a(f"- Cặp mà đích = nguồn (không đổi): {s['dt1_identity_pairs']} ({pct(s['dt1_identity_pairs'], s['dt1_n'])})")
    a(f"- Đích chỉ là hoán vị token của nguồn: {s['dt1_same_token_bag']} "
      f"({pct(s['dt1_same_token_bag'], s['dt1_n'])}); đích ngắn hơn: {s['dt1_tgt_shorter']}; "
      f"dài hơn: {s['dt1_tgt_longer']}")
    a(f"- Độ dài trung bình (token tách khoảng trắng): nguồn {s['dt1_src_len_mean']:.2f}, "
      f"đích {s['dt1_tgt_len_mean']:.2f}")
    a(f"- Câu có chữ số: nguồn {s['dt1_src_has_digit']}, đích {s['dt1_tgt_has_digit']}")
    a(f"- Từ vựng đích: {s['dt1_tgt_vocab']} loại, có trong từ điển (không phân biệt hoa thường): "
      f"{s['dt1_tgt_vocab_in_dict']} ({pct(s['dt1_tgt_vocab_in_dict'], s['dt1_tgt_vocab'])}); "
      f"theo lượt token: {pct(s['dt1_tgt_tokens_in_dict'], s['dt1_tgt_tokens'])}")
    a(f"- Nếu so khớp sau khi bỏ dấu cả hai phía: loại {s['dt1_tgt_vocab_in_dict_plain']} "
      f"({pct(s['dt1_tgt_vocab_in_dict_plain'], s['dt1_tgt_vocab'])}); lượt token "
      f"{pct(s['dt1_tgt_tokens_in_dict_plain'], s['dt1_tgt_tokens'])} "
      "(bỏ dấu gây nhập nhằng, chỉ dùng làm dự phòng)")
    a(f"- Từ vựng nguồn: {s['dt1_src_vocab']} loại, có trong từ điển: {s['dt1_src_vocab_in_dict']} "
      f"({pct(s['dt1_src_vocab_in_dict'], s['dt1_src_vocab'])}); không có trong từ điển nhưng có "
      f"trong cột Word của Synonyms: {s['syn_src_vocab_covered']}\n")
    a("## 3. Synonyms.txt\n")
    a(f"- Cột: {', '.join(s['syn_header'])}; số dòng dữ liệu: {s['syn_rows']} "
      f"(dòng lỗi: {s['syn_bad_rows']}, dòng trùng: {s['syn_dup_rows']}, dòng Word=Semilar: {s['syn_self_rows']})")
    a(f"- Số Word khác nhau: {s['syn_unique_words']}; có `_`: {s['syn_words_with_underscore']}; "
      f"số Semilar/Word: trung bình {s['syn_per_word_mean']:.2f}, max {s['syn_per_word_max']}")
    a(f"- Word có trong từ điển: {s['syn_word_in_dict']} ({pct(s['syn_word_in_dict'], s['syn_unique_words'])})")
    a(f"- Semilar khác nhau: {s['syn_unique_similars']}; có trong từ điển: {s['syn_similar_in_dict']} "
      f"({pct(s['syn_similar_in_dict'], s['syn_unique_similars'])})")
    a(f"- Word có ít nhất một Semilar nằm trong từ điển: {s['syn_word_has_any_similar_in_dict']} "
      f"({pct(s['syn_word_has_any_similar_in_dict'], s['syn_unique_words'])})\n")
    a("## 4. Lưu ý\n")
    a("- Dữ liệu chưa được người hiểu VSL xác nhận; các con số chỉ mô tả tệp, không chứng minh đúng ngữ pháp VSL.")
    a("- Ví dụ cụ thể nằm ở `data/reports/m1_examples.txt` (không commit).")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(L) + "\n", encoding="utf-8")


def write_examples(rows, header, p1, p2, syn, s, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    col = {name: i for i, name in enumerate(header)}
    L = ["# M1 examples (local only, third-party data, do not commit)", ""]
    L.append("## 3 dictionary entries (first numeric, first compound, first with Mouth code)")
    picks = []
    picks.append(next(r for r in rows if r[0].isdigit()))
    picks.append(next(r for r in rows if "_" in r[0]))
    picks.append(next(r for r in rows if CODE_RE.match(r[col["Mouth"]] or "-")))
    for r in picks:
        L.append(" | ".join(f"{h}={v}" for h, v in zip(header, r)))
    L.append("")
    L.append("## Pairs (first 5 of DataTrain1 with DataTrain2 counterpart)")
    for (a, b), (c, d) in list(zip(p1, p2))[:5]:
        L.append(f"DT1: {a}  ->  {b}")
        L.append(f"DT2: {c}  ->  {d}")
    L.append("")
    L.append("## Sources with more than one distinct target (up to 10)")
    m = collections.defaultdict(list)
    for a, b in p1:
        if b not in m[a]:
            m[a].append(b)
    for a, bs in [(a, bs) for a, bs in m.items() if len(bs) > 1][:10]:
        L.append(f"{a}  ->  " + "  ||  ".join(bs))
    L.append("")
    L.append("## Lines where strip(DT1) != DT2 (if any)")
    diffs = [(i, x, y) for i, (x, y) in enumerate(zip(p1, p2), 1)
             if (strip_diacritics(x[0]), strip_diacritics(x[1])) != y]
    L.extend(f"line {i}: {x} vs {y}" for i, x, y in diffs[:20])
    if not diffs:
        L.append("(none)")
    L.append("")
    L.append("## First 5 synonym rows")
    L.extend("\t".join(r) for r in syn[:5])
    (out_dir / "m1_examples.txt").write_text("\n".join(L) + "\n", encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", default="data/external/vsl-hamnosys")
    ap.add_argument("--out", default="data/reports")
    ap.add_argument("--report", default="docs/DATA_REPORT.md")
    args = ap.parse_args(argv)
    data_dir = Path(args.data)
    if not (data_dir / DICT_FILE).exists():
        sys.exit(f"missing {data_dir / DICT_FILE}")
    s, rows, header, p1, p2, syn = analyze(data_dir)
    write_report(s, Path(args.report))
    write_examples(rows, header, p1, p2, syn, s, Path(args.out))
    print(f"entries={s['n_entries']} unique_words={s['unique_words']} dup_words={s['dup_words']}")
    print(f"hand_distinct_tags={s['hand_distinct_tags']} par_unbalanced={s['hand_par_unbalanced']}")
    print(f"dt1={s['dt1_n']} dt2={s['dt2_n']} strip_eq_both={s['dt_strip_eq_both']}")
    print(f"dup_pair_extra={s['dt1_dup_pair_extra']} src_multi_tgt={s['dt1_src_multi_tgt']}")
    print(f"syn_rows={s['syn_rows']} syn_unique_words={s['syn_unique_words']}")
    print(f"wrote {args.report} and {Path(args.out) / 'm1_examples.txt'}")


if __name__ == "__main__":
    main()
