import { NextResponse } from "next/server";
import { getPublishedRestaurants } from "@/app/lib/restaurant-store";

export async function GET() {
  return NextResponse.json(await getPublishedRestaurants());
}
