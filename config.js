// Cấu hình kết nối Supabase.
// Để trống = trang chạy ở CHẾ ĐỘ MẪU (dữ liệu giả, chỉ trên máy, không lưu gì).
// Sau khi tạo dự án Supabase, dán 2 giá trị ở Project Settings > API vào đây:
//   - Project URL           -> SUPABASE_URL
//   - anon / publishable key -> SUPABASE_ANON_KEY
// Khoá "anon" được phép công khai: luật quyền truy cập trong schema.sql mới là thứ bảo vệ dữ liệu.
// TUYỆT ĐỐI KHÔNG dán khoá "service_role" vào đây.
window.APP_CONFIG = {
  SUPABASE_URL: "https://vqeoctjgmisakzzvyodp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZW9jdGpnbWlzYWt6enZ5b2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMDU0NDksImV4cCI6MjEwOTY4MTQ0OX0.CewReR3NPKPFhrDjGZAKIbq-OgT-boT6-ufhrRWlqc0",
  APP_NAME: "Gradisy"
};
