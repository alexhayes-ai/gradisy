-- Bảng lưu khách để lại thông tin qua "Trợ lý tư vấn" trên web công ty (cong-ty/).
-- CÁCH CHẠY: Supabase > dự án nguoi-va-ai > SQL Editor > dán toàn bộ file này > Run. Chạy lại nhiều lần vẫn an toàn.
-- Quyền: ai cũng CHỈ THÊM được (không xem, không sửa, không xoá). Chỉ tài khoản trong bảng admins mới XEM được.

create table if not exists public.khach_tu_van (
  id          bigint generated always as identity primary key,
  tao_luc     timestamptz not null default now(),
  ten         text not null check (char_length(ten) between 1 and 80),
  lien_he     text not null check (char_length(lien_he) between 5 and 120),
  ghi_chu     text check (char_length(ghi_chu) <= 500),
  nganh       text check (char_length(nganh) <= 80),
  viec        text check (char_length(viec) <= 200),
  gio         text check (char_length(gio) <= 40),
  dang_dung   text check (char_length(dang_dung) <= 60),
  goi_y       text check (char_length(goi_y) <= 60),
  trang       text check (char_length(trang) <= 120),
  da_lien_he  boolean not null default false
);

alter table public.khach_tu_van enable row level security;

drop policy if exists "ai cung gui duoc" on public.khach_tu_van;
create policy "ai cung gui duoc" on public.khach_tu_van
  for insert to anon, authenticated
  with check (da_lien_he = false);

drop policy if exists "quan tri xem" on public.khach_tu_van;
create policy "quan tri xem" on public.khach_tu_van
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "quan tri danh dau" on public.khach_tu_van;
create policy "quan tri danh dau" on public.khach_tu_van
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

revoke all on public.khach_tu_van from anon, authenticated;
grant insert (ten, lien_he, ghi_chu, nganh, viec, gio, dang_dung, goi_y, trang) on public.khach_tu_van to anon, authenticated;
grant select, update (da_lien_he) on public.khach_tu_van to authenticated;
