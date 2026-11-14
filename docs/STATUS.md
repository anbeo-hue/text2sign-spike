# Trạng thái dự án (cập nhật 2026-11-14)

## v2: bố cục một màn hình, gộp lượt trùng, bộ đếm phiên, giấy phép (2026-11-14, lượt 2)

- **Bố cục:**
  - Từ 1280px trở lên: 3 cột "Người ký | Người nghe | Hội thoại" trong một màn hình. Danh sách lượt cuộn bên trong cột và
    tự cuộn tới lượt mới. Nút Xuất, nút Xóa và dòng quyền riêng tư luôn hiện. Header và dải giới hạn được thu gọn, nội dung
    chữ giữ nguyên.
  - Khung camera và avatar giữ tỉ lệ 4:3, theo cạnh nhỏ hơn (đơn vị container `cqw`/`cqh`). CWASA tự lấy kích thước canvas
    từ phần tử cha, nên không cần sửa `jas/`.
  - Dưới 1280px vẫn xếp chồng như cũ.
- **Gộp lượt:**
  - Các lượt liên tiếp cùng bên, cùng chữ hiện thành một bong bóng "×N". Bong bóng ghi giờ đầu–cuối nếu khác phút.
  - Lưu: thêm trường `count`, và `lastAt` khi `count` > 1 để hiện giờ lượt cuối. `conf` là của lần nhận gần nhất.
  - Lịch sử cũ không có `count` được đọc là 1. Nếu lịch sử cũ có các lượt trùng liên tiếp, lúc hiển thị chúng vẫn được gộp.
  - Lượt "chưa chắc" xen giữa làm ngắt chuỗi gộp.
  - Xuất file: `HH:mm  Người ký: Cháu (×7)`.
- **Bộ đếm phiên:** nằm trong ngăn Nâng cao, chỉ giữ trong bộ nhớ, có nút "Đặt lại bộ đếm".
- **Giấy phép:**
  - `THIRD_PARTY_NOTICES.md` mới ghi trạng thái xác minh của từng thành phần và các câu hỏi giấy phép còn mở.
  - Văn bản giấy phép libxml2 2.15.0 và libxslt 1.1.44 (đúng commit submodule của polyfill 1.0.33) được chép nguyên văn
    vào `vendor/xslt-polyfill/` (không commit).
- **Kiểm qua CDP** (Chrome 157, camera giả, một cờ `--disable-features`, profile mới):

  | Cấu hình | Số bước đạt | Cuộn dọc trang |
  |---|---|---|
  | 1860×955 | 22/22 | Không |
  | 1366×768 | 22/22 | Không; 12 lượt thì cột Hội thoại thấy 3 lượt |
  | 1860×955, XSLT tắt | 22/22 | Không |
  | 1366×768, XSLT tắt + chặn jsDelivr/GCS | 22/22 | Không |
  | 390×844 | 21/22 | Có, do xếp chồng theo thiết kế; không cuộn ngang |

  - Avatar ký được Nhà, Mưa, Có, Bây giờ: `hns_sign` gửi đi = chỉ số `s` avatar phát.
  - Không có lỗi mạng hay request ra ngoài máy. Console chỉ còn các thông báo như lượt trước.
  - Dữ liệu thô: `evidence/unified/cdp_v3.mjs`, `v3_*.json`, `shots3/`.
- **Chưa kiểm chứng:**
  - camera thật, bấm tay, Edge;
  - mạng thật ở nơi demo;
  - chia sẻ màn hình qua Meet;
  - thay đổi cỡ cửa sổ khi đang chạy (chỉ đo ở cỡ cố định từ lúc tải trang).

## Giao diện thống nhất v2 (`unified/v2/`, nhánh `ui-unified`, 2026-11-14)

- Trang mới `unified/v2/index.html` + `v2.css` + `v2.js`; `unified/index.html` giữ nguyên làm dự phòng. Không tải font/thư viện từ mạng.
- Không sửa `demo.html`, `src/`, `jas/`, `unified/s2t/` (md5 `app.js` 50c4d427…, hàm `loop` ae8d360d… như trước). Hai trang cũ chạy trong iframe
  cùng nguồn gốc; v2 tiêm CSS ẩn phần thừa, theo dõi DOM bằng MutationObserver, bấm hộ nút có sẵn, và nối thêm vào `window.t2sReport`
  (hook sự kiện có sẵn của `demo.js`) để biết khi avatar thật sự bắt đầu ký (`animactive`).
