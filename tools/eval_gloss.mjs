// Evaluate src/gloss_rules.js on a pair-level train/test split of DataTrain1.
// Writes docs/GLOSS_REPORT.md (statistics only) and data/reports/m3_eval.md (examples, local only).
// Usage: node tools/eval_gloss.mjs [--data DIR] [--seed N]
import { writeFileSync, mkdirSync } from 'node:fs';
import { splitPairs, stripDiacritics } from '../src/split.js';
import { textToGloss, RULE_GROUPS, tokenize } from '../src/gloss_rules.js';
import { buildLexicon, lookupGloss } from '../src/lexicon.js';
import { DEFAULT_DATA, loadPairs, alignedNonEmpty, loadDictionaryWords, loadSynonyms } from './lib_data.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const dataDir = opt('--data', DEFAULT_DATA);
const seed = Number(opt('--seed', 20261110));

// ------------------------------------------------------------------ data + split
const raw1 = loadPairs(dataDir, 'DataTrain1.txt');
const raw2 = loadPairs(dataDir, 'DataTrain2.txt');
const aligned = alignedNonEmpty(raw1, raw2);
const { train, test, stats } = splitPairs(aligned.signed, aligned.unsigned, { seed });

const keyOf = (p) => p[0] + '\t' + p[1];
const trainKeys = new Set(train.flatMap((g) => [...g.signed, ...g.unsigned].map(keyOf)));
const testKeys = new Set(test.flatMap((g) => [...g.signed, ...g.unsigned].map(keyOf)));
const overlap = [...trainKeys].filter((k) => testKeys.has(k)).length;
const plainKeyOverlap = (() => {
  const a = new Set(train.map((g) => g.key));
  return test.filter((g) => a.has(g.key)).length;
})();
if (overlap || plainKeyOverlap) throw new Error(`split leak: ${overlap} / ${plainKeyOverlap}`);

const trainPairs = train.flatMap((g) => g.signed);
const testPairs = test.flatMap((g) => g.signed);

// ------------------------------------------------------------------ exact match
const norm = (s) => tokenize(s).map((t) => t.toLowerCase()).join(' ');
function exact(pairs, fn) {
  let ok = 0;
  for (const [s, t] of pairs) if (norm(fn(s)) === norm(t)) ok++;
  return ok;
}
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : 'n/a');
const run = (groups) => (s) => textToGloss(s, { groups }).gloss;

const rows = [];
const addRow = (label, fn) => {
  const tr = exact(trainPairs, fn), te = exact(testPairs, fn);
  rows.push({ label, tr, te });
};
addRow('baseline: chép nguyên câu nguồn', (s) => s);
for (const g of RULE_GROUPS) addRow(`chỉ nhóm \`${g}\``, run([g]));
for (let k = 1; k <= RULE_GROUPS.length; k++) addRow(`cộng dồn đến \`${RULE_GROUPS[k - 1]}\``, run(RULE_GROUPS.slice(0, k)));
for (const g of RULE_GROUPS) addRow(`tất cả trừ \`${g}\``, run(RULE_GROUPS.filter((x) => x !== g)));

// Unsigned twin (DataTrain2): word lists are written with diacritics, so the
// rules only see punctuation there. Reported for completeness.
const trainU = train.flatMap((g) => g.unsigned), testU = test.flatMap((g) => g.unsigned);
const unsignedAll = { tr: exact(trainU, run(RULE_GROUPS)), te: exact(testU, run(RULE_GROUPS)),
  trb: exact(trainU, (s) => s), teb: exact(testU, (s) => s) };

// Rule firing counts on test
const fired = Object.fromEntries(RULE_GROUPS.map((g) => [g, 0]));
const firedOk = Object.fromEntries(RULE_GROUPS.map((g) => [g, 0]));
for (const [s, t] of testPairs) {
  const r = textToGloss(s);
  const ok = norm(r.gloss) === norm(t);
  for (const g of new Set(r.applied.map((a) => a.group))) { fired[g]++; if (ok) firedOk[g]++; }
}

// ------------------------------------------------------------------ error categories (test)
const bag = (s) => norm(s).split(' ').sort().join(' ');
const cats = new Map();
const addCat = (c, ex) => { if (!cats.has(c)) cats.set(c, []); cats.get(c).push(ex); };
for (const [s, t] of testPairs) {
  const g = textToGloss(s).gloss;
  if (norm(g) === norm(t)) continue;
  const gt = norm(g).split(' '), tt = norm(t).split(' ');
  const st = new Set(norm(s).split(' '));
  const ex = { s, t, g };
  if (tt.some((w) => !st.has(w))) addCat('đích có từ không có ở nguồn (viết lại/sửa chính tả/đổi số)', ex);
  else if (bag(g) === bag(t)) addCat('đúng tập từ, sai trật tự (luật đảo chưa đủ)', ex);
  else if (gt.length > tt.length) addCat('thừa từ (thiếu luật xóa)', ex);
  else if (gt.length < tt.length) addCat('thiếu từ (xóa quá tay)', ex);
  else addCat('cùng độ dài, khác từ', ex);
}

