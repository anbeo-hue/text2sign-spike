# Báo cáo Từ điển → SiGML (M2)

> Sinh tự động bởi `tools/dict_to_sigml.py`. Chỉ thống kê, tên thẻ, tỉ lệ; không chép mục từ điển. Chi tiết cụ thể ở `data/reports/m2_selection.md` (không commit).

## 1. Nguồn tập thẻ hợp lệ (chỉ đọc)

- BSLExamples: 144 file .sigml
- jas/loc2025/sigml: 23 file .sigml
- h2s.xsl: ánh xạ hnm_*→gestural sao chép nguyên @tag: Shoulder=có, Body=có, Head=có, Eyegaze=có, Eyebrow=có, Eyelids=có, Mouth=có
- allcsa.js: 215 chuỗi "ham..." (bảng thẻ HamNoSys trong CWASA)
- Không tìm thấy file lược đồ DTD/XSD/RNG riêng trong jas/loc2025; devdoc/index.html chỉ trỏ tới javadoc dạng ZIP.
- Tập thẻ Hand hợp lệ (hợp các nguồn): 217 thẻ; theo nguồn: {'BSLExamples': 127, 'allcsa.js': 215, 'jas/sigml': 99}
- Lưu ý: allcsa.js là mã đã rút gọn; chuỗi "ham..." trong đó được coi là bảng thẻ CWASA nhận biết, nhưng chưa kiểm chứng bằng cách chạy avatar.

### Giá trị phi tay hợp lệ theo cột (cột từ điển → thẻ hns)

| Cột | Thẻ hns | Số giá trị hợp lệ | Giá trị dùng trong từ điển có trong tập? |
|---|---|---|---|
| Shoulder | `hnm_shoulder` | 9 | cột rỗng |
| Body | `hnm_body` | 10 | cột rỗng |
| Head | `hnm_head` | 13 | cột rỗng |
| Eyegaze | `hnm_eyegaze` | 15 | AD:3844 ô → hợp lệ |
| Eyebrow | `hnm_eyebrows` | 4 | RB:3873 ô → hợp lệ |
| Eyelids | `hnm_eyelids` | 13 | BB:3844 ô → hợp lệ |
| Mouth | `hnm_mouthgesture` | 79 | mã: 106/106 ô hợp lệ (28 mã khác nhau); 1295 ô chữ viết → bỏ, không chuyển thành khẩu hình |

- **Eyegaze `AD`**: hợp lệ — nguồn: ['jas/sigml(gestural)']. Trong jas/loc2025/sigml/nonmanuals-eyegaze.sigml có `<eye_gaze direction="AD"/>` (gloss "AD_towards_addressee"), và h2s.xsl chuyển `hnm_eyegaze/@tag` sang `eye_gaze/@direction` nguyên văn → ánh xạ `hnm_eyegaze tag="AD"`.
- **Kết luận:** SiGML sinh ra gần như chỉ có tay, cùng lông mày `RB`, mắt nhắm/chớp `BB` và nhìn `AD` (Body/Head/Shoulder rỗng trong dữ liệu gốc; Mouth chỉ có số ít mã).

## 2. Kết quả chuyển đổi toàn bộ từ điển (trong bộ nhớ)

- Số mục đọc: 3873
- Sinh được và qua kiểm tra xml.etree: **3858** (xml_ok=3858, xml_fail=0)
- Bị bỏ: **15**
  - ngoặc hamparbegin/hamparend không cân bằng: 11
  - thẻ Hand không có trong tập hợp lệ: 2
  - token Hand sai dạng (không khớp `ham[a-z0-9]+`): 2
- Thẻ Hand lạ: {'hamindxfinger': 2}
- Phi tay đã ánh xạ (lượt): Eyebrow:RB=3858, Eyegaze:AD=3829, Eyelids:BB=3829, Mouth:L07=20, Mouth:L05=20, Mouth:D01=11, Mouth:C02=5, Mouth:L28=4, Mouth:L04=4, Mouth:L03=4, Mouth:D05=4, Mouth:D03=3, Mouth:D02=3, Mouth:C06=3, Mouth:L23=3, Mouth:L02=3, Mouth:C01=2, Mouth:L06=2, Mouth:D08=2, Mouth:L26=2, Mouth:L13=1, Mouth:D09=1, Mouth:L24=1, Mouth:T01=1, Mouth:L22=1, Mouth:L29=1, Mouth:L09=1, Mouth:C04=1, Mouth:L19=1, Mouth:L01=1, Mouth:L11=1
- Phi tay bỏ qua (lượt): Mouth:text=1291
- Từ trùng: không gộp; mỗi dòng sinh một hns_sign riêng. Khi chọn mục thử, chỉ lấy từ có đúng 1 mục.

## 3. Mục thử (`data/sigml/test/`, không commit)

- Tiêu chí: mọi thẻ Hand và giá trị phi tay nằm trong tập hợp lệ; từ chỉ có 1 mục; 8-25 thẻ Hand; 3 chữ số nhỏ nhất đạt tiêu chí + 5 từ xuất hiện nhiều nhất ở vế đích DataTrain1 đạt tiêu chí.
- Đã ghi 8 file ({'chữ số': 3, 'từ thông dụng': 5}); mỗi file được đọc lại từ đĩa bằng `xml.etree.ElementTree.parse` và đối chiếu cấu trúc.
- Số thẻ Hand trong các mục thử: [8, 8, 8, 9, 9, 10, 23, 24]
- Có `hamparbegin`: 3/8
- Ứng viên bị loại: 3; lý do: {'thẻ Hand': 2, 'mục trùng từ': 1}

## 4. Chưa kiểm chứng

- Chưa phát các file trên avatar CWASA (việc sau M3).
- Tập thẻ từ allcsa.js suy từ chuỗi trong mã, chưa có lược đồ chính thức.
- Chưa có người hiểu VSL xác nhận ký hiệu.
