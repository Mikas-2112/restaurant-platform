import "server-only";

import { User } from "@supabase/supabase-js";
import {
  MenuItem,
  MenuItemWithCategory,
  Restaurant,
  RestaurantMenu,
} from "./menu";
import { getSupabaseServerClient } from "./supabase/server";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  country_code: string;
  cuisine: string;
  location: string;
  currency: string;
  phone: string;
  email: string;
  website: string;
  opening_hours: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;
  logo_url: string | null;
  cover_image_url: string | null;
  published: boolean;
  ordering_enabled: boolean;
  service_charge_percent: number | string;
  stripe_charges_enabled: boolean;
};
type CategoryRow = {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
};
type ItemRow = {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  price: number | string;
  description: string;
  image_url: string | null;
  available: boolean;
};

function mapRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    countryCode: row.country_code,
    cuisine: row.cuisine,
    location: row.location,
    currency: row.currency,
    phone: row.phone,
    email: row.email,
    website: row.website,
    openingHours: row.opening_hours ?? {},
    logoUrl: row.logo_url ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    published: row.published,
    orderingEnabled: row.ordering_enabled,
    serviceChargePercent: Number(row.service_charge_percent),
    stripeChargesEnabled: row.stripe_charges_enabled,
  };
}

async function buildMenu(
  restaurantRow: RestaurantRow,
): Promise<RestaurantMenu> {
  const supabase = getSupabaseServerClient();
  const [
    { data: categoryRows, error: categoryError },
    { data: itemRows, error: itemError },
  ] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, restaurant_id, name, position")
      .eq("restaurant_id", restaurantRow.id)
      .order("position"),
    supabase
      .from("menu_items")
      .select(
        "id, restaurant_id, category_id, name, price, description, image_url, available",
      )
      .eq("restaurant_id", restaurantRow.id)
      .order("created_at"),
  ]);
  if (categoryError) throw categoryError;
  if (itemError) throw itemError;

  const categories = (categoryRows as CategoryRow[]).map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    position: row.position,
  }));
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const items: MenuItemWithCategory[] = (itemRows as ItemRow[]).map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    image: row.image_url ?? undefined,
    available: row.available,
    category: categoryNames.get(row.category_id) ?? "Uncategorised",
  }));
  return { restaurant: mapRestaurant(restaurantRow), categories, items };
}

export async function getAuthenticatedUser(
  request: Request,
): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const cookieToken = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)owner_access_token=([^;]+)/)?.[1];
  const candidates = [
    bearerToken,
    cookieToken ? decodeURIComponent(cookieToken) : "",
  ].filter(Boolean);
  for (const token of candidates) {
    const { data, error } = await getSupabaseServerClient().auth.getUser(token);
    if (!error && data.user) return data.user;
  }
  return null;
}

export async function getRestaurantMenu(slug: string) {
  const { data, error } = await getSupabaseServerClient()
    .from("restaurants")
    .select(
      "id, name, slug, description, country_code, cuisine, location, currency, phone, email, website, opening_hours, logo_url, cover_image_url, published, ordering_enabled, service_charge_percent, stripe_charges_enabled",
    )
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? buildMenu(data as RestaurantRow) : null;
}

export async function getOwnerRestaurantMenu(ownerId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from("restaurants")
    .select(
      "id, name, slug, description, country_code, cuisine, location, currency, phone, email, website, opening_hours, logo_url, cover_image_url, published, ordering_enabled, service_charge_percent, stripe_charges_enabled",
    )
    .eq("owner_id", ownerId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? buildMenu(data as RestaurantRow) : null;
}

export async function getPublishedRestaurants() {
  const { data, error } = await getSupabaseServerClient()
    .from("restaurants")
    .select(
      "id, name, slug, description, country_code, cuisine, location, currency, phone, email, website, opening_hours, logo_url, cover_image_url, published, ordering_enabled, service_charge_percent, stripe_charges_enabled",
    )
    .eq("published", true)
    .eq("country_code", "GB")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RestaurantRow[]).map(mapRestaurant);
}

export async function resolveRestaurantSlug(slug: string) {
  const supabase = getSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (currentError) throw currentError;
  if (current) return { currentSlug: current.slug, redirected: false };
  const { data: history, error: historyError } = await supabase
    .from("restaurant_slug_history")
    .select("restaurant_id")
    .eq("slug", slug)
    .maybeSingle();
  if (historyError) throw historyError;
  if (!history) return null;
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", history.restaurant_id)
    .eq("published", true)
    .maybeSingle();
  if (restaurantError) throw restaurantError;
  return restaurant ? { currentSlug: restaurant.slug, redirected: true } : null;
}

