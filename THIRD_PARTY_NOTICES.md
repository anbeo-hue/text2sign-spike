# Thông báo thành phần bên thứ ba

Cập nhật: 2026-11-14. Dự án hiện **chỉ chạy cục bộ** trên máy thử. Không thành phần nào dưới đây được commit vào repo
(`jas/`, `vendor/`, `data/`, `unified/s2t/` đều bị `.gitignore`), và dự án **không phân phối lại** chúng.

Tài liệu này **không khẳng định** dự án được phép công bố hay phân phối công khai. Các câu hỏi giấy phép còn mở nằm ở cuối.

"Đã xác minh" nghĩa là đã đọc tận mắt văn bản hoặc trường giấy phép ở nơi ghi trong mục đó. Mục nào không đọc được thì ghi
"chưa xác minh".

---

## 1. CWASA / JASigning (bản cục bộ `jas/loc2025`)

- **Tác giả:** Virtual Humans Group, University of East Anglia (UEA).
- **Phiên bản:** `jasVersionTag` = `loc2025` (đọc trong `jas/loc2025/cwa/cwacfg.json`). Không có số phiên bản khác.
- **Nguồn tải:** chưa ghi lại trong repo.
- **Giấy phép:** Creative Commons BY-NC-ND.
  - **Đã xác minh, một phần:** chân trang các trang mẫu đi kèm có dòng "Available under the Creative Commons BY-NC-ND
    License. JRWG 2021-01-19", liên kết tới `https://creativecommons.org/licenses/by-nc-nd/4.0/`. Ví dụ:
    `jas/loc2025/CWASA-legacy-gui-panel.html`, dòng 68.
  - Bản phân phối không kèm file LICENSE riêng.
  - Chưa xác minh dòng chân trang này áp dụng cho toàn bộ mã `allcsa.js`, cho avatar và cho dữ liệu đi kèm.
- **Cách dùng trong dự án:**
  - `demo.html` nạp `cwa/cwasa.css` và `cwa/allcsa.js` nguyên vẹn, không sửa.
  - Chỉ chạy cục bộ, không phân phối lại.

## 2. Từ điển raianrido/VSL (`data/external/vsl-hamnosys`)

- **Nguồn:** https://github.com/raianrido/VSL (đọc từ `git remote` của bản clone). Commit cục bộ
  `c89e88f19e919fab4895fd6ed40136e073e2fb06` (2019-07-05).
- **Nội dung:** từ điển SiGML/HamNoSys (README ghi 3873 mục), DataTrain1/2, Synonyms.
  - Theo README, đây là sản phẩm của đề tài B2013-16-31 do PGS.TS. Nguyễn Chí Ngôn chủ trì.
- **Giấy phép:** GNU GPL v3.
  - **Đã xác minh:** đọc file `LICENSE` trong bản clone ("GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007",
    sha256 `230184f6…b4f809`).
- **Cách dùng trong dự án:**
  - `tools/` đọc từ điển để dựng `data/pack/demo_pack.json` (không commit).
  - Repo chỉ chứa thống kê (`docs/*_REPORT.md`), không chép mục từ điển hay câu.
  - Chỉ dùng cục bộ, không phân phối lại.

## 3. xslt-polyfill 1.0.33 (`vendor/xslt-polyfill/`)

- **Tác giả:** Mason Freed.
- **Nguồn:**
  - npm `xslt-polyfill@1.0.33`; tarball khớp `dist.integrity` npm.
  - Mã nguồn https://github.com/mfreed7/xslt_polyfill. `gitHead` của bản npm là
    `4c0603c4dc84c17a511816c703c7ce3b936aa56f`.
- **Giấy phép:** BSD-3-Clause.
  - **Đã xác minh:** file `LICENSE` trong tarball npm ("BSD 3-Clause License, Copyright (c) 2025, Mason Freed"). Trường
    `license` trên registry npm cũng ghi `BSD-3-Clause`.
