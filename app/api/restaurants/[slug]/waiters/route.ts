import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, currency, logo_url, tipping_enabled, published")
    .eq("slug", slug)
    .maybeSingle();
  if (!restaurant?.published || !restaurant.tipping_enabled)
    return NextResponse.json(
      { error: "Waiter tipping is not available." },
      { status: 404 },
    );
  const { data: waiters, error } = await supabase
    .from("waiters")
    .select("id, name, role, photo_url")
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .order("name");
  return error
    ? NextResponse.json({ error: "Could not load waiters." }, { status: 500 })
    : NextResponse.json({ restaurant, waiters });
}
