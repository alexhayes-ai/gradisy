-- ============================================================
-- Gradisy · Cơ sở dữ liệu phiên bản 1
-- Dán toàn bộ file này vào Supabase > SQL Editor > Run.
-- Chạy lại nhiều lần vẫn an toàn (dùng "if not exists").
-- ============================================================

-- 1. Hồ sơ: mỗi người đăng nhập có đúng 1 hồ sơ, id trùng với tài khoản.
--    KHÔNG lưu email ở đây: email nằm trong phần đăng nhập của Supabase, không ai khác đọc được.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  headline     text check (char_length(headline) <= 120),
  industry     text not null check (industry in ('thiet-ke','quang-cao','noi-dung','khac')),
  ai_level     smallint not null check (ai_level between 1 and 7),
  ai_tools     text check (char_length(ai_tools) <= 80),
  style        text check (char_length(style) <= 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Việc đã làm (mẫu 6 ô). Có link bằng chứng thì hiện nhãn "Có bằng chứng".
create table if not exists public.works (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 120),
  problem      text not null check (char_length(problem) between 3 and 600),
  ai_used      text not null check (char_length(ai_used) between 1 and 120),
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https://' and char_length(evidence_url) <= 500)),
  result       text not null check (char_length(result) between 3 and 800),
  saved        text check (char_length(saved) <= 200),
  lesson       text not null check (char_length(lesson) between 3 and 800),
  created_at   timestamptz not null default now()
);
create index if not exists works_user_idx on public.works(user_id);
create index if not exists works_created_idx on public.works(created_at desc);

-- 3. Kết nối (người A kết nối với người B).
create table if not exists public.connections (
  follower   uuid not null references public.profiles(id) on delete cascade,
  following  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, following),
  check (follower <> following)
);

-- 4. "Tôi đang lo về..." trong Góc ngành.
create table if not exists public.worries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  industry   text not null check (industry in ('thiet-ke','quang-cao','noi-dung','khac')),
  body       text not null check (char_length(body) between 5 and 500),
  created_at timestamptz not null default now()
);

-- 5. "Tôi đã thử làm theo": mỗi người chỉ đánh dấu 1 lần cho mỗi việc.
create table if not exists public.tried (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  work_id    uuid not null references public.works(id) on delete cascade,
  worked     boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

-- 6. Báo cáo nội dung xấu. Chỉ chủ dự án đọc được (trong bảng điều khiển Supabase).
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('work','worry','profile')),
  target_id   uuid not null,
  reason      text check (char_length(reason) <= 300),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- LUẬT QUYỀN TRUY CẬP (Row Level Security)
-- Nguyên tắc: ai cũng ĐỌC được nội dung công khai;
-- mỗi người chỉ được THÊM / SỬA / XOÁ nội dung của chính mình.
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.works       enable row level security;
alter table public.connections enable row level security;
alter table public.worries     enable row level security;
alter table public.tried       enable row level security;
alter table public.reports     enable row level security;

-- Xoá luật cũ (nếu chạy lại file) rồi tạo lại.
drop policy if exists "doc cong khai" on public.profiles;
drop policy if exists "tao ho so cua minh" on public.profiles;
drop policy if exists "sua ho so cua minh" on public.profiles;
drop policy if exists "xoa ho so cua minh" on public.profiles;
create policy "doc cong khai"      on public.profiles for select using (true);
create policy "tao ho so cua minh" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "sua ho so cua minh" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "xoa ho so cua minh" on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "doc cong khai" on public.works;
drop policy if exists "dang viec cua minh" on public.works;
drop policy if exists "sua viec cua minh" on public.works;
drop policy if exists "xoa viec cua minh" on public.works;
create policy "doc cong khai"      on public.works for select using (true);
create policy "dang viec cua minh" on public.works for insert to authenticated with check (auth.uid() = user_id);
create policy "sua viec cua minh"  on public.works for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xoa viec cua minh"  on public.works for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "doc cong khai" on public.connections;
drop policy if exists "ket noi cua minh" on public.connections;
drop policy if exists "huy ket noi cua minh" on public.connections;
create policy "doc cong khai"        on public.connections for select using (true);
create policy "ket noi cua minh"     on public.connections for insert to authenticated with check (auth.uid() = follower);
create policy "huy ket noi cua minh" on public.connections for delete to authenticated using (auth.uid() = follower);

drop policy if exists "doc cong khai" on public.worries;
drop policy if exists "dang lo cua minh" on public.worries;
drop policy if exists "xoa lo cua minh" on public.worries;
create policy "doc cong khai"    on public.worries for select using (true);
create policy "dang lo cua minh" on public.worries for insert to authenticated with check (auth.uid() = user_id);
create policy "xoa lo cua minh"  on public.worries for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "doc cong khai" on public.tried;
drop policy if exists "danh dau cua minh" on public.tried;
drop policy if exists "doi danh dau cua minh" on public.tried;
drop policy if exists "bo danh dau cua minh" on public.tried;
create policy "doc cong khai"         on public.tried for select using (true);
create policy "danh dau cua minh"     on public.tried for insert to authenticated with check (auth.uid() = user_id);
create policy "doi danh dau cua minh" on public.tried for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bo danh dau cua minh"  on public.tried for delete to authenticated using (auth.uid() = user_id);

-- Báo cáo: chỉ được GỬI, không ai đọc được qua trang web.
drop policy if exists "gui bao cao" on public.reports;
create policy "gui bao cao" on public.reports for insert to authenticated with check (auth.uid() = reporter);

-- Cấp quyền cho trang web (luật ở trên vẫn giới hạn từng dòng).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.works, public.connections, public.worries, public.tried to anon, authenticated;
grant insert, update, delete on public.profiles, public.works, public.tried to authenticated;
grant insert, delete on public.connections, public.worries to authenticated;
grant insert on public.reports to authenticated;