- Lịch sử: `localStorage` khóa `vsl_history_v1`, tối đa 200 lượt, chỉ `side, text, status, at` (+ `conf` cho lượt người ký).
  Khóa thứ hai `vsl_help_seen_v1` = "1" (đã xem hộp thoại). Từ "chưa chắc" chỉ hiện trong phiên.
- Kiểm qua CDP (Chrome 157, camera giả, một `--disable-features`, profile mới): 19/19 bước đạt ở cả 3 cấu hình (XSLT gốc; XSLT tắt;
  XSLT tắt + chặn DNS jsDelivr/GCS). Mỗi lần Ký/từ gợi ý/"Cho avatar ký lại": hns_sign gửi = chỉ số `s` avatarsign và đúng 1 lượt người nghe.
  0 lỗi mạng, 0 request ra ngoài máy; console chỉ còn 2 lỗi `animgenAllocate` của CWASA (có từ trước), cảnh báo MediaPipe, và cảnh báo
  "XSLT deprecated" (chỉ khi XSLT gốc).
- Xuất .txt: nội dung kiểm bằng cách bắt Blob mà nút tạo ra, tên file qua `downloadWillBegin`. **Lưu file thật chưa kiểm chứng**: qua CDP
  trên máy này mọi lượt tải (kể cả file tĩnh `README.md`) đều kết thúc `canceled`, nguyên nhân chưa rõ.
- FPS/độ trễ trang nhận diện (camera giả, KHÔNG đại diện camera thật; trung vị 15 mẫu/lượt), dao động lớn giữa các lượt:
  một mình 36 và 29 FPS (27 và 34 ms); trong v2, avatar hiện và rảnh: 29, 26 (đo riêng) và 42, 40, 43 (trong 3 lượt kiểm đầy đủ);
  v2 với avatar ẩn (chỉ để chẩn đoán): 31, 36. Chưa kết luận được avatar làm giảm FPS bao nhiêu. Trong v2, mẫu đầu sau khi sẵn sàng hay chậm (4–5 FPS).
- Dữ liệu thô và script: `evidence/unified/cdp_v2.mjs`, `v2_*.json`, `perf_*.json`, `shots/` (bị `.gitignore`).
- **Chưa kiểm chứng:** camera thật, nhận diện thật, Edge, bấm tay trên màn hình thật, mạng thật ở nơi demo, lưu file .txt thật, trình đọc màn hình.

## Trang ký hiệu → văn bản (`unified/s2t/`) chạy ngoại tuyến (2026-11-14)

`unified/s2t/` là bản sao bị `.gitignore` (bản gốc `C:\vsl-kaggle-sample\demo` không sửa). MediaPipe đã tải sẵn vào
`unified/s2t/vendor/mediapipe/` (không commit; `git check-ignore` → `.gitignore:15:unified/s2t/`). Danh sách file, nguồn,
sha256: `unified/s2t/vendor/mediapipe/MANIFEST.txt`. Tổng 58 657 107 byte (~56 MB; ba file `.wasm` ~33 MB, ba `.task` ~23 MB).

| Thành phần | Nguồn | Giấy phép | Đã xác minh? |
|---|---|---|---|
| `vision_bundle.mjs` + `wasm/` (6 file) | `npm pack @mediapipe/tasks-vision@0.10.35`; sha512 tarball khớp `dist.integrity` npm | Apache-2.0 | Một phần: chỉ trường `license` trong `package.json` của gói; gói KHÔNG kèm file LICENSE. Văn bản Apache-2.0 lấy từ repo google-ai-edge/mediapipe |
| `hand_landmarker.task` | storage.googleapis.com, `float16/latest` (Last-Modified 26/04/2023) | Apache License 2.0 | Có: mục "LICENSED UNDER" trang 2 model card "MediaPipe Hands (Lite/Full)" (Oct 2021) do trang tài liệu Hand Landmarker liên kết |
| `pose_landmarker_full.task`, `pose_landmarker_lite.task` | như trên (27–28/04/2023) | Apache License 2.0 | Có: mục "LICENSED UNDER" trang 2 model card "BlazePose GHUM 3D" (16/04/2021) do trang tài liệu Pose Landmarker liên kết |

Lưu ý: model card có từ 2021, còn file `.task` sửa đổi vào 04/2023. Bản thân file `.task` không kèm giấy phép. URL `latest` không ghim
phiên bản; sha256 ghi lại là của bản đã tải. Bản sao giấy phép và model card nằm ở `vendor/mediapipe/licenses/`.

