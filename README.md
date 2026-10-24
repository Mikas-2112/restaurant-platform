# dine. — Restaurant platform

A full-stack restaurant project built with Next.js, TypeScript, React, Tailwind CSS and Supabase. Customers browse digital menus; restaurant owners manage menus and table ordering through a dashboard.

## Features implemented in the source

- Restaurant profiles and public menus with categories, prices and availability.
- Owner authentication and menu/category editing, including image uploads.
- QR-code tools, restaurant links and table management.
- Order management and an analytics dashboard.
- Stripe checkout/webhook integration and a simulated checkout mode.
- Waiter tipping and tip distribution records.

This is a portfolio prototype. Payment and database workflows require configuration and have not been certified for production use.

## Run locally

Requires Node.js 20.9 or newer and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration the landing page can show sample restaurant cards, but functional menus, accounts and dashboards require a database. The JSON in `data/` is legacy sample data, not a complete database fallback.

### Database

Create a separate Supabase development project. Run `supabase/schema.sql`, then the SQL files in `supabase/migrations/` in filename order. Configure the project URL, publishable key and server-side service-role key in `.env.local`. Enable email authentication and configure localhost redirect URLs in Supabase. Never publish `.env.local` or the service-role key.

### Payments

Use Stripe test keys while developing. Set `PAYMENT_RESTAURANT_ID` to the configured restaurant UUID. The webhook route is `/api/stripe/webhook`; configure its signing secret separately. `PAYMENT_MODE=demo` simulates payment outcomes and must only be used with disposable development data. A payment configuration is scoped to one restaurant per deployment.

## Project structure

- `app/menu/`: customer menus
- `app/dashboard/`: owner management, orders, analytics and QR tools
- `app/api/`: server routes for authentication, menus, orders and payments
- `app/lib/`: data models and Supabase clients
- `supabase/`: schema and migrations

## Checks

```sh
npm run lint
npm run build -- --webpack
```

## Current limitations

External database and payment flows need end-to-end testing with development accounts. Image optimisation and internal navigation lint warnings remain. This repository demonstrates the implementation; it does not claim live customers, revenue or production readiness.
