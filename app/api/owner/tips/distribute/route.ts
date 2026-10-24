import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const body = await request.json();
  const tipIds = Array.isArray(body.tipIds)
    ? body.tipIds.filter((id: unknown) => typeof id === "string")
    : [];
  if (!tipIds.length)
    return NextResponse.json(
      { error: "There are no tips to distribute." },
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
    .from("waiter_tips")
    .update({
      distributed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurant.id)
    .eq("status", "paid")
    .is("distributed_at", null)
    .in("id", tipIds)
    .select("id");
  if (error)
    return NextResponse.json(
      { error: "Distribution tracking is not set up yet." },
      { status: 500 },
    );
  return NextResponse.json({ distributed: data.length });
}