**`app.js`:** nạp từ máy trước (bundle, wasm qua HEAD 4 file, từng `.task`); file nào lỗi thì dùng URL mạng cũ cho file đó.
Nếu mọi cách đều hỏng khi wasm đang lấy từ máy, thử lại một lần với wasm từ mạng. Dòng trạng thái ghi `sẵn sàng · nguồn: cục bộ`, `… mạng`, hoặc
`… cục bộ + mạng (mạng: …)`. Hàm `loop`/nhận diện giữ nguyên (so md5 với bản trước).
`python -m http.server` (Python 3.11.9, máy này) trả `.mjs`/`.js` → `application/javascript`, `.wasm` → `application/wasm`: đúng.

**Kiểm qua CDP** (Chrome 157, camera giả, một cờ `--disable-features`, profile mới mỗi lượt; thời gian "sẵn sàng" tính từ lúc bấm nút,
đọc mỗi ~1 s nên sai số ~1 s; camera giả không có người → KHÔNG đo độ chính xác):

| Trường hợp | Lượt | Sẵn sàng (s) | Trạng thái | Request ra ngoài máy | FPS trung vị (min–max) | Xử lý/khung trung vị (ms) |
|---|---|---|---|---|---|---|
| (a) mạng thường, đủ file trên máy | 3 | 5,75 / 5,56 / 5,62 | `nguồn: cục bộ` | 0 | 42 / 37 / 41 (33–43) | 23 / 27 / 24 |
| (b) chặn DNS cả cdn.jsdelivr.net và storage.googleapis.com | 3 | 5,60 / 5,66 / 5,61 | `nguồn: cục bộ` | 0, không lỗi mạng | 36 / 35 / 36 (4*–43) | 27 / 27 / 27 |
| Đối chứng: tạm bỏ cả thư mục `vendor/mediapipe` (chỉ mạng) | 3 | 7,68 / 7,96 / 8,09 | `nguồn: mạng` | jsDelivr 8, GCS 2 | 39 / 42 / 42 (34–43) | 25 / 23 / 23 |
| (c1) tạm bỏ `pose_landmarker_full.task` | 1 | 6,72 | `cục bộ + mạng (mạng: pose)` | GCS 1 | 41 (31–43) | 23 |
| (c2) tạm bỏ `vision_bundle.mjs` | 1 | 5,86 | `cục bộ + mạng (mạng: thư viện)` | jsDelivr 1 | 38 (34–43) | 26 |

- \*Lượt b1: mẫu đầu tiên ngay sau khi sẵn sàng là 4 FPS / 229 ms, 14 mẫu sau 31–43 FPS. Chưa rõ nguyên nhân, chỉ thấy 1 lần.
- Ở mọi lượt, vòng nhận diện đều chạy: FPS cập nhật, `y cổ tay` = "mất người" vì hình giả không có người.
- (c) sau khi chạy, file được trả về chỗ cũ; sha256 cả 14 file khớp MANIFEST.
- Chế độ chỉ-mạng sinh 404 cho các file cục bộ trước khi chuyển sang mạng (cảnh báo console, không phải lỗi).
- Dữ liệu thô: `evidence/unified/s2t_local_*.json`, `s2t_netonly_*.json` (bị `.gitignore`).

**Chưa kiểm chứng:** camera thật, nhận diện thật; Edge; bấm tay; mạng thật/không có mạng thật ở nơi demo (mới giả lập DNS);
server trên máy khác (Content-Type phụ thuộc phiên bản Python/registry Windows: kiểm lại bằng `curl -I …/vision_bundle.mjs` và `…/wasm/vision_wasm_internal.wasm`).

## Nhận xét của người hiểu VSL về chiều văn bản → ký hiệu (2026-11-13)

- Một người hiểu VSL đã xem chiều văn bản → ký hiệu (gói từ điển cục bộ) và nhận xét là **chấp nhận được**.
- Nguồn: người dùng báo lại ngày 13/11/2026. **Chưa có xác nhận bằng văn bản**; chưa biết người đó đã xem những từ/câu nào
  và theo biến thể vùng nào. Không coi đây là xác nhận từng ký hiệu hay xác nhận gloss tham chiếu (vẫn chưa được xác nhận, xem mục dưới).
