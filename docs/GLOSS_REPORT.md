# Báo cáo Văn bản → gloss bằng luật (M3)

> Sinh tự động bởi `node tools/eval_gloss.mjs`. Chỉ thống kê; ví dụ cụ thể ở `data/reports/m3_eval.md` (không commit). Tỉ lệ khớp chỉ đo mức giống dữ liệu raianrido/VSL, KHÔNG chứng minh đúng ngữ pháp VSL (dữ liệu chưa được người hiểu VSL xác nhận).

## 1. Dữ liệu và cách chia

- DataTrain1: 1287 dòng; dòng rỗng hai vế: 21; dòng thiếu một vế: 25 → bỏ. Còn 1241 dòng đủ hai vế.
- **Đính chính M1:** con số "731 cặp khác nhau" ở M1 tính cả cặp rỗng; số cặp khác nhau đủ hai vế là **719**.
- Khử trùng theo khóa (nguồn bỏ dấu, đích bỏ dấu) → 719 nhóm; nhóm có >1 biến thể có dấu: 0. Mỗi nhóm giữ bản có dấu và bản không dấu cùng một phía.
- Chia ngẫu nhiên seed=20261110 (mulberry32), test=30%: train **503** cặp, test **216** cặp.
- Kiểm tra rò rỉ: cặp (có dấu hoặc không dấu) xuất hiện ở cả hai phía = 0; khóa bỏ dấu trùng hai phía = 0.
- Luật và danh sách từ chỉ được chọn bằng cách xem tập train.

## 2. Tỉ lệ khớp chính xác và độ đo mềm (so token, không phân biệt hoa thường)

Từ M4, cấu hình mặc định tắt nhóm `question` (xem docs/M4_REPORT.md). Mục 2.1, 3 và 4 dùng cấu hình mặc định.

F1 = F1 theo từ (túi từ, trung bình theo câu, cao hơn là tốt). ED = khoảng cách chỉnh sửa theo token (Levenshtein, trung bình theo câu, thấp hơn là tốt).

| Cấu hình | Train khớp | Train F1 | Train ED | Test khớp | Test F1 | Test ED |
|---|---|---|---|---|---|---|
| baseline: chép nguyên câu nguồn | 46/503 (9.1%) | 0.856 | 3.26 | 25/216 (11.6%) | 0.856 | 3.26 |
| **mặc định M4** (tắt `question`) | 91/503 (18.1%) | 0.885 | 2.50 | 40/216 (18.5%) | 0.896 | 2.44 |
| tất cả 7 nhóm (bật `question`) | 91/503 (18.1%) | 0.885 | 2.50 | 37/216 (17.1%) | 0.896 | 2.47 |
| chỉ nhóm `punctuation` | 58/503 (11.5%) | 0.870 | 3.00 | 26/216 (12.0%) | 0.869 | 3.00 |
| chỉ nhóm `function_words` | 62/503 (12.3%) | 0.875 | 2.84 | 34/216 (15.7%) | 0.881 | 2.81 |
| chỉ nhóm `classifiers` | 46/503 (9.1%) | 0.858 | 3.23 | 26/216 (12.0%) | 0.860 | 3.22 |
| chỉ nhóm `numbers` | 47/503 (9.3%) | 0.851 | 3.29 | 25/216 (11.6%) | 0.853 | 3.28 |
| chỉ nhóm `negation` | 49/503 (9.7%) | 0.856 | 3.23 | 29/216 (13.4%) | 0.856 | 3.23 |
| chỉ nhóm `object_verb` | 49/503 (9.7%) | 0.856 | 3.21 | 25/216 (11.6%) | 0.856 | 3.21 |
| chỉ nhóm `question` | 43/503 (8.5%) | 0.856 | 3.26 | 23/216 (10.6%) | 0.856 | 3.30 |
| cộng dồn đến `punctuation` | 58/503 (11.5%) | 0.870 | 3.00 | 26/216 (12.0%) | 0.869 | 3.00 |
| cộng dồn đến `function_words` | 78/503 (15.5%) | 0.889 | 2.59 | 38/216 (17.6%) | 0.895 | 2.56 |
| cộng dồn đến `classifiers` | 80/503 (15.9%) | 0.891 | 2.55 | 39/216 (18.1%) | 0.899 | 2.51 |
| cộng dồn đến `numbers` | 81/503 (16.1%) | 0.885 | 2.58 | 39/216 (18.1%) | 0.896 | 2.52 |
| cộng dồn đến `negation` | 85/503 (16.9%) | 0.885 | 2.55 | 40/216 (18.5%) | 0.896 | 2.49 |
| cộng dồn đến `object_verb` | 91/503 (18.1%) | 0.885 | 2.50 | 40/216 (18.5%) | 0.896 | 2.44 |
| cộng dồn đến `question` | 91/503 (18.1%) | 0.885 | 2.50 | 37/216 (17.1%) | 0.896 | 2.47 |
| tất cả trừ `punctuation` | 72/503 (14.3%) | 0.871 | 2.76 | 33/216 (15.3%) | 0.882 | 2.73 |
| tất cả trừ `function_words` | 63/503 (12.5%) | 0.866 | 2.92 | 31/216 (14.4%) | 0.870 | 2.89 |
| tất cả trừ `classifiers` | 89/503 (17.7%) | 0.884 | 2.53 | 36/216 (16.7%) | 0.892 | 2.51 |
| tất cả trừ `numbers` | 90/503 (17.9%) | 0.891 | 2.47 | 37/216 (17.1%) | 0.899 | 2.45 |
| tất cả trừ `negation` | 87/503 (17.3%) | 0.885 | 2.53 | 36/216 (16.7%) | 0.896 | 2.51 |
| tất cả trừ `object_verb` | 85/503 (16.9%) | 0.885 | 2.54 | 36/216 (16.7%) | 0.896 | 2.53 |
| tất cả trừ `question` | 91/503 (18.1%) | 0.885 | 2.50 | 40/216 (18.5%) | 0.896 | 2.44 |