- **Cách dùng trong dự án:**
  - Chỉ chép `xslt-polyfill.min.js` (đã nhúng Wasm) và `LICENSE`.
  - `demo.html` chỉ nạp polyfill khi trình duyệt không có XSLT, hoặc khi ép bằng `?xslt=polyfill`.
  - Chỉ dùng cục bộ, không phân phối lại.

## 4. libxslt và libxml2 (biên dịch sang Wasm bên trong xslt-polyfill)

Hai thư viện này là submodule của repo polyfill. Commit dưới đây đọc từ GitHub API
(`/repos/mfreed7/xslt_polyfill/contents/src/<lib>?ref=4c0603c…`). Makefile ở cùng commit liên kết `libxml-2.0`, `libxslt`
và `libexslt`.

| Thư viện | Repo | Commit | Phiên bản |
|---|---|---|---|
| libxml2 | https://github.com/GNOME/libxml2 | `c34742f3017f6d39f3e4ccae4f70172238160ef8` | 2.15.0 (file `VERSION`) |
| libxslt, gồm libexslt | https://github.com/GNOME/libxslt | `923903c59d668af42e3144bc623c9190a0f65988` | 1.1.44 (`configure.ac`) |

- **Giấy phép:** giấy phép kiểu MIT, ghi trong file `Copyright` của từng repo.
  - **Đã xác minh:** tải nguyên văn từ `raw.githubusercontent.com` tại đúng các commit trên, không sửa, lưu vào
    `vendor/xslt-polyfill/` (không commit):
    - `libxml2-Copyright.txt`, sha256 `5d487388…217626`;
    - `libxslt-Copyright.txt`, sha256 `7e48e290…851819`. File này gồm hai mục: libxslt và libexslt.
  - File `Copyright` của libxml2 ghi rằng `dict.c` và `list.c` có thông báo bản quyền riêng. Khối chú thích đầu hai file đó
    cũng đã trích nguyên văn vào `libxml2-dict.c-header.txt` và `libxml2-list.c-header.txt`.
  - URL và sha256 đầy đủ ghi trong `vendor/xslt-polyfill/SOURCES.txt`.
- **Lưu ý:**
  - File `xslt-polyfill.min.js` và gói npm chỉ ghi bản quyền BSD của tác giả polyfill, không kèm thông báo của
    libxml2/libxslt.
  - Các giấy phép này yêu cầu giữ thông báo bản quyền "in all copies or substantial portions". Nếu sau này phân phối
    polyfill, phải kèm cả các thông báo này.
- **Cách dùng trong dự án:** như mục 3, chỉ dùng cục bộ.

## 5. @mediapipe/tasks-vision 0.10.35 (`unified/s2t/vendor/mediapipe/`)

- **Tác giả:** Google (MediaPipe).
- **Nguồn:** `npm pack @mediapipe/tasks-vision@0.10.35`; sha512 tarball khớp `dist.integrity` npm. Dùng `vision_bundle.mjs`
  và 6 file `wasm/`.
- **Giấy phép:** Apache-2.0.
  - **Đã xác minh, một phần:** trường `"license": "Apache-2.0"` trong `package.json` của gói. Gói không kèm file LICENSE.
  - Văn bản Apache-2.0 lấy từ repo chính thức `google-ai-edge/mediapipe` (file `LICENSE`), lưu ở
    `unified/s2t/vendor/mediapipe/licenses/`.
  - Chi tiết và sha256 ghi trong `unified/s2t/vendor/mediapipe/MANIFEST.txt`.
- **Cách dùng trong dự án:**
  - Trang `unified/s2t/` (bản sao bị `.gitignore`) nạp bản cục bộ trước; nếu thiếu file thì nạp từ mạng.
  - Chỉ dùng cục bộ, không phân phối lại.

## 6. Ba file mô hình MediaPipe

Các file: `hand_landmarker.task`, `pose_landmarker_full.task`, `pose_landmarker_lite.task`.

- **Nguồn:** `storage.googleapis.com/mediapipe-models/...`, đúng các URL `float16/latest` mà `app.js` dùng.
  - URL `latest` không ghim phiên bản; sha256 và `Last-Modified` (04/2023) của bản đã tải ghi trong `MANIFEST.txt`.
