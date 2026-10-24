import { NextResponse } from "next/server";
import { getAuthenticatedUser, removeRestaurantBranding, uploadRestaurantBranding } from "@/app/lib/restaurant-store";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  if (!(file instanceof File) || (kind !== "logo" && kind !== "cover")) return NextResponse.json({ error: "Choose a valid branding image." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "The image must be smaller than 8 MB." }, { status: 400 });
  const url = await uploadRestaurantBranding(user.id, kind, file);
  return url ? NextResponse.json({ url }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "logo" && kind !== "cover") return NextResponse.json({ error: "Choose a valid image type." }, { status: 400 });
  return (await removeRestaurantBranding(user.id, kind)) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
}
