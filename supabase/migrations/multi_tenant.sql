-- ============================================================
-- Nhatro - Multi-tenant migration
-- Chạy trong Supabase SQL Editor (project nhatro/legaleader-legal-app)
-- ============================================================

-- Bảng người dùng
create table if not exists nhatro_users (
  id serial primary key,
  email text unique not null,
  name text default '',
  password_hash text not null,
  active_house_id int,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Mỗi nhà thuộc về một user chủ sở hữu
alter table nhatro_houses add column if not exists owner_id int references nhatro_users(id);

create index if not exists idx_nhatro_houses_owner on nhatro_houses (owner_id);