- **Giấy phép:** Apache License 2.0.
  - **Đã xác minh, qua model card:** mục "LICENSED UNDER" ở trang 2 của model card "MediaPipe Hands (Lite/Full)"
    (10/2021) và "BlazePose GHUM 3D" (04/2021). Trang tài liệu Hand/Pose Landmarker của MediaPipe liên kết tới hai card
    này. Bản PDF lưu ở `unified/s2t/vendor/mediapipe/licenses/`.
  - Bản thân file `.task` không kèm văn bản giấy phép.
  - Card có trước ngày sửa đổi file `.task`; chưa xác minh card là văn bản áp dụng chính thức cho đúng các file đã tải.
- **Cách dùng trong dự án:** như mục 5, chỉ dùng cục bộ.

## 7. Bộ dữ liệu Kaggle `nguyenanfms/vsl-vietnamese-sign-language-v2`

- **Tên trên Kaggle:** "VSL - Vietnamese Sign Language (Cropped)". Phiên bản 8, cập nhật 2026-06-18.
- **Nguồn:** https://www.kaggle.com/datasets/nguyenanfms/vsl-vietnamese-sign-language-v2
- **Giấy phép theo Kaggle:** "Attribution 4.0 International (CC BY 4.0)".
  - **Đã xác minh, một phần:** đọc trường `licenseNameNullable` qua API công khai
    `kaggle.com/api/v1/datasets/view/nguyenanfms/vsl-vietnamese-sign-language-v2` ngày 2026-11-14.
  - Chưa đọc file giấy phép nào bên trong bộ dữ liệu.
- **Nguồn gốc dữ liệu:** mô tả trên Kaggle ghi dữ liệu lấy từ bộ **VSL400** (người ký được quay) và **video thu thập trên
  mạng** ("online-sourced videos (internet-harvested)").
  - Chưa xác minh giấy phép của VSL400.
  - Chưa xác minh quyền của các video lấy từ mạng.
  - Vì vậy nhãn CC BY 4.0 của bản tổng hợp chưa đủ để kết luận về quyền dùng các phần gốc.
- **Cách dùng trong dự án:**
  - Mô hình nhận diện 19 từ ở `unified/s2t/` được chép từ thư mục ngoài repo `C:\vsl-kaggle-sample`. Thư mục đó có
    `gather_vsl19.py` và một notebook trích keypoint, nên nhiều khả năng mô hình được huấn luyện từ bộ dữ liệu này.
    **Chưa xác minh** quy trình huấn luyện.
  - Repo này không chứa dữ liệu hay trọng số mô hình.

---

## Câu hỏi giấy phép còn mở (chưa có câu trả lời)

1. **UEA (CWASA/JASigning):**
   - Điều khoản NC (phi thương mại) và ND (không phái sinh) có cho phép trình diễn công khai, hoặc đặt trên một website
     công khai, hay không?
   - Nhúng CWASA vào trang của dự án và tự viết lớp điều khiển có bị coi là "phái sinh" không?
   - Cần hỏi bằng văn bản.
2. **Tác giả từ điển raianrido/VSL:**
   - GPL-3.0 áp dụng cho dữ liệu SiGML ra sao?
   - Gói `demo_pack.json` dựng từ từ điển có phải tuân GPL nếu phân phối không?
   - Ghi công và liên hệ thế nào? README có email liên hệ.
3. **Bộ dữ liệu Kaggle:**
   - Quyền dùng VSL400 và các video lấy từ mạng.
   - Mô hình huấn luyện từ dữ liệu này có được công bố hay phân phối không?
4. **Mô hình MediaPipe:** xác nhận model card nào áp dụng cho đúng các file `.task` bản `latest` đã tải.
5. **Phân phối polyfill:** nếu sau này phân phối, phải kèm đủ thông báo của xslt-polyfill, libxml2 (gồm `dict.c`,
   `list.c`), libxslt và libexslt.

Cho tới khi có trả lời, mọi thành phần trên chỉ dùng cục bộ để thử nghiệm.
