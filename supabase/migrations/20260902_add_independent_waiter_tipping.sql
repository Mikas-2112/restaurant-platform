-- Independent waiter tipping. This does not depend on customer ordering.
alter table public.restaurants
  add column if not exists tipping_enabled boolean not null default false;

create table if not exists public.waiters (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  role text not null default 'Waiter' check (char_length(trim(role)) between 1 and 80),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waiter_tips (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  waiter_id uuid not null references public.waiters(id) on delete restrict,
  amount numeric(10, 2) not null check (amount between 0.50 and 1000),
  currency text not null default 'GBP',
  customer_message text not null default '' check (char_length(customer_message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  payment_provider text,
  payment_reference text unique,
  paid_at timestamptz,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waiters_restaurant_active_idx on public.waiters (restaurant_id, active);
create index if not exists waiter_tips_restaurant_created_idx on public.waiter_tips (restaurant_id, created_at desc);
create index if not exists waiter_tips_waiter_status_idx on public.waiter_tips (waiter_id, status);

alter table public.waiters enable row level security;
alter table public.waiter_tips enable row level security;

create policy "Owners manage their waiters" on public.waiters for all
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners view their waiter tips" on public.waiter_tips for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
