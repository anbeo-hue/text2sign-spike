# Trạng thái dự án (cập nhật 2026-11-12)

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
bấm tay chế độ polyfill; Edge bấm tay với chế độ polyfill (để phân biệt treo do CDP); mốc Chrome 155 / Edge 159 (Chrome 157 hiện vẫn còn XSLT).

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
