import { NextResponse } from "next/server";
import { createOwnerRestaurant, getAuthenticatedUser, getOwnerRestaurantMenu, updateRestaurantProfile } from "@/app/lib/restaurant-store";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const menu = await getOwnerRestaurantMenu(user.id);
  return menu ? NextResponse.json(menu) : NextResponse.json({ error: "No restaurant is connected to this account yet." }, { status: 404 });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  if (!body.restaurantId || !body.name?.trim() || !body.description?.trim() || !body.cuisine?.trim() || !body.location?.trim()) return NextResponse.json({ error: "Name, description, cuisine, and location are required." }, { status: 400 });
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "Menu URL can only use lowercase letters, numbers, and single hyphens." }, { status: 400 });
  if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (body.website) { try { new URL(body.website); } catch { return NextResponse.json({ error: "Enter a full website address beginning with https://." }, { status: 400 }); } }
  const openingHours = typeof body.openingHours === "object" && body.openingHours ? body.openingHours : {};
  const serviceChargePercent = Number(body.serviceChargePercent);
  if (!Number.isFinite(serviceChargePercent) || serviceChargePercent < 0 || serviceChargePercent > 30) return NextResponse.json({ error: "Service charge must be between 0% and 30%." }, { status: 400 });
  try {
    const updated = await updateRestaurantProfile(user.id, body.restaurantId, { name: body.name.trim(), slug, description: body.description.trim(), cuisine: body.cuisine.trim(), location: body.location.trim(), phone: String(body.phone ?? "").trim(), email: String(body.email ?? "").trim(), website: String(body.website ?? "").trim(), openingHours, logoUrl: String(body.logoUrl ?? "").trim(), coverImageUrl: String(body.coverImageUrl ?? "").trim(), published: Boolean(body.published), orderingEnabled: Boolean(body.orderingEnabled), serviceChargePercent });
    return updated ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json({ error: code === "23505" ? "That menu URL is already used by another restaurant." : "Could not save restaurant settings." }, { status: code === "23505" ? 409 : 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const cuisine = typeof body.cuisine === "string" ? body.cuisine.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name || !cuisine || !location || !description) return NextResponse.json({ error: "Complete all restaurant details." }, { status: 400 });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "Menu URL can only use lowercase letters, numbers, and single hyphens." }, { status: 400 });
  try {
    const result = await createOwnerRestaurant(user.id, { name, cuisine, location, description, slug });
    return NextResponse.json(result, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json({ error: code === "23505" ? "That public menu URL is already taken." : "Could not create the restaurant." }, { status: code === "23505" ? 409 : 500 });
  }
}
