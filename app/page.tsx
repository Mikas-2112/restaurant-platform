"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RestaurantCard = { name: string; cuisine: string; location: string; rating: string; price: string; slug: string; image: string };

const sampleRestaurants: RestaurantCard[] = [
  {
    name: "The Garden Kitchen",
    cuisine: "Modern European",
    location: "Baku, Azerbaijan",
    rating: "4.9",
    price: "$$$",
    slug: "the-garden-kitchen",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Casa Roma",
    cuisine: "Italian",
    location: "Baku, Azerbaijan",
    rating: "4.8",
    price: "$$",
    slug: "casa-roma",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Sakura",
    cuisine: "Japanese",
    location: "Baku, Azerbaijan",
    rating: "4.7",
    price: "$$$",
    slug: "sakura",
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function Home() {
  const [restaurants, setRestaurants] = useState<RestaurantCard[]>(sampleRestaurants);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/restaurants", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load restaurants.");
      return response.json();
    }).then((data: Array<{ name: string; slug: string; cuisine: string; location: string; coverImageUrl?: string }>) => {
      setRestaurants(data.map((restaurant) => ({ ...restaurant, rating: "New", price: "£", image: restaurant.coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80" })));
    }).catch(() => setRestaurants([]));
  }, []);

  const categories = ["All", ...Array.from(new Set(restaurants.map((restaurant) => restaurant.cuisine).filter(Boolean)))];

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesCategory =
      category === "All" ||
      restaurant.cuisine.toLowerCase().includes(category.toLowerCase());

    const matchesSearch =
      restaurant.name.toLowerCase().includes(search.toLowerCase()) ||
      restaurant.cuisine.toLowerCase().includes(search.toLowerCase()) ||
      restaurant.location.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#171717]">
      {/* NAVBAR */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-bold tracking-tight">
          dine<span className="text-orange-600">.</span>
        </div>

        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#restaurants" className="hover:text-orange-600">
            Restaurants
          </a>
          <a href="#how" className="hover:text-orange-600">
            How it works
          </a>
          <a href="#about" className="hover:text-orange-600">
            About
          </a>
        </div>

        <Link href="/auth" className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600">
          List your restaurant
        </Link>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:pt-24">
        <div className="max-w-4xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
            Discover your next table
          </p>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Find restaurants
            <br />
            worth <span className="text-orange-600">talking about.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-600">
            Discover great restaurants, explore menus, compare places, and
            find the perfect table for your next meal.
          </p>
        </div>

        {/* SEARCH */}
        <div className="mt-10 flex max-w-4xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl shadow-black/5 md:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl bg-neutral-50 px-5 py-4">
            <span className="text-xl">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Restaurant, cuisine or location"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>

          <button className="rounded-xl bg-orange-600 px-8 py-4 font-semibold text-white transition hover:bg-orange-700">
            Search restaurants
          </button>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="restaurants" className="border-y border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-6 py-5">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition ${
                category === item
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {/* RESTAURANTS */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-600">
              Curated for you
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Popular restaurants
            </h2>
          </div>

          <span className="hidden text-sm text-neutral-500 md:block">
            {filteredRestaurants.length} places
          </span>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 py-20 text-center">
            <p className="text-lg font-semibold">No restaurants found.</p>
            <p className="mt-2 text-sm text-neutral-500">
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <article
                key={restaurant.name}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={restaurant.image}
                    alt={restaurant.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow">
                    ★ {restaurant.rating}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {restaurant.cuisine}
                      </p>
                    </div>

                    <span className="text-sm font-medium text-neutral-500">
                      {restaurant.price}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm text-neutral-500">
                      📍 {restaurant.location}
                    </span>

                    <Link href={`/menu/${restaurant.slug}`} className="text-sm font-semibold text-orange-600 hover:text-orange-700">View →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-black px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">
            Simple by design
          </p>

          <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need to choose your next restaurant.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              ["01", "Discover", "Browse restaurants and discover new places around you."],
              ["02", "Compare", "Explore cuisines, ratings, locations and restaurant details."],
              ["03", "Decide", "Choose the place that fits your plans and go enjoy your meal."],
            ].map(([number, title, description]) => (
              <div key={number} className="border-t border-neutral-700 pt-6">
                <span className="text-sm text-orange-500">{number}</span>
                <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-neutral-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="about" className="bg-[#faf9f6] px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 border-t border-neutral-200 pt-8 md:flex-row">
          <div className="text-xl font-bold">
            dine<span className="text-orange-600">.</span>
          </div>

          <p className="text-sm text-neutral-500">
            © 2026 dine. Discover better places to eat.
          </p>
        </div>
      </footer>
    </main>
  );
}
