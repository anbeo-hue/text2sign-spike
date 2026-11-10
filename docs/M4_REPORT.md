# Báo cáo M4: demo văn bản → gloss → SiGML → avatar CWASA

> Chỉ thống kê và hướng dẫn kiểm tra thủ công. Không chép dữ liệu bên thứ ba.
> Số liệu lấy từ lần chạy ngày 2026-11-11.

## 1. Thành phần

| Tệp | Vai trò |
|---|---|
| `demo.html` | Trang demo ở gốc. Nạp `jas/loc2025/cwa/cwasa.css` và `allcsa.js` (đường dẫn tương đối); chỉ nạp polyfill XSLT khi thiếu `XSLTProcessor`. |
| `src/demo.js` | Điều khiển giao diện, gọi `CWASA.init`, `playSiGMLText`, `stopSiGML`, `addHook`. |
| `cwaclientcfg.json` | Cấu hình client tự viết (xem README). |
| `src/segmenter.js` | Tách từ bằng khớp âm tiết dài nhất (tối đa 6 âm tiết, chỉ khớp đúng dấu với Word của từ điển hoặc khóa Synonyms). |
| `src/sigml_compose.js` | Ghép các `hns_sign` thành một `<sigml>`; từ thiếu được liệt kê, chưa đánh vần. |
| `src/pipeline.js` | Tách từ → luật gloss M3 → tra từ → ghép SiGML. Trình duyệt và công cụ Node dùng chung mã này. |
| `tools/build_pack.py` + `tools/pack_node.mjs` | Sinh `data/pack/demo_pack.json` (không commit), dùng lại `tools/dict_to_sigml.py`. |

## 2. Gói demo (`python tools/build_pack.py`)

| Chỉ số | Giá trị |
|---|---|
| Cặp câu khác nhau đủ hai vế | 719 |
| Câu ứng viên (gloss tham chiếu ký được hoàn toàn, đúng dấu + Synonyms, không dùng khớp bỏ dấu) | 63 |
| Câu giữ lại trong gói | 63 |
| Mục từ điển cần (cho gloss tham chiếu + gloss theo luật) | 124 |
| `hns_sign` sinh được / bị loại | 124 / 0 |
| Ánh xạ Synonyms trong gói | 21 |
| Kích thước gói trên đĩa | 88.545 byte (chạy lại cho cùng sha1) |
| `<sigml>` ghép (63 câu × 2 vế) đọc lại bằng `xml.etree` | 126 hợp lệ, 0 lỗi |
| Gloss tham chiếu ký trọn bằng gói | 63/63 |
| Gloss theo luật (pipeline trình duyệt, chỉ dùng gói) ký trọn | 49/63 |
| Câu có token "chưa chắc" (khớp bỏ dấu trong gói) | 1 |
| Token thiếu trong gloss theo luật | 16 loại, 21 lượt |

Gloss theo luật có thể khác gloss tham chiếu, nên một số câu còn token thiếu (ví dụ từ mà luật không xóa,
trong khi gloss tham chiếu đã xóa). Ví dụ cụ thể không ghi ở đây.

## 3. Điều chỉnh luật: tắt `question` mặc định

- Lý do (theo báo cáo M3, cùng cách chia seed 20261110): `question` không cải thiện train (18,1% cả khi bật lẫn tắt)
  và làm giảm khớp chính xác trên test từ 18,5% xuống 17,1%.
- Mã luật vẫn giữ. Bật lại bằng `textToGloss(text, { enableQuestion: true })` hoặc `{ groups: RULE_GROUPS }`;
  trong demo có ô đánh dấu "bật luật question".
- Không sửa luật nào khác.

## 4. Độ đo mềm (`node tools/eval_gloss.mjs`)

F1 = F1 theo từ (túi từ, trung bình theo câu). ED = khoảng cách chỉnh sửa theo token (trung bình theo câu).

