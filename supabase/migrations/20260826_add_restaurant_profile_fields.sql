-- Adds country-neutral restaurant profile fields. GB is the first active
-- market, while the ISO country code keeps future expansion data-driven.

alter table public.restaurants
  add column if not exists country_code text not null default 'GB',
  add column if not exists cuisine text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists website text not null default '',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists logo_url text,
  add column if not exists cover_image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_country_code_format'
  ) then
    alter table public.restaurants
      add constraint restaurants_country_code_format check (country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

create index if not exists restaurants_country_published_idx
  on public.restaurants (country_code, published);

update public.restaurants
set country_code = 'GB', currency = '£'
where country_code is null or country_code = '';
