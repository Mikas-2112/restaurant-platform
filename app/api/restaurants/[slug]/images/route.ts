import { NextResponse } from "next/server";
import { getAuthenticatedUser, uploadMenuImage } from "@/app/lib/restaurant-store";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maximumSize = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF image." }, { status: 400 });
  if (file.size > maximumSize) return NextResponse.json({ error: "The image must be smaller than 5 MB." }, { status: 400 });
  const { slug } = await params;
  const url = await uploadMenuImage(user.id, slug, file);
  return url ? NextResponse.json({ url }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
}
