-- Chứng cứ ngày khách qua đêm (khách đêm): danh sách ngày trong tháng ghi nhận
alter table nhatro_monthly
  add column if not exists guest_dates text[] default '{}';