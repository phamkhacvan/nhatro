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
