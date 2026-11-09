# Hướng dẫn đưa "Gradisy" phiên bản 1 lên mạng

Toàn bộ đều dùng gói miễn phí. Các bước có chữ **Sir làm** là việc đụng đến tài khoản, Claude không làm thay.
Tên menu trên các trang có thể khác một chút so với hướng dẫn này, vì các hãng hay đổi giao diện.

## Các file trong thư mục này

| File | Để làm gì |
|---|---|
| `index.html`, `styles.css`, `app.js` | Trang web |
| `config.js` | Chỗ dán 2 mã của Supabase. Để trống thì trang chạy ở chế độ mẫu |
| `schema.sql` | Tạo bảng dữ liệu và luật quyền truy cập trong Supabase |

## Bước 1: Tạo dự án Supabase (Sir làm, khoảng 5 phút)

1. Vào https://supabase.com, đăng nhập bằng GitHub.
2. Bấm **New project**. Đặt tên (ví dụ `nguoi-va-ai`), chọn vùng **Singapore** (gần Việt Nam nhất), đặt mật khẩu cơ sở dữ liệu và **tự cất giữ, không gửi cho ai**.
3. Chọn gói **Free**.

## Bước 2: Tạo bảng dữ liệu (Sir làm, 1 phút)

1. Trong dự án, mở **SQL Editor**, bấm **New query**.
2. Mở file `schema.sql`, chép toàn bộ, dán vào, bấm **Run**.
3. Thấy chữ "Success" là xong.

## Bước 3: Bật đăng nhập bằng Google (Sir làm, khoảng 15 phút)

Phần này dài nhất vì cần tạo "mã đăng nhập" bên Google.

1. Vào https://console.cloud.google.com, tạo một project mới (ví dụ `nguoi-va-ai`).
2. Mở **APIs & Services → OAuth consent screen**: chọn **External**, điền tên ứng dụng, email hỗ trợ, rồi lưu.
3. Mở **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Loại: **Web application**.
   - **Authorized redirect URIs**: dán đường dẫn lấy từ Supabase (Authentication → Providers → Google, có dòng "Callback URL", dạng `https://<mã-dự-án>.supabase.co/auth/v1/callback`).
4. Google cho ra **Client ID** và **Client secret**. Dán cả hai vào Supabase: **Authentication → Providers → Google**, bật lên, lưu.
   Client secret là mã bí mật: chỉ dán vào Supabase, không dán vào code, không gửi cho ai.

## Bước 4: Dán 2 mã công khai vào `config.js` (Sir làm hoặc gửi Claude)

1. Supabase → **Project Settings → API**.
2. Chép **Project URL** và khoá **anon / publishable**.
3. Dán vào `config.js`.

Khoá `anon` được phép công khai. **Không** dùng khoá `service_role` (khoá này mở toàn quyền dữ liệu).

## Bước 5: Đưa web lên GitHub Pages (Claude làm, sau khi Sir đồng ý)

Đề xuất: tạo một kho mới tên `gradisy` trên tài khoản GitHub `alexhayes-ai`. Web sẽ có địa chỉ:
`https://alexhayes-ai.github.io/gradisy/`

Sau đó quay lại Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://alexhayes-ai.github.io/gradisy/`
- **Redirect URLs**: thêm đúng địa chỉ trên.

## Bước 6: Thử lần đầu

1. Mở địa chỉ web, bấm **Đăng nhập bằng Google**.
2. Tạo hồ sơ, đăng 1 việc.
3. Nhờ 1 người bạn đăng nhập, bấm **Kết nối** với Sir, thử sửa hồ sơ của Sir (phải KHÔNG được).

## Việc cần nhớ sau khi chạy thật

- **Dự án miễn phí tự tạm dừng** nếu một tuần ít hoạt động. Dữ liệu vẫn còn, vào bảng điều khiển Supabase bấm khởi động lại.
- **Xem báo cáo nội dung xấu**: Supabase → Table Editor → bảng `reports`. Xoá bài vi phạm ở bảng `works` hoặc `worries`.
- **Dữ liệu cá nhân**: trước khi quảng bá rộng, nên có trang chính sách quyền riêng tư đầy đủ (Việt Nam có quy định về bảo vệ dữ liệu cá nhân). Chân trang hiện chỉ có một đoạn ngắn.
