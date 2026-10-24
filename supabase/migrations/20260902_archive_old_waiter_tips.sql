-- Keep permanent anonymous monthly totals while retaining only three calendar months
-- of waiter-level tip records.
create table if not exists public.waiter_tip_monthly_totals (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  month date not null,
  total_amount numeric(12, 2) not null default 0,
  tip_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, month)
);

alter table public.waiter_tip_monthly_totals enable row level security;
drop policy if exists "Owners view monthly tip totals" on public.waiter_tip_monthly_totals;
create policy "Owners view monthly tip totals" on public.waiter_tip_monthly_totals for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

create or replace function public.archive_old_waiter_tips(p_restaurant_id uuid, p_before date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed_count integer;
begin
  insert into public.waiter_tip_monthly_totals (restaurant_id, month, total_amount, tip_count)
  select restaurant_id, date_trunc('month', created_at)::date, sum(amount), count(*)::integer
  from public.waiter_tips
  where restaurant_id = p_restaurant_id and status = 'paid' and created_at < p_before
  group by restaurant_id, date_trunc('month', created_at)::date
  on conflict (restaurant_id, month) do update set
    total_amount = public.waiter_tip_monthly_totals.total_amount + excluded.total_amount,
    tip_count = public.waiter_tip_monthly_totals.tip_count + excluded.tip_count,
    updated_at = now();

  delete from public.waiter_tips
  where restaurant_id = p_restaurant_id and status = 'paid' and created_at < p_before;
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.archive_old_waiter_tips(uuid, date) from public;
grant execute on function public.archive_old_waiter_tips(uuid, date) to service_role;