// ------------------------------------------------------------------ dictionary coverage
const lex = buildLexicon(loadDictionaryWords(dataDir), loadSynonyms(dataDir));
const allUnique = [...trainPairs, ...testPairs];
function coverage(pairs, kinds, side = 1) {
  let tok = 0, hit = 0, full = 0;
  const uncertain = { n: 0 }, ambiguous = new Map(), missing = new Map(), fullSentences = [];
  for (const p of pairs) {
    const toks = tokenize(p[side]).filter((t) => !/^[,.!?:;"“”…()]$/.test(t));
    const res = lookupGloss(toks, lex, { kinds });
    let all = true;
    for (const r of res) {
      const n = r.token.split(' ').length;
      tok += n;
      if (r.kind === 'missing') { all = false; missing.set(r.token, (missing.get(r.token) || 0) + 1); continue; }
      hit += n;
      if (r.kind === 'plain') uncertain.n += n;
      if (r.ambiguous) ambiguous.set(r.entry, r.ambiguous);
    }
    if (all) { full++; fullSentences.push(p); }
  }
  return { tok, hit, full, n: pairs.length, uncertain: uncertain.n, ambiguous, missing, fullSentences };
}
const covE = coverage(allUnique, ['exact']);
const covES = coverage(allUnique, ['exact', 'synonym']);
const covESP = coverage(allUnique, ['exact', 'synonym', 'plain']);
const predPairs = testPairs.map(([s, t]) => [s, textToGloss(s).gloss]);
const covPredES = coverage(predPairs, ['exact', 'synonym']);
const covPredESP = coverage(predPairs, ['exact', 'synonym', 'plain']);

// ------------------------------------------------------------------ report (stats only)
const L = [];
const a = (x = '') => L.push(x);
a('# Báo cáo Văn bản → gloss bằng luật (M3)');
a();
a('> Sinh tự động bởi `node tools/eval_gloss.mjs`. Chỉ thống kê; ví dụ cụ thể ở `data/reports/m3_eval.md` (không commit). '
  + 'Tỉ lệ khớp chỉ đo mức giống dữ liệu raianrido/VSL, KHÔNG chứng minh đúng ngữ pháp VSL (dữ liệu chưa được người hiểu VSL xác nhận).');
a();
a('## 1. Dữ liệu và cách chia');
a();
a(`- DataTrain1: ${raw1.length} dòng; dòng rỗng hai vế: ${aligned.blank}; dòng thiếu một vế: ${aligned.half} → bỏ. Còn ${aligned.signed.length} dòng đủ hai vế.`);
a(`- **Đính chính M1:** con số "731 cặp khác nhau" ở M1 tính cả cặp rỗng; số cặp khác nhau đủ hai vế là **${stats.uniqueSignedPairs}**.`);
a(`- Khử trùng theo khóa (nguồn bỏ dấu, đích bỏ dấu) → ${stats.groups} nhóm; nhóm có >1 biến thể có dấu: ${stats.groupsWithMultipleSignedVariants}. Mỗi nhóm giữ bản có dấu và bản không dấu cùng một phía.`);
a(`- Chia ngẫu nhiên seed=${stats.seed} (mulberry32), test=${stats.testRatio * 100}%: train **${stats.train}** cặp, test **${stats.test}** cặp.`);
a(`- Kiểm tra rò rỉ: cặp (có dấu hoặc không dấu) xuất hiện ở cả hai phía = ${overlap}; khóa bỏ dấu trùng hai phía = ${plainKeyOverlap}.`);
a('- Luật và danh sách từ chỉ được chọn bằng cách xem tập train.');
a();
a('## 2. Tỉ lệ khớp chính xác (so token, không phân biệt hoa thường)');
a();
a('| Cấu hình | Train | Test |');
a('|---|---|---|');
for (const r of rows) a(`| ${r.label} | ${r.tr}/${trainPairs.length} (${pct(r.tr, trainPairs.length)}) | ${r.te}/${testPairs.length} (${pct(r.te, testPairs.length)}) |`);
a();
a(`- Bản không dấu (DataTrain2), toàn bộ luật: train ${pct(unsignedAll.tr, trainU.length)}, test ${pct(unsignedAll.te, testU.length)} `
  + `(baseline ${pct(unsignedAll.trb, trainU.length)} / ${pct(unsignedAll.teb, testU.length)}). Danh sách từ viết có dấu nên gần như chỉ luật dấu câu có tác dụng.`);
a('- Luật số (`numbers`) chỉ dựa trên rất ít ví dụ (khoảng 18-20 câu có chữ số trong toàn bộ dữ liệu): không kết luận được.');
a();
a('### Số câu test có nhóm luật được kích hoạt');
a();
a('| Nhóm | Số câu kích hoạt | Trong đó khớp chính xác |');
a('|---|---|---|');
for (const g of RULE_GROUPS) a(`| \`${g}\` | ${fired[g]} | ${firedOk[g]} |`);
a();
a('## 3. Kiểu câu test chưa xử lý được');
a();
a('| Kiểu lỗi | Số câu |');
a('|---|---|');
for (const [c, xs] of [...cats.entries()].sort((x, y) => y[1].length - x[1].length)) a(`| ${c} | ${xs.length} |`);
a();
a('## 4. Độ phủ từ điển');
a();
a(`Trên vế đích của ${allUnique.length} cặp khác nhau (train+test), token sau khi bỏ dấu câu; nhiều token liền nhau có thể ghép bằng "_" (tối đa 4).`);
a();
a('| Cách tra | Token có trong từ điển | Câu ký được hoàn toàn | Trong đó token khớp bỏ dấu ("chưa chắc") |');
a('|---|---|---|---|');
for (const [lab, c] of [['đúng dấu', covE], ['đúng dấu + Synonyms', covES], ['đúng dấu + Synonyms + bỏ dấu', covESP]]) {
  a(`| ${lab} | ${c.hit}/${c.tok} (${pct(c.hit, c.tok)}) | ${c.full}/${c.n} (${pct(c.full, c.n)}) | ${c.uncertain} |`);
}
a();
a(`- Mức tăng nhờ Synonyms: +${covES.hit - covE.hit} token (${pct(covES.hit, covES.tok)} so với ${pct(covE.hit, covE.tok)}), +${covES.full - covE.full} câu ký được hoàn toàn.`);
a(`- Mức tăng thêm nhờ khớp bỏ dấu (chưa chắc, dễ nhầm đồng âm): +${covESP.hit - covES.hit} token, +${covESP.full - covES.full} câu.`);
a(`- Mục từ điển nhập nhằng (một từ nhiều mục, đã chọn mục đầu) gặp khi tra đúng dấu + Synonyms: ${covES.ambiguous.size} từ.`);
a(`- Token đích không tra được (đúng dấu + Synonyms): ${covES.missing.size} loại.`);
a(`- Gloss dự đoán trên test: token có trong từ điển ${pct(covPredES.hit, covPredES.tok)} (đúng dấu + Synonyms), ${pct(covPredESP.hit, covPredESP.tok)} (kể cả bỏ dấu); câu ký được hoàn toàn ${covPredES.full}/${covPredES.n} / ${covPredESP.full}/${covPredESP.n}.`);
a();
a('## 5. Chưa kiểm chứng / giới hạn');
a();
a('- Đích trong dữ liệu không nhất quán (cùng cấu trúc nhưng trật tự khác nhau), nhiều câu là thành ngữ/văn chương; tỉ lệ khớp chính xác vì vậy có trần thấp.');
a('- Tách từ: dựa vào dấu "_" có sẵn trong dữ liệu; văn bản tự do chưa có bộ tách từ tiếng Việt.');
a('- Chưa thử gloss → SiGML → avatar.');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/GLOSS_REPORT.md', L.join('\n') + '\n', 'utf8');

// ------------------------------------------------------------------ examples (local only)
const E = [];
E.push('# M3 examples (local only, third-party data, do not commit)', '');
for (const [c, xs] of cats) {
  E.push(`## ${c} (${xs.length})`);
  for (const x of xs.slice(0, 8)) E.push(`- nguồn: ${x.s}\n  - đích:  ${x.t}\n  - luật:  ${x.g}`);
  E.push('');
}
E.push('## Câu test khớp chính xác (tối đa 15)');
for (const [s, t] of testPairs.filter(([s, t]) => norm(textToGloss(s).gloss) === norm(t)).slice(0, 15)) E.push(`- ${s}  →  ${t}`);
E.push('', '## Câu đích ký được hoàn toàn bằng đúng dấu (ứng viên demo, tối đa 30)');
for (const [s, t] of covE.fullSentences.slice(0, 30)) E.push(`- ${t}   (nguồn: ${s})`);
E.push('', '## Từ nhập nhằng (từ: số mục)');
E.push([...covES.ambiguous].map(([w, n]) => `${w}:${n}`).join(', '));
E.push('', '## Token đích không có (đúng dấu + Synonyms), top 60');
E.push([...covES.missing].sort((x, y) => y[1] - x[1]).slice(0, 60).map(([w, n]) => `${w}:${n}`).join(', '));
mkdirSync('data/reports', { recursive: true });
writeFileSync('data/reports/m3_eval.md', E.join('\n') + '\n', 'utf8');

// ------------------------------------------------------------------ console
console.log(`split: train=${stats.train} test=${stats.test} overlap=${overlap} seed=${seed}`);
for (const r of rows) console.log(`${r.label.padEnd(36)} train ${pct(r.tr, trainPairs.length).padStart(6)}  test ${pct(r.te, testPairs.length).padStart(6)}`);
console.log(`coverage tokens exact=${pct(covE.hit, covE.tok)} +syn=${pct(covES.hit, covES.tok)} +plain=${pct(covESP.hit, covESP.tok)}`);
console.log(`fully signable sentences exact=${covE.full} +syn=${covES.full} +plain=${covESP.full} of ${covE.n}`);
console.log('wrote docs/GLOSS_REPORT.md and data/reports/m3_eval.md');