| Cấu hình | Train khớp | Train F1 | Train ED | Test khớp | Test F1 | Test ED |
|---|---|---|---|---|---|---|
| Baseline (chép câu nguồn) | 9,1% | 0,856 | 3,26 | 11,6% | 0,856 | 3,26 |
| Mặc định M4 (tắt `question`) | 18,1% | 0,885 | 2,50 | 18,5% | 0,896 | 2,44 |
| Bật cả 7 nhóm | 18,1% | 0,885 | 2,50 | 17,1% | 0,896 | 2,47 |

- Baseline của train và test trùng nhau khi làm tròn 3 chữ số. Đã kiểm độc lập: F1 0,85626 so với 0,85603; ED 3,2604 so với 3,2639.
- Bảng đầy đủ theo từng nhóm luật nằm trong `docs/GLOSS_REPORT.md`.

## 5. Kiểm tra tự động đã chạy

- `node --test`: 24 test, 24 đạt. Gồm 9 test mới trong `test/segment_compose.test.mjs` (bộ tách từ, ghép SiGML, pipeline; dữ liệu tự viết) và 1 test mới cho việc tắt/bật `question`.
- `python -m http.server 8080 --bind 127.0.0.1` + `curl`: `demo.html`, mọi module `src/*.js`, `cwaclientcfg.json`,
  `data/pack/demo_pack.json`, `allcsa.js`, `cwasa.css`, `cwacfg.json`, `h2s.xsl`, `avatars/anna.jar`
  đều trả về 200. File `.js` có MIME `application/javascript`. `vendor/xslt-polyfill/...` trả về 404 (chưa tải, đúng như mong đợi).
- Sau khi tách hàm `to_hns_sign`, đầu ra của `tools/dict_to_sigml.py` không đổi (so sha1 8 file thử và báo cáo M2).

## 6. CHƯA kiểm chứng: cần kiểm tra thủ công trên trình duyệt

Chưa mở demo trong trình duyệt thật, nên **chưa có số đo thời gian nạp avatar hay FPS**.

Các bước kiểm tra:

1. `python tools/build_pack.py`, rồi `python -m http.server 8080 --bind 127.0.0.1`.
2. Mở `http://127.0.0.1:8080/demo.html` (Chrome/Edge bản hiện tại, khi XSLT còn bật). Mở DevTools → Console.
3. Ô "XSLTProcessor" phải hiện "có sẵn (native)".
4. Chờ trạng thái "Avatar sẵn sàng". Ghi lại "Nạp avatar" (thời gian từ `CWASA.init` đến hook `avatarready`).
   Nếu console có yêu cầu tới `http://localhost/jas/...` thì nghĩa là `jasBase` chưa được áp dụng: báo lại, không sửa jas/.
5. Chọn một câu demo → "Ký". Kiểm tra:
   - gloss hiển thị;
   - chip màu theo loại khớp;
   - "Không có ký hiệu" liệt kê đúng;
   - avatar ký.
6. Khi ký xong (hook `animidle`), ghi "FPS lần ký gần nhất" (TB/min/max, số mẫu từ hook `avatarfps`).
7. Thử nhập câu tự do có từ ngoài gói: từ đó phải nằm trong "Không có ký hiệu".
8. Thử bật "luật question" và so gloss.
9. Bằng chứng (ảnh chụp, số đo) lưu vào `evidence/` (đã ignore).

Các rủi ro đã biết:

- Hook `avatarready` được gọi không kèm chỉ số avatar. Trang chỉ có một avatar nên không ảnh hưởng.
- Chưa có polyfill XSLT: trên Chrome 155+ / Edge 159+ (khi XSLT bị tắt), CWASA sẽ không chuyển được `hns_sign`.
- Bộ tách từ chỉ biết các từ trong gói (124 mục), nên câu tự do phần lớn sẽ thiếu ký hiệu.

## 7. Sửa bố cục avatar (2026-11-11)

**Lỗi:** canvas `canvasAv av0` chỉ rộng 13 px.

**Nguyên nhân (đo bằng DevTools Protocol trên Edge 157):**
- `CWASAPanel` dựng `table.avTable` gồm ba ô theo chiều ngang: ô điều khiển `divCtrlPanel` (343 px), ô ngăn cách, và ô chứa `divAv`.
- Cột phải của trang chỉ rộng 400 px, nên ô avatar bị co còn khoảng 15 px.
- Mỗi khung hình, CWASA đặt `canvas.width/height` theo `clientWidth/clientHeight` của canvas.

