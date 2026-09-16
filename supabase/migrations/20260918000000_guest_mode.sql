alter table public.nhatro_monthly
  add column if not exists guest_mode text default 'chung';

alter table public.nhatro_monthly
  add column if not exists guest_people int default 1;