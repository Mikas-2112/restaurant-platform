-- Run this in the Supabase SQL Editor once, in a new project.
-- Restaurant owners are authenticated through Supabase Auth.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  country_code text not null default 'GB' check (country_code ~ '^[A-Z]{2}$'),
  cuisine text not null default '',
  location text not null default '',
  currency text not null default '£',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  opening_hours jsonb not null default '{}'::jsonb,
  logo_url text,
  cover_image_url text,
  published boolean not null default true,
  ordering_enabled boolean not null default false,
  service_charge_percent numeric(5, 2) not null default 0 check (service_charge_percent between 0 and 30),
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  unique (restaurant_id, name)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_categories_restaurant_position_idx on public.menu_categories (restaurant_id, position);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id);
create index restaurants_country_published_idx on public.restaurants (country_code, published);

create table public.restaurant_slug_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create index restaurant_slug_history_restaurant_idx on public.restaurant_slug_history (restaurant_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null check (char_length(trim(table_number)) between 1 and 30),
  customer_note text not null default '' check (char_length(customer_note) <= 500),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  service_charge_amount numeric(10, 2) not null default 0 check (service_charge_amount >= 0),
  tip_amount numeric(10, 2) not null default 0 check (tip_amount >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  payment_provider text,
  payment_reference text unique,
  paid_at timestamptz,
  total numeric(10, 2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  customer_note text not null default '' check (char_length(customer_note) <= 300),
  created_at timestamptz not null default now()
);

create index orders_restaurant_status_created_idx on public.orders (restaurant_id, status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

alter table public.orders add column table_id uuid references public.restaurant_tables(id) on delete set null;
create index restaurant_tables_restaurant_active_idx on public.restaurant_tables (restaurant_id, active);
create index orders_table_idx on public.orders (table_id);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.restaurant_slug_history enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.restaurant_tables enable row level security;

-- Any visitor can read a published restaurant and its menu. Owners can only
-- create and manage records belonging to their own account.
create policy "Public can view published restaurants" on public.restaurants for select using (published);
create policy "Owners manage their restaurants" on public.restaurants for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Public can view categories of published restaurants" on public.menu_categories for select using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
create policy "Owners manage their categories" on public.menu_categories for all using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Public can view items of published restaurants" on public.menu_items for select using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
create policy "Owners manage their menu items" on public.menu_items for all using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Public can resolve published restaurant URLs" on public.restaurant_slug_history for select using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
create policy "Owners manage their restaurant URLs" on public.restaurant_slug_history for all using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners view their restaurant orders" on public.orders for select using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners update their restaurant orders" on public.orders for update using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners view their restaurant order items" on public.order_items for select using (exists (select 1 from public.orders o join public.restaurants r on r.id = o.restaurant_id where o.id = order_id and r.owner_id = auth.uid()));
create policy "Public can resolve active restaurant tables" on public.restaurant_tables for select using (active and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
create policy "Owners manage their restaurant tables" on public.restaurant_tables for all using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

create policy "Users view their own profile" on public.profiles for select using (id = auth.uid());
create policy "Users update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Creates a profile automatically for every new restaurant-owner account.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
