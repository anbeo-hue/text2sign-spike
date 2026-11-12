# text2sign-spike

Dự án thử độc lập: **văn bản tiếng Việt → gloss → SiGML → avatar CWASA**, chạy trong trình duyệt, ngoại tuyến.
Đây là bản thử kỹ thuật; luật gloss và từ điển **chưa được người hiểu VSL xác nhận**.

## Chạy demo

Yêu cầu: Python 3.11, Node 24 (chỉ cần cho test/công cụ). Không cài thư viện ngoài.

```
python tools/build_pack.py                     # sinh data/pack/demo_pack.json (cục bộ, không commit)
python -m http.server 8080 --bind 127.0.0.1
# mở http://127.0.0.1:8080/demo.html
```

Cần có sẵn ở gốc (không kèm trong repo, đã nằm trong `.gitignore`):

- `jas/loc2025/` — CWASA/JASigning của UEA, dùng **nguyên vẹn, không sửa**.
- `BSLExamples/` — ví dụ SiGML tham chiếu (chỉ đọc).
- `data/external/vsl-hamnosys/` — dữ liệu raianrido/VSL.

Test và đánh giá:

```
node --test
node tools/eval_gloss.mjs
python tools/analyze_data.py
python tools/dict_to_sigml.py
```

## Cấu hình CWASA

- `demo.html` nạp `jas/loc2025/cwa/cwasa.css` và `jas/loc2025/cwa/allcsa.js` bằng đường dẫn tương đối.
- `allcsa.js` có `jasBase` mặc định cứng là `http://localhost/jas/loc2025/`. Vì vậy `src/demo.js` gọi
  `CWASA.init({ jasBase, useClientConfig: true, clientBase })`, với `jasBase` tính từ URL trang
  (`new URL('jas/loc2025/', location.href)`). Không sửa file nào trong `jas/`.
- `cwaclientcfg.json` ở gốc do dự án tự viết (không chép từ UEA), gồm:
  - `avs`: danh sách avatar.
  - `avSettings[0]`: `width`, `height`, `avList`, `initAv`, `allowSiGMLText`, `allowFrameSteps`.
  Các khóa này lấy theo các giá trị mặc định mà `allcsa.js` đọc (`Config.load`) và theo các trang mẫu trong `jas/loc2025`.

## XSLT và polyfill

CWASA chuyển H-SiGML (`hns_sign`) sang G-SiGML bằng `XSLTProcessor` với `jas/loc2025/cwa/h2s.xsl`.
Các trình duyệt đang gỡ XSLT. Lịch dưới đây do chủ dự án cung cấp ngày 2026-11-11, **chưa kiểm chứng lại với nguồn chính thức**:

| Trình duyệt | Mốc |
|---|---|
| Chrome | Tắt XSLT mặc định từ **Chrome 155 (17/11/2026)** |
| Edge | Tắt mặc định từ **Edge 159 (giữa tháng 12/2026)**; chính sách `XSLTEnabled` chỉ bật lại tạm thời đến **Edge 176 (mùa hè 2027)** |

Ghi chú: ngày 2026-11-11, Chrome 157 và Edge 157 trên máy này **vẫn còn** `XSLTProcessor`. Điều này không khớp với mốc
"Chrome 155 tắt từ 17/11/2026" ở trên, nên mốc đó cần đối chiếu lại.

Polyfill: **xslt-polyfill 1.0.33** (npm `xslt-polyfill`, mã nguồn https://github.com/mfreed7/xslt_polyfill, tác giả Mason Freed),
giấy phép **BSD-3-Clause**. Tarball `xslt-polyfill-1.0.33.tgz` khớp integrity
`sha512-GFKg8/M20hbSWLgEBa0ucs36Fhun1gcIymJTw5vz5Suao+00g0KV2/6M4HF5kJ4oB36PfIkHJCVgejPNs5ZMlw==`.
Chỉ chép `xslt-polyfill.min.js` (sha256 `0fd640a8…6b4d14`, đã nhúng Wasm, không cần `dist/xslt-wasm.js`) và `LICENSE`
vào `vendor/xslt-polyfill/`. `vendor/` nằm trong `.gitignore`, không commit. Polyfill biên dịch libxslt/libxml2 sang Wasm;
file `min.js` chỉ ghi bản quyền BSD của tác giả, không kèm thông báo giấy phép riêng của libxslt/libxml2.

Thiết kế trong `demo.html`:

- Một script thường chạy trước `allcsa.js`:
  - mặc định: nếu có `XSLTProcessor` native thì dùng native, không nạp polyfill;
  - `demo.html?xslt=polyfill` (chế độ ÉP): xóa `window.XSLTProcessor` gốc rồi nạp polyfill;
  - nếu không có native: nạp polyfill (đặt `xsltUsePolyfillOnlyIfNeeded = true` để không bao giờ thay bản native).
- Polyfill được chèn bằng `document.write` **trước** `allcsa.js`. Thứ tự này bắt buộc: nạp polyfill **sau** `allcsa.js`
  thì Wasm khởi tạo lỗi (`Cannot read properties of undefined (reading 'buffer')`, thấy trên Chrome 157).
- Wasm nạp bất đồng bộ; trước khi sẵn sàng, mọi phép biến đổi đều ném lỗi. `src/demo.js` đợi `xsltPolyfillReady` rồi mới gọi `CWASA.init`.
  Ở bản 1.0.33, `xsltPolyfillReady` là **hàm** trả về Promise (README của gói nói là "promise").
- Ô "XSLTProcessor" ghi rõ `native` hay `polyfill` (kèm "ÉP" nếu bật chế độ ép). Ô "Ký hiệu lần gần nhất" so số
  `hns_sign` gửi đi với số sự kiện `avatarsign`.

Kiểm tương đương: `tools/xslt_equiv.html` (mở qua server, trên trình duyệt còn XSLT native) dùng chính `HtoG` của CWASA
(parser HamNoSys + `h2s.xsl`) với hai bộ XSLT, native và polyfill, rồi so chuỗi G-SiGML cho mọi `hns_sign`
trong `data/pack/demo_pack.json` và cả 63 câu demo. Trang chỉ đọc dữ liệu. Kết quả xem `docs/STATUS.md`.

## Giấy phép và nguồn bên thứ ba (không commit vào repo)

| Thành phần | Giấy phép | Ghi chú |
|---|---|---|
| CWASA / JASigning (UEA), `jas/loc2025` | Creative Commons BY-NC-ND 4.0 (theo chân trang các trang mẫu trong `jas/loc2025/cwa/`) | Dùng nguyên vẹn, không sửa, không phân phối lại |
| BSLExamples | theo UEA | Chỉ đọc để lấy tập thẻ hợp lệ |
| raianrido/VSL (từ điển, DataTrain, Synonyms) | GPL-3.0 | Chỉ thử cục bộ; repo chỉ chứa thống kê |
| xslt-polyfill 1.0.33 (mfreed7/xslt_polyfill) | BSD-3-Clause | `vendor/xslt-polyfill/` (chỉ `min.js` + `LICENSE`), không commit |

Hiện chưa dùng mã nào từ repo hand-gesture-recognition-using-mediapipe (Apache-2.0); nếu dùng sẽ ghi nguồn tại đây.

## Tài liệu

- `docs/DATA_REPORT.md` (M1)
- `docs/SIGML_REPORT.md` (M2)
- `docs/GLOSS_REPORT.md` (M3)
- `docs/M4_REPORT.md` (M4)