**Cách sửa (không đụng jas/):**
- Dùng `CWASAAvatar av0`. Đây là lớp CWASA hỗ trợ sẵn (trang mẫu bespoke-gui của UEA dùng nó): chỉ có avatar, không có bảng điều khiển. Nút Ký/Dừng, FPS và trạng thái là của trang demo.
- Bọc avatar trong `.avatar-stage` cố định 420×540 px (`flex: none`); cột phải rộng 452 px.
- Trong `cwaclientcfg.json`: `width: 420`, `height: 540`, `initCamera: [0, -0.1, 4.4, 5, 12, 30, -1, -1]`. Định dạng camera là `[X, Y, R, theta, phi, FOV, l, r]` theo comment trong mã CWASA. Camera mặc định `[0, 0.23, 3.24, 5, 18, 30, -1, -1]` cắt mất chân trong khung dọc.

**Sau khi sửa:** canvas 418×538 (trừ viền 1 px của `.divAv` trong cwasa.css). Avatar thấy trọn người từ đầu đến giày.

Ảnh chụp lưu trong `evidence/m4_layout/` (không commit):

| Ảnh | Nội dung |
|---|---|
| `before_edge.png` | Trước khi sửa |
| `after_final_idle.png` | Sau khi sửa, lúc chờ |
| `after_edge_headed_signing_0.png` | Sau khi sửa, giữa lúc ký, cửa sổ thật |

## 8. Kết quả ký (Edge 157, đo qua CDP)

- Thời gian nạp avatar (từ `CWASA.init` đến `avatarready`): 0,65–1,02 s qua các lần chạy.
- FPS khi ký: trung bình 29–36 theo hook `avatarfps`. Mỗi lần ký chỉ có 1–5 mẫu, nên đây chỉ là con số thô.
- Đã ký trọn (số ký hiệu `avatarsign` = số `hns_sign` gửi đi) ít nhất 3 câu trong cùng một phiên, ở nhiều lần chạy:
  - headless: câu 0, 4, 5;
  - cửa sổ thật: 10/10 câu ở một lần chạy.
- Từng câu chạy riêng trên trang mới đều ký trọn.

**Lỗi chưa giải quyết: treo khi phát nhiều câu liên tiếp trong một phiên.**
- Sau 1–3 câu, vòng render của CWASA dừng: các hook `avatarframe`/`avatarfps` không còn được gọi, `animidle` không đến, và các yêu cầu phát sau bị bỏ qua.
- Đo được:
  - 6 lượt × 6 câu (headless, GPU thật): luôn hỏng ở câu #2 hoặc #3, dù nghỉ 500 ms hay 3000 ms giữa các câu.
  - Cửa sổ thật: 1 lần 10/10 câu, 1 lần hỏng ở câu thứ 3.
- **Không** phải do: chế độ headless, bóp timer nền, mất context WebGL (`isContextLost=false`), SwiftShader hay GPU thật, khoảng nghỉ giữa các câu.
- **Lặp lại được với SiGML mẫu của UEA:** ghép 5 ký hiệu từ `BSLExamples/SignFiles` rồi phát 6 lần bằng `CWASA.playSiGMLText` thì có 1/2 lượt treo ở lần thứ 3. Vậy lỗi không đến từ dữ liệu VSL hay pipeline gloss.
- Chưa loại trừ ảnh hưởng của việc điều khiển trang qua CDP (lệnh `Runtime.evaluate` mỗi 100 ms). **Cần thử bấm tay** nhiều câu liên tiếp trong trình duyệt thường.
- Console luôn có `Error: animgenAllocate: jagid: 0` một lần lúc nạp SiGML đầu tiên, kể cả khi ký thành công. Chưa rõ có liên quan không.

**XSLT:** Chrome 157 và Edge 157 (headless, máy này, 2026-11-11) đều còn `XSLTProcessor` (`typeof === "function"`).
