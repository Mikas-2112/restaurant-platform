import { NextResponse } from "next/server";
import { getAuthenticatedUser, removeMenuCategory, renameMenuCategory } from "@/app/lib/restaurant-store";

type Context = { params: Promise<{ slug: string; categoryId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  const { slug, categoryId } = await params;
  try {
    const category = await renameMenuCategory(user.id, slug, categoryId, name);
    return category ? NextResponse.json(category) : NextResponse.json({ error: "Category not found." }, { status: 404 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json({ error: code === "23505" ? "That category already exists." : "Could not rename the category." }, { status: code === "23505" ? 409 : 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { slug, categoryId } = await params;
  const result = await removeMenuCategory(user.id, slug, categoryId);
  if (result.removed) return new NextResponse(null, { status: 204 });
  if (result.reason === "not-empty") return NextResponse.json({ error: "Move or delete the dishes in this category first." }, { status: 409 });
  return NextResponse.json({ error: "Category not found." }, { status: 404 });
}
