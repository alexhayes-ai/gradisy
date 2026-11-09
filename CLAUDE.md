# Web "Gradisy"

Cộng đồng học cách dùng AI từ người cùng nghề: hồ sơ, việc đã làm (mẫu 6 ô), kết nối, Góc ngành, Tài liệu học.

## File
- `index.html`, `styles.css`, `app.js`: trang web (một trang, không cần cài gì). Sau khi sửa `app.js`/`styles.css`, tăng số `?v=` trong `index.html` để trình duyệt tải bản mới.
- `config.js`: địa chỉ Supabase + khoá anon (được phép công khai). KHÔNG bao giờ dán khoá service_role hay mã bí mật Google vào đây.
- `schema.sql`, `docs.sql`: tạo bảng và luật quyền truy cập trên Supabase (chạy trong SQL Editor).
- `HUONG-DAN.md`: hướng dẫn cài đặt cho Sir.

## Dịch vụ đang dùng (đều gói miễn phí)
- Supabase project `nguoi-va-ai` (id `vqeoctjgmisakzzvyodp`): lưu dữ liệu + đăng nhập. Dữ liệu người dùng nằm ở đây, KHÔNG nằm trên máy.
- Google Cloud project `nguoi-va-ai`: đăng nhập bằng Google. Đang ở chế độ Testing (chỉ email trong danh sách test users đăng nhập được).
- Quản trị viên (được đăng Tài liệu): bảng `admins`, tài khoản của Sir.

## Chạy thử trên máy
`python -m http.server 8765 --bind 127.0.0.1` trong thư mục này, mở http://127.0.0.1:8765

## Quy tắc
- Sir hay livestream: báo che màn hình trước khi mở trang có mã bí mật, mật khẩu, email.
- Hỏi Sir trước khi đẩy code lên GitHub (đăng ra ngoài) hoặc đổi cài đặt tài khoản.
