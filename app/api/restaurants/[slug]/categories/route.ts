import { NextResponse } from "next/server";
import { addMenuCategory, getAuthenticatedUser, reorderMenuCategories } from "@/app/lib/restaurant-store";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  const { slug } = await params;
  try {
    const category = await addMenuCategory(user.id, slug, name);
    return category ? NextResponse.json(category, { status: 201 }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json({ error: code === "23505" ? "That category already exists." : "Could not add the category." }, { status: code === "23505" ? 409 : 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  if (!Array.isArray(body.categoryIds) || body.categoryIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ error: "Invalid category order." }, { status: 400 });
  const { slug } = await params;
  return (await reorderMenuCategories(user.id, slug, body.categoryIds)) ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Could not reorder categories." }, { status: 400 });
}
