import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

async function ownedRestaurant(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  const { data } = await getSupabaseServerClient()
    .from("restaurants")
    .select("id, name, slug, currency, tipping_enabled")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const restaurant = await ownedRestaurant(request);
  if (!restaurant)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const supabase = getSupabaseServerClient();
  const retentionStart = new Date();
  retentionStart.setUTCDate(1);
  retentionStart.setUTCHours(0, 0, 0, 0);
  retentionStart.setUTCMonth(retentionStart.getUTCMonth() - 2);
  await supabase.rpc("archive_old_waiter_tips", {
    p_restaurant_id: restaurant.id,
    p_before: retentionStart.toISOString().slice(0, 10),
  });
  const [{ data: waiters, error }, { data: tips }] = await Promise.all([
    supabase
      .from("waiters")
      .select("id, name, role, photo_url, active, created_at")
      .eq("restaurant_id", restaurant.id)
      .order("created_at"),
    supabase
      .from("waiter_tips")
      .select("id, waiter_id, amount, status, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "paid")
      .gte("created_at", retentionStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  return error
    ? NextResponse.json({ error: "Could not load waiters." }, { status: 500 })
    : NextResponse.json({ restaurant, waiters, tips: tips ?? [] });
}

export async function POST(request: Request) {
  const restaurant = await ownedRestaurant(request);
  if (!restaurant)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "Waiter").trim();
  const photoUrl = String(body.photoUrl ?? "").trim();
  if (!name || name.length > 80 || !role || role.length > 80)
    return NextResponse.json(
      { error: "Enter a valid waiter name and role." },
      { status: 400 },
    );
  const { data, error } = await getSupabaseServerClient()
    .from("waiters")
    .insert({
      restaurant_id: restaurant.id,
      name,
      role,
      photo_url: photoUrl || null,
    })
    .select("id")
    .single();
  return error
    ? NextResponse.json({ error: "Could not add waiter." }, { status: 500 })
    : NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const restaurant = await ownedRestaurant(request);
  if (!restaurant)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const body = await request.json();
  const supabase = getSupabaseServerClient();
  if (body.action === "toggle-tipping") {
    const { error } = await supabase
      .from("restaurants")
      .update({
        tipping_enabled: Boolean(body.enabled),
        updated_at: new Date().toISOString(),
      })
      .eq("id", restaurant.id);
    return error
      ? NextResponse.json(
          { error: "Could not update tipping." },
          { status: 500 },
        )
      : NextResponse.json({ success: true });
  }
  if (!body.waiterId)
    return NextResponse.json({ error: "Waiter not found." }, { status: 400 });
  const updates = {
    ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
    ...(typeof body.role === "string" ? { role: body.role.trim() } : {}),
    ...(typeof body.photoUrl === "string"
      ? { photo_url: body.photoUrl.trim() || null }
      : {}),
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("waiters")
    .update(updates)
    .eq("id", body.waiterId)
    .eq("restaurant_id", restaurant.id)
    .select("id")
    .maybeSingle();
  return error || !data
    ? NextResponse.json({ error: "Could not update waiter." }, { status: 404 })
    : NextResponse.json({ success: true });
}
