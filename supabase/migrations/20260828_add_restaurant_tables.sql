-- Permanent, restaurant-owned table identities for table-specific QR codes.

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists restaurant_tables_restaurant_active_idx
  on public.restaurant_tables (restaurant_id, active);

alter table public.orders
  add column if not exists table_id uuid
    references public.restaurant_tables(id) on delete set null;

create index if not exists orders_table_idx on public.orders (table_id);

alter table public.restaurant_tables enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurant_tables' and policyname = 'Public can resolve active restaurant tables') then
    create policy "Public can resolve active restaurant tables"
      on public.restaurant_tables for select
      using (active and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurant_tables' and policyname = 'Owners manage their restaurant tables') then
    create policy "Owners manage their restaurant tables"
      on public.restaurant_tables for all
      using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
      with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
  end if;
end $$;

