import { NextResponse } from "next/server";
import { getPublishedRestaurantSlugById } from "@/app/lib/restaurant-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slug = await getPublishedRestaurantSlugById(id);
  const destination = new URL(slug ? `/menu/${slug}` : "/", request.url);
  const table = new URL(request.url).searchParams.get("table");
  if (slug && table) destination.searchParams.set("table", table);
  return NextResponse.redirect(destination, 307);
}
