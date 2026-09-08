alter table nhatro_rooms
  add column if not exists cccd text default '',
  add column if not exists gender text default '',
  add column if not exists birth_year text default '',
  add column if not exists occupation text default '';

alter table nhatro_monthly
  add column if not exists cccd text default '',
  add column if not exists gender text default '',
  add column if not exists birth_year text default '',
  add column if not exists occupation text default '';