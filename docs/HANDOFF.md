# Bàn giao cho lần làm việc sau (2026-11-11, khoảng 12:00)

Người nhận: Claude Code (trong C:\text2sign-spike và C:\AI4life) và Claude trên ứng dụng desktop.
Người dùng đang nghỉ. Khi họ quay lại, mở đầu bằng 3–5 dòng tóm tắt, đừng hỏi dồn.
Tệp này do Claude (ứng dụng desktop) viết sau khi đọc mã và báo cáo của cả hai repo; chưa commit.

## Bối cảnh
- Dự án AI4Life (VKU), "Biên dịch thủ ngữ realtime", hai chiều: ký hiệu → văn bản và văn bản → ký hiệu.
- Hạn có thể là cuối tuần 21–22/11/2026. CHƯA xác nhận đó là hạn nộp hay ngày thi tại chỗ: hỏi người dùng.
- Hai repo: C:\AI4life (web Vite + TypeScript, ml/ PyTorch; luồng ký hiệu → văn bản và avatar mẫu) và
  C:\text2sign-spike (bản thử văn bản → gloss → SiGML → avatar CWASA).
- Người dùng QUYẾT ĐỊNH giữ cả hai chiều trong phạm vi thi. Không tự đề nghị cắt một chiều.

## Đã kiểm chứng (có kết quả chạy thật hoặc người dùng xác nhận)
- Spike M1–M4 đã commit (mới nhất 37acc66). demo.html chạy trên Chrome và Edge (người dùng xác nhận 11/11).
- node --test: 24/24 đạt (theo docs/M4_REPORT.md). Đánh giá gloss: test 216 cặp, khớp chính xác 18,5%.
- Lỗi treo khi phát nhiều câu liên tiếp: chỉ xảy ra khi điều khiển qua CDP (8/10 lượt). Người dùng bấm tay 10 lượt
  trong Edge thường, không lượt nào treo. Đó là lời người dùng báo, không có log; số câu mỗi lượt chỉ là "khoảng 6–10".
  Cơ chế chưa rõ. Không làm watchdog, không sửa jas/ trừ khi người dùng thấy treo khi bấm tay.
- Repo chính: đường ống camera → MediaPipe → vector 272 chiều → 1D-CNN → ONNX có đủ trong mã;
  ml/ có 6 test đạt và web có tsc sạch (theo docs/STATUS.md của repo chính, 10/11).

## CHƯA kiểm chứng / chưa có
- Độ chính xác thật của sign → text: dữ liệu mới có 100 mẫu (20 × 5 nhãn), 1 người, 1 phiên. Con số 100% là trên tập train.
- Nạp ONNX trong trình duyệt; so khớp PyTorch với ONNX (chưa cài onnxruntime cho Python: phải hỏi trước khi cài).
- Ký hiệu và luật gloss CHƯA được người hiểu VSL xác nhận. CWASA chỉ phát đúng theo dữ liệu, không kiểm chứng ngôn ngữ.
- Polyfill XSLT CHƯA tải (vendor/xslt-polyfill/ không tồn tại).
- Bộ dữ liệu Kaggle nguyenanfms/vsl-vietnamese-sign-language-v2 chưa đọc được nội dung
  (trang không hiện danh sách file, số mẫu, giấy phép; sandbox không có mạng để tải).

## Việc tiếp theo (theo thứ tự ưu tiên)
1. XSLT: Chrome dự kiến ngừng XSLT từ Chrome 155 (17/11/2026), trước hạn. Hỏi người dùng rồi tải polyfill, đọc giấy phép,
   thử trên Chrome/Edge bản mới. README ghi Edge 159 (giữa tháng 12), chưa kiểm chứng.
2. Từ ứng viên để nhờ người hiểu VSL xác nhận (chọn theo tần suất trong 63 câu demo và độ ngắn mục từ điển,
   KHÔNG phải theo độ đúng): tôi, anh, em, cháu, không, có, này, được, cần, cấm, làm, ăn, nói, mưa, hoa.
   Dự phòng: đi, sách, đau, bây_giờ. Hỏi người xác nhận: ký hiệu có đúng ở vùng của họ không, một hay hai tay,
   có phụ thuộc nét mặt/khẩu hình không, có dễ nhầm với từ khác trong danh sách không.
3. Bộ dữ liệu Kaggle: nhờ người dùng dán Data Explorer (cây thư mục, dung lượng, giấy phép) hoặc tải về và thêm thư mục.
   Kiểm 4 điểm: giấy phép/nguồn gốc; định dạng (nếu video thì phải trích landmark bằng đúng bộ chuẩn hóa 272 chiều);
   chữ "Cropped" có thể làm mất hai vai (dự án dùng khoảng cách vai để chuẩn hóa: đây chỉ là suy đoán);
   từ vựng và biến thể vùng miền so với danh sách ở mục 2.
4. Thu dữ liệu sign → text: ít nhất 2–3 phiên, tốt nhất 2 người, 25–30 mẫu mỗi nhãn. Chia train/val theo người hoặc phiên.
   Nếu độ chính xác trên người/phiên chưa thấy thấp thì GIẢM số từ, đừng cố giữ số lượng.
5. Kiểm chứng luồng A trong trình duyệt, ghi FPS và độ trễ lấy từ lần chạy thật.
6. Quyết định có đưa pipeline của spike vào web chính hay trình diễn riêng (xem giấy phép bên dưới).

## Giấy phép (đọc trước khi gộp mã hoặc đưa lên công khai)
- CWASA/JASigning (UEA): CC BY-NC-ND 4.0 theo README; dùng nguyên vẹn, không sửa, không phân phối lại.
- Dữ liệu raianrido/VSL: GPL-3.0; chỉ dùng thử cục bộ.
- xslt-polyfill: chưa xác minh. Repo chính đang proxy tới máy chủ UEA trong cấu hình Vite.

## Quy tắc làm việc (từ AGENTS.md, người dùng đặt ra)
- Giải thích bằng tiếng Việt; không ghi "DONE" khi chưa chạy kiểm chứng; không bịa số liệu.
- Hỏi trước khi cài hoặc tải thư viện; không xóa file; không git push; không đụng data/ khi chưa được phép.
- Cuối mỗi việc liệt kê file đã sửa (git diff --stat).

## Tài liệu liên quan
- docs/STATUS.md, docs/M4_REPORT.md (mục 7–8), docs/GLOSS_REPORT.md, docs/SIGML_REPORT.md, docs/DATA_REPORT.md.
- File Word tổng hợp "AI4Life_cong_nghe_va_thuat_toan.docx" đã gửi trong cuộc trò chuyện (chưa nằm trong repo).
