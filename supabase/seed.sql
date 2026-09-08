-- ============================================================
-- Nhatro - schema & seed
-- Chạy trong Supabase SQL Editor (hoặc qua Management API)
-- Bảng đặt tên nhatro_* để nằm chung public schema an toàn
-- ============================================================

-- Người dùng hệ thống (multi-tenant)
create table if not exists nhatro_users (
  id serial primary key,
  email text unique not null,
  name text default '',
  password_hash text not null,
  active_house_id int,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Nhà trọ (nhiều nhà, mỗi nhà có cấu hình + tháng hiện tại riêng)
create table if not exists nhatro_houses (
  id serial primary key,
  owner_id int references nhatro_users(id),
  name text not null,
  address text default '',
  due_text text default 'từ ngày 01 đến ngày 05 dương lịch hằng tháng',
  transfer_note text default 'Quét mã QR bên dưới phiếu để chuyển khoản.',
  note text default 'Cảm ơn bạn đã thanh toán đúng hạn.',
  elec_rate numeric default 3500,
  water_rate numeric default 120000,
  wifi_rate numeric default 100000,
  max_occupancy int default 2,
  cur_ky text default '2026-09',
  created_at timestamptz default now()
);
create index if not exists idx_nhatro_houses_owner on nhatro_houses (owner_id);
insert into nhatro_houses (id, name, address) values
  (1, 'Căn hộ dịch vụ Long Trường', '38/20 Đường 6, Khu Phố 26, Phường Long Trường, TP.HCM')
on conflict (id) do nothing;

-- Cài đặt chung: xác định nhà trọ đang dùng
create table if not exists nhatro_settings (
  id int primary key default 1,
  active_house_id int not null default 1,
  updated_at timestamptz default now()
);
insert into nhatro_settings (id) values (1) on conflict (id) do nothing;

create table if not exists nhatro_prices (
  house_id int not null default 1,
  occupancy int not null,
  price numeric not null,
  primary key (house_id, occupancy)
);
insert into nhatro_prices (house_id, occupancy, price) values
  (1, 1, 2500000), (1, 2, 3000000)
on conflict (house_id, occupancy) do update set price = excluded.price;

create table if not exists nhatro_rooms (
  id serial primary key,
  house_id int not null default 1,
  room text not null,
  tenant text default '',
  phone text default '',
  occupancy int default 1 check (occupancy between 0 and 2),
  move_in date,
  email text,
  deposit bigint default 0,
  deposit_date date,
  washing_machine boolean default false,
  active boolean default true
);
create unique index if not exists uq_nhatro_rooms_house on nhatro_rooms (house_id, room);
insert into nhatro_rooms (house_id, room, tenant, phone, occupancy, move_in, email, deposit, deposit_date) values
  (1, '301', '', '', 0, null, null, 0, null),
  (1, '302', 'VÕ KỲ NHIÊN', '0393146549', 1, null, null, 0, null),
  (1, '303', 'TỪ SĨ HÒA AN', '0819297958', 1, null, null, 0, null),
  (1, '304', '', '', 1, null, null, 0, null),
  (1, '401', 'PHẠM VĂN CHÍ', '0328128713', 1, null, null, 0, null),
  (1, '402', 'HUỲNH ANH THY - LÊ NGUYỄN MỸ HẠNH', '0784879758 / 0777813072', 2, null, null, 0, null),
  (1, '403', 'NGUYỄN BÙI ANH THƠ', '0364565578', 1, null, null, 0, null),
  (1, '404', 'NGUYỄN TRÚC NHƯ', '0886268752', 1, null, null, 0, null)
on conflict (house_id, room) do update
  set tenant = excluded.tenant, phone = excluded.phone, occupancy = excluded.occupancy, move_in = excluded.move_in, email = excluded.email, deposit = excluded.deposit, deposit_date = excluded.deposit_date;

create table if not exists nhatro_contracts (
  id serial primary key,
  house_id int not null default 1,
  room text not null,
  file_name text not null,
  mime text not null,
  size int not null default 0,
  data text not null,
  created_at timestamptz default now()
);
create unique index if not exists uq_nhatro_contracts_house_room on nhatro_contracts (house_id, room);

create table if not exists nhatro_monthly (
  id serial primary key,
  house_id int not null default 1,
  ky text not null,
  room text not null,
  tenant text default '',
  phone text default '',
  occupancy int default 1,
  old_index numeric default 0,
  new_index numeric,
  close_date date,
  move_in date,
  move_out date,
  nights int default 0,
  violations int default 0,
  guest int default 0,
  paid numeric default 0
);
create unique index if not exists uq_nhatro_monthly_house on nhatro_monthly (house_id, ky, room);
create index if not exists idx_nhatro_monthly_house on nhatro_monthly (house_id, ky);