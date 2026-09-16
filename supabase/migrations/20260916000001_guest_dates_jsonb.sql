-- Chuyển guest_dates từ text[] (danh sách chuỗi ngày) sang jsonb (record {date,name,relation})
-- giữ chuỗi ngày cũ -> chuyển thành {date, name:'', relation:''}
alter table nhatro_monthly add column guest_dates_new jsonb default '[]';
update nhatro_monthly
  set guest_dates_new = (
    select coalesce(jsonb_agg(
      case jsonb_typeof(e)
        when 'object' then e
        else jsonb_build_object('date', e #>> '{}', 'name', '', 'relation', '')
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(to_jsonb(coalesce(guest_dates, '{}'::text[]))) e
  );
alter table nhatro_monthly drop column guest_dates;
alter table nhatro_monthly rename column guest_dates_new to guest_dates;
alter table nhatro_monthly alter column guest_dates set default '[]'::jsonb;