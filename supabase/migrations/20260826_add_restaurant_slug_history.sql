-- Keeps old public menu URLs working after owners change their restaurant slug.

create table if not exists public.restaurant_slug_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create index if not exists restaurant_slug_history_restaurant_idx
  on public.restaurant_slug_history (restaurant_id);

alter table public.restaurant_slug_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurant_slug_history' and policyname = 'Public can resolve published restaurant URLs') then
    create policy "Public can resolve published restaurant URLs"
      on public.restaurant_slug_history for select
      using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.published));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurant_slug_history' and policyname = 'Owners manage their restaurant URLs') then
    create policy "Owners manage their restaurant URLs"
      on public.restaurant_slug_history for all
      using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
      with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
  end if;
end $$;
