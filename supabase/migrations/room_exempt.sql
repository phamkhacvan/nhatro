alter table nhatro_rooms
  add column if not exists exempt_elec boolean default false,
  add column if not exists exempt_wifi boolean default false,
  add column if not exists exempt_water boolean default false,
  add column if not exists exempt_penalty boolean default false,
  add column if not exists exempt_from text,
  add column if not exists exempt_until text;

-- Giá thuê riêng theo phòng (null = dùng bảng giá theo số người)
alter table nhatro_rooms
  add column if not exists room_price numeric;