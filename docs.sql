-- ============================================================
-- Gradisy · Thêm mục TÀI LIỆU HỌC (chạy sau schema.sql)
-- Ai cũng đọc được. Chỉ quản trị viên (Sir) được đăng / sửa / xoá.
-- Chạy lại nhiều lần vẫn an toàn.
-- ============================================================

-- 1. Danh sách quản trị viên. Mỗi người chỉ đọc được dòng của chính mình.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "xem minh co phai quan tri" on public.admins;
create policy "xem minh co phai quan tri" on public.admins for select to authenticated using (auth.uid() = user_id);
grant select on public.admins to authenticated;

-- Sir là quản trị viên (id tài khoản của Sir trên web).
insert into public.admins (user_id) values ('bd0c4cbd-a412-4d3d-97b2-299c8f05cc2c') on conflict do nothing;

-- 2. Tài liệu học: có link (Google Doc, PDF, video...) hoặc nội dung viết trực tiếp, hoặc cả hai.
create table if not exists public.docs (
  id         uuid primary key default gen_random_uuid(),
  author     uuid references public.profiles(id) on delete set null,
  title      text not null check (char_length(title) between 3 and 160),
  summary    text check (char_length(summary) <= 400),
  topic      text not null check (char_length(topic) between 1 and 60),
  link       text check (link is null or (link ~ '^https://' and char_length(link) <= 500)),
  body       text check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (link is not null or body is not null)
);
create index if not exists docs_created_idx on public.docs(created_at desc);
alter table public.docs enable row level security;

drop policy if exists "doc cong khai" on public.docs;
drop policy if exists "quan tri dang" on public.docs;
drop policy if exists "quan tri sua" on public.docs;
drop policy if exists "quan tri xoa" on public.docs;
create policy "doc cong khai" on public.docs for select using (true);
create policy "quan tri dang" on public.docs for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()) and author = auth.uid());
create policy "quan tri sua" on public.docs for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "quan tri xoa" on public.docs for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
