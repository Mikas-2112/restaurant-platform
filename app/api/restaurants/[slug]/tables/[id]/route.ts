import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!restaurant)
    return NextResponse.json(
      { error: "Restaurant not found." },
      { status: 404 },
    );
  const { data } = await supabase
    .from("restaurant_tables")
    .select("id, name")
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .maybeSingle();
  return data
    ? NextResponse.json(data)
    : NextResponse.json(
        { error: "This table QR is no longer active." },
        { status: 404 },
      );
}