export async function getPublishedRestaurantSlugById(id: string) {
  const { data, error } = await getSupabaseServerClient()
    .from("restaurants")
    .select("slug")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data?.slug ?? null;
}

export async function createOwnerRestaurant(
  ownerId: string,
  profile: {
    name: string;
    slug: string;
    description: string;
    cuisine: string;
    location: string;
  },
) {
  const supabase = getSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { restaurantId: existing.id, alreadyExists: true };
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .insert({
      owner_id: ownerId,
      name: profile.name,
      slug: profile.slug,
      description: profile.description,
      cuisine: profile.cuisine,
      location: profile.location,
      country_code: "GB",
      currency: "£",
      published: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  const categories = ["Starters", "Mains", "Desserts", "Drinks"].map(
    (name, position) => ({ restaurant_id: restaurant.id, name, position }),
  );
  const { error: categoryError } = await supabase
    .from("menu_categories")
    .insert(categories);
  if (categoryError) {
    await supabase.from("restaurants").delete().eq("id", restaurant.id);
    throw categoryError;
  }
  return { restaurantId: restaurant.id, alreadyExists: false };
}

async function getOwnedRestaurant(ownerId: string, slug: string) {
  const { data, error } = await getSupabaseServerClient()
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string } | null;
}

export async function addMenuItem(
  ownerId: string,
  slug: string,
  item: Omit<MenuItem, "id" | "restaurantId">,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return null;
  const { data: category } = await getSupabaseServerClient()
    .from("menu_categories")
    .select("id")
    .eq("id", item.categoryId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  if (!category) return null;
  const { data, error } = await getSupabaseServerClient()
    .from("menu_items")
    .insert({
      restaurant_id: restaurant.id,
      category_id: item.categoryId,
      name: item.name,
      price: item.price,
      description: item.description,
      image_url: item.image ?? null,
      available: item.available,
    })
    .select(
      "id, restaurant_id, category_id, name, price, description, image_url, available",
    )
    .single();
  if (error) throw error;
  const row = data as ItemRow;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    image: row.image_url ?? undefined,
    available: row.available,
  };
}

export async function updateMenuItem(
  ownerId: string,
  slug: string,
  itemId: string,
  updates: Partial<
    Pick<
      MenuItem,
      "name" | "categoryId" | "price" | "description" | "image" | "available"
    >
  >,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return null;
  if (updates.categoryId) {
    const { data: category } = await getSupabaseServerClient()
      .from("menu_categories")
      .select("id")
      .eq("id", updates.categoryId)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (!category) return null;
  }
  const databaseUpdates = {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.categoryId !== undefined
      ? { category_id: updates.categoryId }
      : {}),
    ...(updates.price !== undefined ? { price: updates.price } : {}),
    ...(updates.description !== undefined
      ? { description: updates.description }
      : {}),
    ...(updates.image !== undefined
      ? { image_url: updates.image || null }
      : {}),
    ...(updates.available !== undefined
      ? { available: updates.available }
      : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseServerClient()
    .from("menu_items")
    .update(databaseUpdates)
    .eq("id", itemId)
    .eq("restaurant_id", restaurant.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadMenuImage(
  ownerId: string,
  slug: string,
  file: File,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return null;
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${restaurant.id}/${crypto.randomUUID()}.${extension}`;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
}

export async function removeMenuItem(
  ownerId: string,
  slug: string,
  itemId: string,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return false;
  const { data, error } = await getSupabaseServerClient()
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("restaurant_id", restaurant.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function addMenuCategory(
  ownerId: string,
  slug: string,
  name: string,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return null;
  const supabase = getSupabaseServerClient();
  const { data: lastCategory, error: positionError } = await supabase
    .from("menu_categories")
    .select("position")
    .eq("restaurant_id", restaurant.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) throw positionError;
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({
      restaurant_id: restaurant.id,
      name,
      position: (lastCategory?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function renameMenuCategory(
  ownerId: string,
  slug: string,
  categoryId: string,
  name: string,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return null;
  const { data, error } = await getSupabaseServerClient()
    .from("menu_categories")
    .update({ name })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurant.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function reorderMenuCategories(
  ownerId: string,
  slug: string,
  categoryIds: string[],
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return false;
  const supabase = getSupabaseServerClient();
  const { data: ownedCategories, error } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurant.id);
  if (error) throw error;
  const ownedIds = new Set(ownedCategories.map((category) => category.id));
  if (
    categoryIds.length !== ownedIds.size ||
    categoryIds.some((id) => !ownedIds.has(id))
  )
    return false;
  const updates = categoryIds.map((id, position) =>
    supabase
      .from("menu_categories")
      .update({ position })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id),
  );
  const results = await Promise.all(updates);
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) throw updateError;
  return true;
}

export async function removeMenuCategory(
  ownerId: string,
  slug: string,
  categoryId: string,
) {
  const restaurant = await getOwnedRestaurant(ownerId, slug);
  if (!restaurant) return { removed: false, reason: "not-found" as const };
  const supabase = getSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("menu_items")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .eq("category_id", categoryId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return { removed: false, reason: "not-empty" as const };
  const { data, error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurant.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return {
    removed: Boolean(data),
    reason: data ? null : ("not-found" as const),
  };
}

export async function updateRestaurantProfile(
  ownerId: string,
  restaurantId: string,
  profile: {
    name: string;
    slug: string;
    description: string;
    cuisine: string;
    location: string;
    phone: string;
    email: string;
    website: string;
    openingHours: Record<
      string,
      { open: string; close: string; closed: boolean }
    >;
    logoUrl: string;
    coverImageUrl: string;
    published: boolean;
    orderingEnabled: boolean;
    serviceChargePercent: number;
  },
) {
  const supabase = getSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("id", restaurantId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) return null;
  if (current.slug !== profile.slug) {
    const { data: previousUse, error: historyLookupError } = await supabase
      .from("restaurant_slug_history")
      .select("restaurant_id")
      .eq("slug", profile.slug)
      .maybeSingle();
    if (historyLookupError) throw historyLookupError;
    if (previousUse && previousUse.restaurant_id !== restaurantId)
      throw { code: "23505" };
    if (previousUse) {
      const { error: removeAliasError } = await supabase
        .from("restaurant_slug_history")
        .delete()
        .eq("slug", profile.slug)
        .eq("restaurant_id", restaurantId);
      if (removeAliasError) throw removeAliasError;
    }
    const { error: historyError } = await supabase
      .from("restaurant_slug_history")
      .upsert(
        { restaurant_id: restaurantId, slug: current.slug },
        { onConflict: "slug", ignoreDuplicates: true },
      );
    if (historyError) throw historyError;
  }
  const { data, error } = await supabase
    .from("restaurants")
    .update({
      name: profile.name,
      slug: profile.slug,
      description: profile.description,
      cuisine: profile.cuisine,
      location: profile.location,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      opening_hours: profile.openingHours,
      logo_url: profile.logoUrl || null,
      cover_image_url: profile.coverImageUrl || null,
      published: profile.published,
      ordering_enabled: profile.orderingEnabled,
      service_charge_percent: profile.serviceChargePercent,
      country_code: "GB",
      currency: "£",
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurantId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadRestaurantBranding(
  ownerId: string,
  kind: "logo" | "cover",
  file: File,
) {
  const { data: restaurant, error: restaurantError } =
    await getSupabaseServerClient()
      .from("restaurants")
      .select("id")
      .eq("owner_id", ownerId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
  if (restaurantError) throw restaurantError;
  if (!restaurant) return null;
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${restaurant.id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage
    .from("restaurant-branding")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("restaurant-branding").getPublicUrl(path).data
    .publicUrl;
}

export async function removeRestaurantBranding(
  ownerId: string,
  kind: "logo" | "cover",
) {
  const column = kind === "logo" ? "logo_url" : "cover_image_url";
  const supabase = getSupabaseServerClient();
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select(`id, ${column}`)
    .eq("owner_id", ownerId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (restaurantError) throw restaurantError;
  if (!restaurant) return false;
  const brandedRestaurant = restaurant as {
    id: string;
    logo_url?: string | null;
    cover_image_url?: string | null;
  };
  const currentUrl = brandedRestaurant[column] ?? null;
  if (currentUrl) {
    const marker = "/storage/v1/object/public/restaurant-branding/";
    const markerIndex = currentUrl.indexOf(marker);
    if (markerIndex >= 0) {
      const path = decodeURIComponent(
        currentUrl.slice(markerIndex + marker.length),
      );
      if (path.startsWith(`${brandedRestaurant.id}/`)) {
        const { error: storageError } = await supabase.storage
          .from("restaurant-branding")
          .remove([path]);
        if (storageError) throw storageError;
      }
    }
  }
  const { error } = await supabase
    .from("restaurants")
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq("id", brandedRestaurant.id)
    .eq("owner_id", ownerId);
  if (error) throw error;
  return true;
}
