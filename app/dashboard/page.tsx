"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MenuCategory,
  MenuItemWithCategory,
  RestaurantMenu,
} from "../lib/menu";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import QrTools from "./qr-tools";
import TableTools from "./table-tools";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const defaultHours = Object.fromEntries(
  days.map((day) => [day, { open: "09:00", close: "22:00", closed: false }]),
) as Record<string, { open: string; close: string; closed: boolean }>;

export default function Dashboard() {
  const router = useRouter();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setup, setSetup] = useState({
    name: "",
    cuisine: "",
    description: "",
    location: "",
    slug: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithCategory | null>(
    null,
  );
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [settings, setSettings] = useState({
    name: "",
    slug: "",
    description: "",
    cuisine: "",
    location: "",
    phone: "",
    email: "",
    website: "",
    openingHours: defaultHours,
    logoUrl: "",
    coverImageUrl: "",
    published: true,
    orderingEnabled: false,
    serviceChargePercent: 0,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadMenu = useCallback(
    async (token: string) => {
      const response = await fetch("/api/owner/restaurant", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.status === 401) {
        router.replace("/auth");
        return;
      }
      if (response.status === 404) {
        setNeedsSetup(true);
        return;
      }
      if (!response.ok) throw new Error("Could not load the restaurant menu.");
      const data = (await response.json()) as RestaurantMenu;
      setMenu(data);
      setNeedsSetup(false);
      setSettings({
        name: data.restaurant.name,
        slug: data.restaurant.slug,
        description: data.restaurant.description,
        cuisine: data.restaurant.cuisine,
        location: data.restaurant.location,
        phone: data.restaurant.phone,
        email: data.restaurant.email,
        website: data.restaurant.website,
        openingHours: { ...defaultHours, ...data.restaurant.openingHours },
        logoUrl: data.restaurant.logoUrl ?? "",
        coverImageUrl: data.restaurant.coverImageUrl ?? "",
        published: data.restaurant.published,
        orderingEnabled: data.restaurant.orderingEnabled,
        serviceChargePercent: data.restaurant.serviceChargePercent,
      });
      setCategoryId((current) => current || data.categories[0]?.id || "");
    },
    [router],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function openDashboard() {
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        const refreshed = await supabase.auth.refreshSession();
        data = refreshed.data;
      }
      const token = data.session?.access_token;
      setAccessToken(token ?? "");
      await loadMenu(token ?? "");
    }
    openDashboard().catch((loadError: unknown) =>
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the menu.",
      ),
    );
  }, [loadMenu, router]);

  function resetForm() {
    setEditingItem(null);
    setName("");
    setCategoryId(menu?.categories[0]?.id ?? "");
    setPrice("");
    setDescription("");
    setImage("");
    setImageFile(null);
    setShowForm(false);
  }

  function startAdding() {
    resetForm();
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startEditing(item: MenuItemWithCategory) {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(item.categoryId);
    setPrice(String(item.price));
    setDescription(item.description);
    setImage(item.image ?? "");
    setImageFile(null);
    setShowForm(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadSelectedImage() {
    if (!imageFile || !menu) return image;
    const formData = new FormData();
    formData.append("file", imageFile);
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/images`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Could not upload the image.");
    return result.url as string;
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menu || !accessToken) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const savedImage = await uploadSelectedImage();
      const endpoint = editingItem
        ? `/api/restaurants/${menu.restaurant.slug}/menu/${editingItem.id}`
        : `/api/restaurants/${menu.restaurant.slug}/menu`;
      const response = await fetch(endpoint, {
        method: editingItem ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          categoryId,
          price,
          description,
          image: savedImage,
        }),
      });
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not save this item.");
      const message = editingItem
        ? "Dish updated successfully."
        : "Dish added successfully.";
      resetForm();
      setSuccess(message);
      await loadMenu(accessToken);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this item.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item: MenuItemWithCategory) {
    if (!menu || !accessToken) return;
    setError("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/menu/${item.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ available: !item.available }),
      },
    );
    if (!response.ok) {
      setError("Could not update this item.");
      return;
    }
    setSuccess(
      item.available
        ? "Dish hidden from the customer menu."
        : "Dish is available again.",
    );
    await loadMenu(accessToken);
  }

  async function deleteItem(id: string) {
    if (!window.confirm("Are you sure you want to delete this menu item?"))
      return;
    if (!menu || !accessToken) return;
    setError("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/menu/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      setError("Could not delete this item.");
      return;
    }
    setSuccess("Dish deleted.");
    await loadMenu(accessToken);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menu || !accessToken || !newCategory.trim()) return;
    setError("");
    setSuccess("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/categories`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: newCategory }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Could not add the category.");
      return;
    }
    setNewCategory("");
    setSuccess("Category added.");
    await loadMenu(accessToken);
  }

  async function renameCategory(category: MenuCategory) {
    if (!menu || !accessToken) return;
    const name = window.prompt("New category name", category.name)?.trim();
    if (!name || name === category.name) return;
    setError("");
    setSuccess("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/categories/${category.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Could not rename the category.");
      return;
    }
    setSuccess("Category renamed.");
    await loadMenu(accessToken);
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    if (!menu || !accessToken) return;
    const destination = index + direction;
    if (destination < 0 || destination >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    setError("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/categories`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          categoryIds: reordered.map((category) => category.id),
        }),
      },
    );
    if (!response.ok) {
      setError("Could not reorder the categories.");
      return;
    }
    setSuccess("Category order updated.");
    await loadMenu(accessToken);
  }

  async function deleteCategory(category: MenuCategory) {
    if (
      !menu ||
      !accessToken ||
      !window.confirm(`Delete the ${category.name} category?`)
    )
      return;
    setError("");
    setSuccess("");
    const response = await fetch(
      `/api/restaurants/${menu.restaurant.slug}/categories/${category.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      const result = await response.json();
      setError(result.error ?? "Could not delete the category.");
      return;
    }
    setSuccess("Category deleted.");
    await loadMenu(accessToken);
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/auth");
    router.refresh();
  }

  async function createRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setSavingSettings(true);
    setError("");
    const response = await fetch("/api/owner/restaurant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(setup),
    });
    const result = await response.json();
    if (!response.ok)
      setError(result.error ?? "Could not create the restaurant.");
    else await loadMenu(accessToken);
    setSavingSettings(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menu || !accessToken) return;
    setSavingSettings(true);
    setError("");
    setSuccess("");
    async function uploadBranding(file: File, kind: "logo" | "cover") {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const uploadResponse = await fetch("/api/owner/restaurant/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok)
        throw new Error(
          uploadResult.error ?? "Could not upload branding image.",
        );
      return uploadResult.url as string;
    }
    let savedSettings = settings;
    try {
      const [logoUrl, coverImageUrl] = await Promise.all([
        logoFile ? uploadBranding(logoFile, "logo") : settings.logoUrl,
        coverFile ? uploadBranding(coverFile, "cover") : settings.coverImageUrl,
      ]);
      savedSettings = { ...settings, logoUrl, coverImageUrl };
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload branding image.",
      );
      setSavingSettings(false);
      return;
    }
    const response = await fetch("/api/owner/restaurant", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        restaurantId: menu.restaurant.id,
        ...savedSettings,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      setError(result.error ?? "Could not save restaurant settings.");
    else {
      setLogoFile(null);
      setCoverFile(null);
      setSuccess("Restaurant settings saved.");
      await loadMenu(accessToken);
    }
    setSavingSettings(false);
  }

  async function removeBranding(kind: "logo" | "cover") {
    if (!accessToken || !window.confirm(`Remove the restaurant ${kind} image?`))
      return;
    setError("");
    setSuccess("");
    const response = await fetch(`/api/owner/restaurant/images?kind=${kind}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setError(`Could not remove the ${kind} image.`);
      return;
    }
    if (kind === "logo") setLogoFile(null);
    else setCoverFile(null);
    setSuccess(`${kind === "logo" ? "Logo" : "Cover image"} removed.`);
    await loadMenu(accessToken);
  }

  const categories: MenuCategory[] = menu?.categories ?? [];
  const items = menu?.items ?? [];

  if (needsSetup)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-6 py-12">
        <section className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-black/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
            Welcome to dine.
          </p>
          <h1 className="mt-3 text-3xl font-bold">Set up your restaurant</h1>
          <p className="mt-3 text-zinc-500">
            Create your private draft first. You can add the menu and publish it
            when ready.
          </p>
          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
          <form
            onSubmit={createRestaurant}
            className="mt-8 grid gap-5 md:grid-cols-2"
          >
            <label className="text-sm font-medium">
              Restaurant name
              <input
                required
                value={setup.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setSetup({
                    ...setup,
                    name,
                    slug:
                      setup.slug ||
                      name
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                  });
                }}
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
              />
            </label>
            <label className="text-sm font-medium">
              Cuisine
              <input
                required
                value={setup.cuisine}
                onChange={(event) =>
                  setSetup({ ...setup, cuisine: event.target.value })
                }
                placeholder="e.g. Modern British"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
              />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Description
              <textarea
                required
                rows={3}
                value={setup.description}
                onChange={(event) =>
                  setSetup({ ...setup, description: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
              />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Address
              <input
                required
                value={setup.location}
                onChange={(event) =>
                  setSetup({ ...setup, location: event.target.value })
                }
                placeholder="Street, city and postcode"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
              />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Public menu URL
              <div className="mt-2 flex rounded-xl border border-zinc-200">
                <span className="pl-4 pt-3 text-zinc-400">/menu/</span>
                <input
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  value={setup.slug}
                  onChange={(event) =>
                    setSetup({
                      ...setup,
                      slug: event.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-"),
                    })
                  }
                  className="min-w-0 flex-1 rounded-xl px-2 py-3 outline-none"
                />
              </div>
            </label>
            <div className="flex gap-3 md:col-span-2">
              <button
                disabled={savingSettings}
                className="rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingSettings ? "Creating…" : "Create restaurant"}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-xl border border-zinc-200 px-6 py-3 font-semibold"
              >
                Sign out
              </button>
            </div>
          </form>
        </section>
      </main>
    );

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Restaurant Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage {menu?.restaurant.name ?? "your restaurant"}&apos;s menu
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/analytics"
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700"
            >
              Analytics
            </a>
            <a
              href="/dashboard/waiters"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
            >
              Waiter tipping
            </a>
            <a
              href="/dashboard/orders"
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700"
            >
              Kitchen orders
            </a>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={showForm ? resetForm : startAdding}
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {showForm ? "Close form" : "+ Add item"}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </p>
        )}
        {menu && (
          <form
            onSubmit={saveSettings}
            className="mb-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-xl font-bold">Restaurant profile</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  This information appears on your public restaurant and menu
                  pages.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={settings.published}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        published: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  Publicly visible
                </label>
                <label className="flex items-center gap-3 rounded-xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
                  <input
                    type="checkbox"
                    checked={settings.orderingEnabled}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        orderingEnabled: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  Enable customer ordering
                </label>
              </div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium">
                Restaurant name
                <input
                  required
                  value={settings.name}
                  onChange={(event) =>
                    setSettings({ ...settings, name: event.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Cuisine
                <input
                  required
                  value={settings.cuisine}
                  onChange={(event) =>
                    setSettings({ ...settings, cuisine: event.target.value })
                  }
                  placeholder="e.g. Modern British"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Public menu URL
                <div className="mt-2 flex items-center rounded-xl border border-zinc-200 bg-white">
                  <span className="pl-4 text-sm text-zinc-400">/menu/</span>
                  <input
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    value={settings.slug}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        slug: event.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-"),
                      })
                    }
                    className="min-w-0 flex-1 rounded-xl px-2 py-3 outline-none"
                  />
                </div>
                <span className="mt-1 block text-xs font-normal text-zinc-500">
                  Changing this also changes the address used by future QR
                  codes.
                </span>
              </label>
              <div className="rounded-xl bg-orange-50 p-4 text-sm md:col-span-2">
                <p className="font-semibold text-orange-900">
                  Permanent QR-ready link
                </p>
                <p className="mt-1 break-all text-orange-700">
                  /r/{menu.restaurant.id}
                </p>
                <p className="mt-1 text-xs text-orange-700">
                  This link never changes and always forwards customers to the
                  current menu URL.
                </p>
              </div>
              <label className="text-sm font-medium md:col-span-2">
                Description
                <textarea
                  required
                  rows={3}
                  value={settings.description}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      description: event.target.value,
                    })
                  }
                  className="mt-2 w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Address
                <input
                  required
                  value={settings.location}
                  onChange={(event) =>
                    setSettings({ ...settings, location: event.target.value })
                  }
                  placeholder="Street, city and postcode"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(event) =>
                    setSettings({ ...settings, phone: event.target.value })
                  }
                  placeholder="+44 20 1234 5678"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Public email
                <input
                  type="email"
                  value={settings.email}
                  onChange={(event) =>
                    setSettings({ ...settings, email: event.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Website
                <input
                  type="url"
                  value={settings.website}
                  onChange={(event) =>
                    setSettings({ ...settings, website: event.target.value })
                  }
                  placeholder="https://example.com"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Restaurant logo{" "}
                <span className="font-normal text-zinc-500">
                  (JPG, PNG or WebP)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setLogoFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 block w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                />
                {settings.logoUrl && !logoFile && (
                  <div className="mt-3 flex items-end gap-3">
                    <img
                      src={settings.logoUrl}
                      alt="Restaurant logo"
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeBranding("logo")}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                    >
                      Remove logo
                    </button>
                  </div>
                )}
              </label>
              <label className="text-sm font-medium">
                Cover image{" "}
                <span className="font-normal text-zinc-500">
                  (JPG, PNG or WebP)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setCoverFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 block w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                />
                {settings.coverImageUrl && !coverFile && (
                  <div className="mt-3">
                    <img
                      src={settings.coverImageUrl}
                      alt="Restaurant cover"
                      className="h-20 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeBranding("cover")}
                      className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                    >
                      Remove cover
                    </button>
                  </div>
                )}
              </label>
              <div className="rounded-xl bg-zinc-50 p-4 text-sm">
                <span className="font-medium">Market:</span> United Kingdom
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 text-sm">
                <span className="font-medium">Currency:</span> GBP (£)
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 md:col-span-2">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-bold text-indigo-950">
                      Payment service charge
                    </h3>
                    <p className="mt-1 text-sm text-indigo-800">
                      Choose the percentage automatically added to every
                      customer order.
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-800">
                    Currently {settings.serviceChargePercent}%
                  </span>
                </div>
                <label className="mt-4 block text-sm font-semibold text-indigo-950">
                  Service charge percentage
                  <input
                    required
                    type="number"
                    min="0"
                    max="30"
                    step="0.01"
                    value={settings.serviceChargePercent}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        serviceChargePercent: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 outline-none focus:border-indigo-600"
                  />
                </label>
                <p className="mt-2 text-xs text-indigo-700">
                  Enter 0 to disable it. Customers see this percentage and
                  amount before paying and at checkout.
                </p>
              </div>
              <div className="md:col-span-2">
                <h3 className="font-semibold">Opening hours</h3>
                <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {days.map((day) => {
                    const hours =
                      settings.openingHours[day] ?? defaultHours[day];
                    return (
                      <div
                        key={day}
                        className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto]"
                      >
                        <span className="text-sm font-medium">{day}</span>
                        <input
                          aria-label={`${day} opening time`}
                          disabled={hours.closed}
                          type="time"
                          value={hours.open}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              openingHours: {
                                ...settings.openingHours,
                                [day]: { ...hours, open: event.target.value },
                              },
                            })
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100"
                        />
                        <input
                          aria-label={`${day} closing time`}
                          disabled={hours.closed}
                          type="time"
                          value={hours.close}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              openingHours: {
                                ...settings.openingHours,
                                [day]: { ...hours, close: event.target.value },
                              },
                            })
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={hours.closed}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                openingHours: {
                                  ...settings.openingHours,
                                  [day]: {
                                    ...hours,
                                    closed: event.target.checked,
                                  },
                                },
                              })
                            }
                          />
                          Closed
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              disabled={savingSettings}
              className="mt-6 rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {savingSettings ? "Saving…" : "Save restaurant profile"}
            </button>
          </form>
        )}
        {menu && (
          <QrTools
            restaurantId={menu.restaurant.id}
            restaurantName={menu.restaurant.name}
            logoUrl={menu.restaurant.logoUrl}
          />
        )}
        {menu && (
          <TableTools
            accessToken={accessToken}
            restaurantId={menu.restaurant.id}
            restaurantName={menu.restaurant.name}
          />
        )}
        {showForm && (
          <form
            onSubmit={saveItem}
            className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold">
              {editingItem ? `Edit ${editingItem.name}` : "Add menu item"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Changes are saved to the customer menu.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium">
                Dish name
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Truffle Pasta"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Category
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-black"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Price ({menu?.restaurant.currency ?? "£"})
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="e.g. 18"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium">
                Description
                <input
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the dish"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Food photo{" "}
                <span className="font-normal text-zinc-500">
                  (JPG, PNG, WebP or GIF; maximum 5 MB)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 block w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                />
              </label>
              {image && !imageFile && (
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm text-zinc-500">Current photo</p>
                  <img
                    src={image}
                    alt="Current dish"
                    className="h-28 w-28 rounded-xl object-cover"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                disabled={saving}
                className="rounded-xl bg-black px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : editingItem
                    ? "Save changes"
                    : "Save item"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-zinc-200 px-6 py-3 font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-bold">Menu categories</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Create categories and control how they appear on the customer
                menu.
              </p>
            </div>
            <form onSubmit={addCategory} className="flex gap-2">
              <input
                required
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="New category"
                className="min-w-0 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-black"
              />
              <button className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">
                Add
              </button>
            </form>
          </div>
          <div className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-xs text-zinc-500">
                    {
                      items.filter((item) => item.categoryId === category.id)
                        .length
                    }{" "}
                    dishes
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveCategory(index, -1)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === categories.length - 1}
                    onClick={() => moveCategory(index, 1)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => renameCategory(category)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(category)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Your menu</h2>
            <p className="text-sm text-zinc-500">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </div>
          {!menu ? (
            <div className="rounded-2xl bg-white p-12 text-center text-zinc-500">
              Loading menu…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
              <h3 className="font-semibold">Your menu is empty</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Add your first dish using the button above.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-5 border-b border-zinc-100 p-5 last:border-0 sm:flex-row"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-24 w-24 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400">
                      No photo
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                        {item.category}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {item.description}
                    </p>
                    <p className="mt-3 font-semibold">
                      {menu.restaurant.currency}
                      {item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                    <button
                      type="button"
                      onClick={() => startEditing(item)}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAvailability(item)}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      {item.available ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
