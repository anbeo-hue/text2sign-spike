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

Thiết kế trong `demo.html`:

- Một script thường chạy trước `allcsa.js` để kiểm tra `typeof XSLTProcessor`.
- **Chỉ khi không có**, nó chèn (bằng `document.write`, nên vẫn giữ đúng thứ tự đồng bộ)
  `vendor/xslt-polyfill/xslt-polyfill.min.js` trước `allcsa.js`.
- Trang hiển thị trạng thái XSLT (native / polyfill / không có).

**Polyfill CHƯA được tải.** Hiện `vendor/xslt-polyfill/` không tồn tại, nên trên trình duyệt đã gỡ XSLT,
CWASA sẽ không chuyển được SiGML.

- Tên tệp `xslt-polyfill.min.js` là giả định; khi tải sẽ sửa lại đúng tên.
- Giấy phép của xslt-polyfill: **chưa xác minh**. Sẽ ghi đúng tên giấy phép, phiên bản ghim và nguồn
  vào đây sau khi được phép tải và đọc tệp LICENSE đi kèm.

## Giấy phép và nguồn bên thứ ba (không commit vào repo)

| Thành phần | Giấy phép | Ghi chú |
|---|---|---|
| CWASA / JASigning (UEA), `jas/loc2025` | Creative Commons BY-NC-ND 4.0 (theo chân trang các trang mẫu trong `jas/loc2025/cwa/`) | Dùng nguyên vẹn, không sửa, không phân phối lại |
| BSLExamples | theo UEA | Chỉ đọc để lấy tập thẻ hợp lệ |
| raianrido/VSL (từ điển, DataTrain, Synonyms) | GPL-3.0 | Chỉ thử cục bộ; repo chỉ chứa thống kê |
| xslt-polyfill | chưa xác minh | Chưa tải |

Hiện chưa dùng mã nào từ repo hand-gesture-recognition-using-mediapipe (Apache-2.0); nếu dùng sẽ ghi nguồn tại đây.

## Tài liệu

- `docs/DATA_REPORT.md` (M1)
- `docs/SIGML_REPORT.md` (M2)
- `docs/GLOSS_REPORT.md` (M3)
- `docs/M4_REPORT.md` (M4)
