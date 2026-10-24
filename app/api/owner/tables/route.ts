import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!restaurant)
    return NextResponse.json(
      { error: "Restaurant not found." },
      { status: 404 },
    );
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, name, active, created_at")
    .eq("restaurant_id", restaurant.id)
    .order("created_at");
  return error
    ? NextResponse.json({ error: "Could not load tables." }, { status: 500 })
    : NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const name = String((await request.json()).name ?? "").trim();
  if (!name || name.length > 40)
    return NextResponse.json(
      { error: "Enter a table name up to 40 characters." },
      { status: 400 },
    );
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!restaurant)
    return NextResponse.json(
      { error: "Restaurant not found." },
      { status: 404 },
    );
  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({ restaurant_id: restaurant.id, name })
    .select("id, name, active, created_at")
    .single();
  return error
    ? NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "That table name already exists."
              : "Could not create the table.",
        },
        { status: error.code === "23505" ? 409 : 500 },
      )
    : NextResponse.json(data, { status: 201 });
}
