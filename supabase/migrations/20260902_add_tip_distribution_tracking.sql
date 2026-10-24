-- Tracks when paid waiter tips have been passed on to staff.
alter table public.waiter_tips
  add column if not exists distributed_at timestamptz;

create index if not exists waiter_tips_distribution_idx
  on public.waiter_tips (restaurant_id, status, distributed_at);