- Chiều ký hiệu → văn bản (19 từ) vẫn **chưa** được người hiểu VSL xác nhận.
- Trang `unified/index.html` ghi đúng nội dung này ở dòng chú thích đầu trang.

## Polyfill XSLT: thử trên trình duyệt TẮT XSLT THẬT (2026-11-13)

**Cách tắt:** máy chỉ có Chrome Stable 157.0.8103.50 và Edge Stable 157.0.4341.46 (không có Beta/Canary/Dev; không cài thêm).
Dùng cờ `--disable-features=XSLT` (tính năng Blink, cùng công tắc mà chrome://flags/chính sách điều khiển). Kiểm bằng
`probe_xslt.mjs` (scratchpad, headless, 1 `Runtime.evaluate`/trang):

| Trình duyệt | Cờ | `typeof XSLTProcessor` gốc | Trang XML có `<?xml-stylesheet?>` | `demo.html` mặc định |
|---|---|---|---|---|
| Chrome 157 | không | function | biến đổi được | native |
| Chrome 157 | `--disable-features=XSLT` | không có | "This document cannot be formatted as intended. It uses XSLT, which the br…" | tự nạp polyfill |
| Chrome 157 | `--disable-blink-features=XSLT` | không có | như trên | tự nạp polyfill |
| Edge 157 | không | function | biến đổi được | native |
| Edge 157 | `--disable-features=XSLT` | không có | như trên | tự nạp polyfill |

Đây là tắt ở mức trình duyệt (khác hôm qua: chỉ `delete window.XSLTProcessor` bằng JS). Chưa thử bản Chrome đã tắt XSLT
mặc định (Stable 157 trên máy vẫn bật).

**Kiểm tương đương khi tắt XSLT thật** (`tools/xslt_equiv.html`, chế độ "chỉ polyfill": SHA-256 từng G-SiGML, so với hash native
của lượt Chrome thường cùng ngày `equiv_chrome_1113.json`: 124/124 + 63/63 giống, 0 lỗi console):

| Trình duyệt (XSLT tắt) | 124 hns_sign | 63 câu demo | Lỗi | `hamgestural_sign` | Polyfill sẵn sàng |
|---|---|---|---|---|---|
| Chrome 157 | 124/124 khớp hash native | 63/63 | 0 | 124 + 242 | 72 ms |
| Edge 157 | 124/124 khớp hash native | 63/63 | 0 | 124 + 242 | 73 ms |

**Avatar, 10 câu demo đầu/lượt, cửa sổ thật, CDP không thăm dò** (`cdp_run.mjs`; nay gộp đúng một `--disable-features=`):

| Tổ hợp | Lượt | Câu xong / gửi | hns_sign gửi = chỉ số `s` khác nhau | `avatarsign` thô | Nạp avatar (s) | FPS TB (min) |
|---|---|---|---|---|---|---|
| Chrome XSLT tắt, URL mặc định (tự polyfill) | 3 | 30/30 | 99 = 99 | 129 | 0,89 / 1,23 / 1,02 | 32,1 / 30,6 / 30,5 (min 29,7) |
| Chrome XSLT tắt, `?xslt=polyfill` | 1 | 10/10 | 33 = 33 | 43 | 0,87 | 32,5 (min 29,6) |
| Chrome native (đối chứng cùng ngày) | 2 | 20/20 | 66 = 66 | 86 | 0,73 / 0,77 | 34,5 / 33,5 (min 30,2) |
| Edge XSLT tắt (tự polyfill) | 2 | 7/9, **treo 2/2** (câu #4, #5) | 14 = 14 | 21 | 0,93 / 0,77 | 33,6 / 36,3 (3–4 mẫu) |
| Edge native (đối chứng cùng ngày) | 2 | 14/15, **treo 1/2** (câu #5); lượt kia 10/10 | 41 = 41 | 55 | 0,69 / 0,68 | 32,2 / 34,1 |

- "Nạp avatar" = từ `CWASA.init` đến `avatarready`, KHÔNG gồm thời gian polyfill sẵn sàng (đo riêng ở trên: 67–91 ms).
- Chrome polyfill nạp chậm hơn native ~0,1–0,5 s và FPS TB thấp hơn ~2–4 khung/s trong các lượt này (25 mẫu/lượt, ít mẫu,
  chưa đủ để khẳng định là khác biệt thật). Không lượt Chrome nào treo (40/40 câu polyfill, 20/20 native).
- Mọi lượt treo trên Edge cùng dấu hiệu: `play` → `animactive` nhưng không có `animidle` trong 90 s, ô FPS vẫn ~32–34
  (vòng render còn chạy). Xảy ra ở cả native và polyfill → không do polyfill; vẫn nghi do CDP (chưa xác định).
- Gộp cờ `--disable-features` (hôm qua `CalculateNativeWinOcclusion` bị cờ sau ghi đè nên thực chất không tắt) không làm hết treo trên Edge.
- Console mỗi lượt chỉ có `animgenAllocate: jagid: 0` và `Time Format: 0` (như hôm qua, cả hai chế độ).
- Dữ liệu thô: `evidence/xslt_polyfill/av_*_xsltoff*.json`, `av_*_native_1113_*.json`, `equiv_*_1113.json`, `equiv_*_xsltoff.json` (bị `.gitignore`).

### Bấm tay không qua CDP (2026-11-13)

- Môi trường: Chrome 157 chạy với `--disable-features=XSLT`, `demo.html` mặc định (polyfill tự phát hiện), không gắn CDP.
- 10 câu demo bấm liên tiếp: nho xanh; không ăn; bức này thế nào; không làm , không ăn; anh nói sao cũng được;
  vàng gió , đỏ mưa; mưa trắng , nắng đen; mai mẹ về; khuya rồi; nói hết. **Không câu nào treo.**
- Nguồn: người dùng báo lại, kèm ảnh chụp câu cuối. Agent không quan sát trực tiếp, không có log; không có số FPS/thời gian nạp từ lượt này.
- Gloss: chỉ **19/63** câu demo có gloss theo luật khớp chính xác gloss tham chiếu (agent chạy lại `textToSiGML` trên
  `data/pack/demo_pack.json` ngày 2026-11-13: khớp nguyên chuỗi 19/63; nếu coi `_` như dấu cách thì 22/63).
  Gloss tham chiếu **chưa được người hiểu VSL xác nhận**. Avatar ký đúng theo dữ liệu, không có nghĩa là câu ký đúng VSL.

**Chưa kiểm chứng:** bấm tay (không CDP) ở chế độ polyfill / XSLT tắt trên **Edge**; bấm tay có ghi log/FPS trên Chrome;
bản Chrome thật sự tắt XSLT mặc định (Chrome 158 stable, 17/11/2026).
`tools/xslt_equiv.html` đã sửa (thêm chế độ chỉ-polyfill + hash); lượt so trực tiếp chạy lại sau khi sửa vẫn 124/124 + 63/63.

## Polyfill XSLT (2026-11-12)

**Đã làm:** tải `xslt-polyfill@1.0.33` (BSD-3-Clause, mfreed7/xslt_polyfill), kiểm sha512 khớp npm, chỉ chép
`xslt-polyfill.min.js` + `LICENSE` vào `vendor/xslt-polyfill/` (bị `.gitignore`, không commit).
`demo.html?xslt=polyfill` = chế độ ÉP (xóa `XSLTProcessor` gốc trước khi nạp polyfill và `allcsa.js`); mặc định giữ hành vi cũ.

**Phát hiện khi tích hợp (đã kiểm chứng trên Chrome 157):**
- Nạp polyfill SAU `allcsa.js` → Wasm lỗi `Cannot read properties of undefined (reading 'buffer')`. Phải nạp TRƯỚC. Cơ chế xung đột chưa rõ.
- Ở 1.0.33 `xsltPolyfillReady` là **hàm** trả Promise; trước khi Wasm sẵn sàng mọi transform ném lỗi → `demo.js` đợi rồi mới `CWASA.init`.

**Kiểm tương đương** (`tools/xslt_equiv.html`: cùng `HtoG` + `h2s.xsl` của CWASA, chỉ khác bộ XSLT; chạy qua CDP):

| Trình duyệt | 124 hns_sign | 63 câu demo | Ghi chú |
|---|---|---|---|
| Chrome 157.0.8103.50 | 124/124 giống | 63/63 giống | 124 + 242 `hamgestural_sign`, 0 lỗi console |
| Edge 157.0.4341.42 | 124/124 giống | 63/63 giống | như trên |

**Avatar** (10 câu demo đầu, cửa sổ thật, CDP: KHÔNG thăm dò; 1 `Runtime.evaluate`/câu, sự kiện qua `Runtime.addBinding`;
phải thêm cờ tắt phát hiện cửa sổ bị che, nếu không trang ở trạng thái `hidden` và avatar không nạp):

| Tổ hợp | Lượt | Câu xong / gửi | hns_sign gửi = chỉ số `s` khác nhau của `avatarsign` | Nạp avatar (s) | FPS TB (min) |
|---|---|---|---|---|---|
| Chrome native | 3 | 30/30 | 99 = 99 | 0,60–0,75 | 33,7 / 34,1 / 33,8 (min 30,0) |
| Chrome polyfill | 3 | 30/30 | 99 = 99 | 0,59–0,74 | 34,3 / 32,5 / 33,9 (min 29,9) |
| Edge native | 3 | 11/14, **treo 3/3 lượt** (câu #4–#5) | 22 = 22 (câu xong) | 0,76–0,82 | 33,1–34,6 |
| Edge polyfill | 3 | 9/12, **treo 3/3 lượt** (câu #4) | 18 = 18 (câu xong) | 0,62–0,68 | 34,2–36,2 |

- Số sự kiện `avatarsign` thô luôn = hns_sign + 1 mỗi câu (một sự kiện thừa, chưa rõ ý nghĩa); số chỉ số `s` khác nhau = số hns_sign.
- FPS lấy từ hook `avatarfps` (~1 mẫu/s, 25 mẫu/lượt trên Chrome) — ít mẫu, chỉ để so tương đối.
- **Treo trên Edge xảy ra như nhau ở native và polyfill → không do polyfill.** Dấu hiệu: sau `play` không có `animactive`
  (4/6) hoặc có `animactive` nhưng không có `animidle` (2/6), trạng thái trang vẫn "sẵn sàng". Chrome: 0/60 câu treo.
  So với trước: thăm dò mỗi 100 ms → treo cả trên Edge headless. Nay KHÔNG thăm dò vẫn treo trên Edge → nghi vấn "do thăm dò CDP" yếu đi;
  vẫn có thể do CDP nói chung (bấm tay 10 lượt trên Edge không treo, theo lời người dùng). Chưa xác định cơ chế.
- Mỗi lần nạp vẫn có `animgenAllocate: jagid: 0` và `animgenAllocate: Time Format: 0` (cả native và polyfill).
- Dữ liệu thô + script CDP: `evidence/xslt_polyfill/` (bị `.gitignore`).

**Chưa kiểm chứng:** chế độ polyfill khi trình duyệt THẬT SỰ tắt XSLT (mới chỉ giả lập bằng cách xóa `XSLTProcessor`);
bấm tay chế độ polyfill; Edge bấm tay với chế độ polyfill (để phân biệt treo do CDP); mốc Chrome 158 stable (17/11/2026) / Edge 159 (Chrome 157 hiện vẫn còn XSLT).

## M4: demo văn bản → gloss → SiGML → avatar CWASA

**Bố cục avatar:** đã sửa (commit `34a2af8`). Canvas đo được 418×538 qua CDP trên Edge 157. Chi tiết ở `docs/M4_REPORT.md` mục 7.

**Lỗi treo khi phát nhiều câu liên tiếp:** chưa sửa, và **chưa tái hiện ngoài CDP**.
- Qua CDP (`Runtime.evaluate` mỗi 100 ms): 8/10 lượt treo (headless 6/6, cửa sổ thật 1/2, SiGML mẫu UEA 1/2), thường ở câu #2–#3.
- Bấm tay trong Edge thường, không gắn CDP: 10 lượt, mỗi lượt khoảng 6–10 câu, không lượt nào treo. Kết quả do người dùng báo lại; agent không quan sát trực tiếp và không có log.
- Kết luận hiện tại (mức chắc chắn trung bình-cao): lỗi chỉ xuất hiện khi điều khiển qua CDP. Chưa xác định cơ chế cụ thể.
- Không thêm watchdog, không sửa code, không sửa `jas/`.

**Việc còn mở:**
- Nếu thấy treo khi bấm tay: làm watchdog dựa trên hook `avatarfps` (báo lỗi rõ và/hoặc khởi tạo lại avatar), không sửa `jas/`.
- Đo tự động lần sau: giảm tần suất thăm dò CDP hoặc nghe sự kiện qua `Runtime.addBinding`, để xem lỗi treo có còn không.
- `Error: animgenAllocate: jagid: 0` xuất hiện một lần lúc nạp SiGML đầu tiên: chưa rõ có liên quan đến lỗi treo không.
