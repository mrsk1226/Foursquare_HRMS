begin;

alter table if exists public.attendance_logs
  add column if not exists check_in timestamptz,
  add column if not exists check_out timestamptz,
  add column if not exists attendance_date date,
  add column if not exists work_duration integer default 0,
  add column if not exists status text default 'present',
  add column if not exists lat double precision,
  add column if not exists lng double precision;

update public.attendance_logs
set
  attendance_date = coalesce(attendance_date, date, check_in::date, now()::date),
  date = coalesce(date, attendance_date, check_in::date, now()::date),
  work_duration = case
    when check_in is not null and check_out is not null
      then greatest(0, extract(epoch from (check_out - check_in))::integer)
    else coalesce(work_duration, 0)
  end,
  status = coalesce(status, 'present');

create or replace function public.normalize_attendance_log()
returns trigger
language plpgsql
as $$
begin
  new.attendance_date := coalesce(new.attendance_date, new.date, new.check_in::date, current_date);
  new.date := coalesce(new.date, new.attendance_date, new.check_in::date, current_date);

  if new.check_in is not null and new.check_out is not null then
    new.work_duration := greatest(0, extract(epoch from (new.check_out - new.check_in))::integer);
  else
    new.work_duration := coalesce(new.work_duration, 0);
  end if;

  new.status := coalesce(new.status, 'present');
  return new;
end;
$$;

drop trigger if exists trg_normalize_attendance_log on public.attendance_logs;
create trigger trg_normalize_attendance_log
before insert or update on public.attendance_logs
for each row execute function public.normalize_attendance_log();

create index if not exists idx_attendance_logs_employee_date
  on public.attendance_logs (employee_id, date desc);

create index if not exists idx_attendance_logs_active_now
  on public.attendance_logs (date, employee_id)
  where check_in is not null and check_out is null;

create index if not exists idx_leave_requests_employee_status_dates
  on public.leave_requests (employee_id, status, start_date, end_date);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_employee_id, is_read, created_at desc);

create index if not exists idx_announcements_created_at
  on public.announcements (created_at desc);

do $$
begin
  if not exists (
    select 1
    from public.attendance_logs
    where employee_id is not null and date is not null
    group by employee_id, date
    having count(*) > 1
  ) then
    create unique index if not exists attendance_logs_employee_date_unique
      on public.attendance_logs (employee_id, date);
  else
    raise notice 'Duplicate attendance rows exist; unique employee/date index was skipped. Review duplicate rows before enabling the unique index.';
  end if;
end;
$$;

alter table public.attendance_logs enable row level security;
alter table public.attendance_logs replica identity full;
alter table public.leave_requests replica identity full;
alter table public.announcements replica identity full;
alter table public.notifications replica identity full;

create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role, 'employee') from public.profiles where id = auth.uid()
$$;

drop policy if exists attendance_logs_select_scoped on public.attendance_logs;
create policy attendance_logs_select_scoped on public.attendance_logs
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or public.current_user_role() in ('admin', 'hr', 'md')
);

drop policy if exists attendance_logs_insert_own on public.attendance_logs;
create policy attendance_logs_insert_own on public.attendance_logs
for insert to authenticated
with check (
  employee_id = public.current_employee_id()
  or public.current_user_role() in ('admin', 'hr', 'md')
);

drop policy if exists attendance_logs_update_scoped on public.attendance_logs;
create policy attendance_logs_update_scoped on public.attendance_logs
for update to authenticated
using (
  employee_id = public.current_employee_id()
  or public.current_user_role() in ('admin', 'hr', 'md')
)
with check (
  employee_id = public.current_employee_id()
  or public.current_user_role() in ('admin', 'hr', 'md')
);

do $$
begin
  alter publication supabase_realtime add table public.attendance_logs;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.leave_requests;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end;
$$;

commit;
