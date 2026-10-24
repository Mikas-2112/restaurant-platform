-- UK prepaid ordering foundation for Stripe Connect.
-- Service charge belongs to the restaurant; platform fees remain separate.

alter table public.restaurants
  add column if not exists service_charge_percent numeric(5, 2) not null default 0
    check (service_charge_percent between 0 and 30),
  add column if not exists stripe_account_id text unique,
  add column if not exists stripe_charges_enabled boolean not null default false;

-- The Stripe columns above are retained for a possible future marketplace.
-- The current white-label deployment charges directly through the restaurant's
-- own STRIPE_SECRET_KEY and does not require Stripe Connect.

alter table public.orders
  add column if not exists subtotal numeric(10, 2),
  add column if not exists service_charge_amount numeric(10, 2) not null default 0
    check (service_charge_amount >= 0),
  add column if not exists tip_amount numeric(10, 2) not null default 0
    check (tip_amount >= 0),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  add column if not exists payment_provider text,
  add column if not exists payment_reference text unique,
  add column if not exists paid_at timestamptz;

update public.orders set subtotal = total where subtotal is null;
alter table public.orders alter column subtotal set not null;
alter table public.orders add constraint orders_subtotal_nonnegative check (subtotal >= 0) not valid;
alter table public.orders validate constraint orders_subtotal_nonnegative;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending_payment', 'new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'));

create index if not exists orders_payment_status_created_idx
  on public.orders (payment_status, created_at desc);