- Bản không dấu (DataTrain2), cấu hình mặc định: train 11.7%, test 11.6% (baseline 9.1% / 11.6%). Danh sách từ viết có dấu nên gần như chỉ luật dấu câu có tác dụng.
- Luật số (`numbers`) chỉ dựa trên rất ít ví dụ (khoảng 18-20 câu có chữ số trong toàn bộ dữ liệu): không kết luận được.

### 2.1 Số câu test có nhóm luật được kích hoạt (cấu hình mặc định)

| Nhóm | Số câu kích hoạt | Trong đó khớp chính xác |
|---|---|---|
| `punctuation` | 49 | 4 |
| `function_words` | 112 | 19 |
| `classifiers` | 12 | 1 |
| `numbers` | 7 | 0 |
| `negation` | 21 | 4 |
| `object_verb` | 30 | 1 |
| `question` | 0 | 0 |

## 3. Kiểu câu test chưa xử lý được

| Kiểu lỗi | Số câu |
|---|---|
| thừa từ (thiếu luật xóa) | 110 |
| đúng tập từ, sai trật tự (luật đảo chưa đủ) | 34 |
| thiếu từ (xóa quá tay) | 22 |
| cùng độ dài, khác từ | 7 |
| đích có từ không có ở nguồn (viết lại/sửa chính tả/đổi số) | 3 |

## 4. Độ phủ từ điển

Trên vế đích của 719 cặp khác nhau (train+test), token sau khi bỏ dấu câu; nhiều token liền nhau có thể ghép bằng "_" (tối đa 4).

| Cách tra | Token có trong từ điển | Câu ký được hoàn toàn | Trong đó token khớp bỏ dấu ("chưa chắc") |
|---|---|---|---|
| đúng dấu | 1741/3772 (46.2%) | 43/719 (6.0%) | 0 |
| đúng dấu + Synonyms | 2047/3772 (54.3%) | 63/719 (8.8%) | 0 |
| đúng dấu + Synonyms + bỏ dấu | 2453/3772 (65.0%) | 109/719 (15.2%) | 407 |

- Mức tăng nhờ Synonyms: +306 token (54.3% so với 46.2%), +20 câu ký được hoàn toàn.
- Mức tăng thêm nhờ khớp bỏ dấu (chưa chắc, dễ nhầm đồng âm): +406 token, +46 câu.
- Mục từ điển nhập nhằng (một từ nhiều mục, đã chọn mục đầu) gặp khi tra đúng dấu + Synonyms: 51 từ.
- Token đích không tra được (đúng dấu + Synonyms): 867 loại.
- Gloss dự đoán trên test: token có trong từ điển 55.9% (đúng dấu + Synonyms), 67.6% (kể cả bỏ dấu); câu ký được hoàn toàn 20/216 / 37/216.

## 5. Chưa kiểm chứng / giới hạn

- Đích trong dữ liệu không nhất quán (cùng cấu trúc nhưng trật tự khác nhau), nhiều câu là thành ngữ/văn chương; tỉ lệ khớp chính xác vì vậy có trần thấp.
- Tách từ: dựa vào dấu "_" có sẵn trong dữ liệu; văn bản tự do chưa có bộ tách từ tiếng Việt.
- Chưa thử gloss → SiGML → avatar.
