import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

async function ownedRestaurantId(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  const { data } = await getSupabaseServerClient()
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const restaurantId = await ownedRestaurantId(request);
  if (!restaurantId)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const { id } = await params;
  const body = await request.json();
  const updates: { name?: string; active?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 40)
      return NextResponse.json(
        { error: "Enter a valid table name." },
        { status: 400 },
      );
    updates.name = name;
  }
  if (typeof body.active === "boolean") updates.active = body.active;
  const { data, error } = await getSupabaseServerClient()
    .from("restaurant_tables")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  return error || !data
    ? NextResponse.json(
        {
          error:
            error?.code === "23505"
              ? "That table name already exists."
              : "Could not update the table.",
        },
        { status: error?.code === "23505" ? 409 : 404 },
      )
    : NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const restaurantId = await ownedRestaurantId(request);
  if (!restaurantId)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const { id } = await params;
  const { data, error } = await getSupabaseServerClient()
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  return error || !data
    ? NextResponse.json(
        { error: "Could not delete the table." },
        { status: 404 },
      )
    : new NextResponse(null, { status: 204 });
}
