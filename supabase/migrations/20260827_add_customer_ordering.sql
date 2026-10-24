-- Stage 5: optional table ordering and kitchen order management.

alter table public.restaurants
  add column if not exists ordering_enabled boolean not null default false;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null check (char_length(trim(table_number)) between 1 and 30),
  customer_note text not null default '' check (char_length(customer_note) <= 500),
  status text not null default 'new'
    check (status in ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  total numeric(10, 2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  customer_note text not null default '' check (char_length(customer_note) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists orders_restaurant_status_created_idx
  on public.orders (restaurant_id, status, created_at desc);
create index if not exists order_items_order_idx
  on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Owners view their restaurant orders') then
    create policy "Owners view their restaurant orders"
      on public.orders for select
      using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Owners update their restaurant orders') then
    create policy "Owners update their restaurant orders"
      on public.orders for update
      using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
      with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'Owners view their restaurant order items') then
    create policy "Owners view their restaurant order items"
      on public.order_items for select
      using (exists (
        select 1 from public.orders o
        join public.restaurants r on r.id = o.restaurant_id
        where o.id = order_id and r.owner_id = auth.uid()
      ));
  end if;
end $$;

