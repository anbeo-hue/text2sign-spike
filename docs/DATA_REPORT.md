# Báo cáo dữ liệu VSL HamNoSys (M1)

> Sinh tự động bởi `tools/analyze_data.py`. Chỉ chứa thống kê, tên cột/thẻ và tỉ lệ; không chép mục từ điển hay câu. Nguồn: raianrido/VSL (GPL-3.0), chỉ dùng thử cục bộ.

## 1. Từ điển (`Dictionary VSL HamNoSys`)

- Cột: Word, Mouth, Body, Head, Shoulder, Eyegaze, Eyebrow, Eyelids, Hand
- Số mục (dòng dữ liệu): **3873**; phân bố số cột/dòng: {9: 3873}
- Số từ khác nhau: 3564; từ xuất hiện >1 lần: 258 (thừa 309 dòng); trong đó khác nội dung Hand: 121
- Từ có `_` (từ ghép): 2186; từ là chữ số: 39; từ có khoảng trắng: 0
- Từ chỉ gồm ASCII: 2190; có ký tự ngoài ASCII (có dấu): 1374. **Khác mô tả:** cột Word lẫn tiếng Việt có dấu, tiếng Việt không dấu và từ tiếng Anh (quan sát thủ công trên mẫu ngẫu nhiên; chưa đếm tách được không dấu/tiếng Anh). Số dạng khác nhau sau khi bỏ dấu + chữ thường: 2371

### Cột phi tay

| Cột | Rỗng | Có giá trị | Dạng mã (A-Z+số) | Không phải mã | Mã (tần suất) |
|---|---|---|---|---|---|
| Mouth | 2472 | 1401 | 106 | 1295 | L07:20, L05:20, D01:11, C02:5, L28:4, L04:4, L03:4, D05:4, D03:3, D02:3, C06:3, L23:3, L02:3, C01:2, L06:2 … (+13 mã) |
| Body | 3873 | 0 | 0 | 0 |  |
| Head | 3873 | 0 | 0 | 0 |  |
| Shoulder | 3873 | 0 | 0 | 0 |  |
| Eyegaze | 29 | 3844 | 3844 | 0 | AD:3844 |
| Eyebrow | 0 | 3873 | 3873 | 0 | RB:3873 |
| Eyelids | 29 | 3844 | 3844 | 0 | BB:3844 |

- Cột Mouth: ô không phải mã có 961 ô trùng nguyên văn cột Word; 439 ô chỉ gồm ký tự ASCII. Phần lớn là chữ viết (khẩu hình theo từ); một số ô trông giống SAMPA như `picture=` trong SiGML mẫu. Không tách chắc chắn được → chưa ánh xạ, cần xác nhận.

### Cột Hand

- Mục rỗng: 0; số thẻ khác nhau: 167
- Số thẻ/mục: min 4, max 107, trung bình 24.6
- Mục có `hamparbegin`: 2636; cặp ngoặc cân bằng: 3862, không cân bằng: 11
- Mục bắt đầu bằng `hamsymm*`: 1930
- Token không khớp mẫu `ham[a-z0-9]+`: 2 loại, 2 lần (ví dụ: 'hamrepeatfromstart !"', 'amcee12')

Top-30 thẻ Hand:

| # | Thẻ | Số lần |
|---|---|---|
| 1 | `hamparbegin` | 7907 |
| 2 | `hamparend` | 7892 |
| 3 | `hamplus` | 5048 |
| 4 | `hambetween` | 4156 |
| 5 | `hamreplace` | 3866 |
| 6 | `hamsmallmod` | 3288 |
| 7 | `hampalmd` | 2939 |
| 8 | `hamflathand` | 2578 |
| 9 | `hamextfingeru` | 2498 |
| 10 | `hamextfingero` | 2408 |
| 11 | `hampalml` | 2313 |
| 12 | `hamthumbacrossmod` | 2148 |
| 13 | `hamthumboutmod` | 1917 |
| 14 | `hamextfingerl` | 1793 |
| 15 | `hamtouch` | 1710 |
| 16 | `hamlrat` | 1514 |
| 17 | `hammoved` | 1475 |
| 18 | `hammovei` | 1379 |
| 19 | `hamfinger2345` | 1341 |
| 20 | `hammover` | 1322 |
| 21 | `hamfinger2` | 1304 |
| 22 | `hamchest` | 1281 |
| 23 | `hampalmu` | 1249 |
| 24 | `hamsymmlr` | 1245 |
| 25 | `hamnomotion` | 1192 |
| 26 | `hamshoulders` | 1103 |
| 27 | `hammovel` | 1080 |
| 28 | `hamfist` | 1044 |
| 29 | `hammoveu` | 1032 |
| 30 | `hamclose` | 996 |

## 2. DataTrain1 / DataTrain2

- DataTrain1: 1287 cặp hợp lệ (dòng lỗi: 0); DataTrain2: 1287 cặp (dòng lỗi: 0)
- Kiểm chứng DataTrain2 = bỏ dấu(DataTrain1) theo từng dòng (NFD, bỏ dấu kết hợp, đ→d): vế nguồn khớp 1287/1287, vế đích khớp 1287/1287, cả hai 1287/1287 → **DataTrain2 không phải dữ liệu độc lập.**
- Câu nguồn DataTrain1 vốn không có dấu: 22
- Cặp khác nhau: 731; cặp trùng (thừa): 556
- Câu nguồn khác nhau: 731; câu nguồn có >1 đích khác nhau: 0
- Cặp mà đích = nguồn (không đổi): 132 (10.3%)
- Đích chỉ là hoán vị token của nguồn: 283 (22.0%); đích ngắn hơn: 1001; dài hơn: 2
- Độ dài trung bình (token tách khoảng trắng): nguồn 7.02, đích 5.03
- Câu có chữ số: nguồn 18, đích 20
- Từ vựng đích: 1262 loại, có trong từ điển (không phân biệt hoa thường): 313 (24.8%); theo lượt token: 44.1%
- Nếu so khớp sau khi bỏ dấu cả hai phía: loại 533 (42.2%); lượt token 59.5% (bỏ dấu gây nhập nhằng, chỉ dùng làm dự phòng)
- Từ vựng nguồn: 1357 loại, có trong từ điển: 328 (24.2%); không có trong từ điển nhưng có trong cột Word của Synonyms: 444

## 3. Synonyms.txt

- Cột: Word, Semilar; số dòng dữ liệu: 12675 (dòng lỗi: 0, dòng trùng: 0, dòng Word=Semilar: 2)
- Số Word khác nhau: 7734; có `_`: 5729; số Semilar/Word: trung bình 1.64, max 10
- Word có trong từ điển: 427 (5.5%)
- Semilar khác nhau: 8941; có trong từ điển: 329 (3.7%)
- Word có ít nhất một Semilar nằm trong từ điển: 505 (6.5%)

## 4. Lưu ý

- Dữ liệu chưa được người hiểu VSL xác nhận; các con số chỉ mô tả tệp, không chứng minh đúng ngữ pháp VSL.
- Ví dụ cụ thể nằm ở `data/reports/m1_examples.txt` (không commit).
