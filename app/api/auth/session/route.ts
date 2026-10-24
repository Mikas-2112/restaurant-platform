import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

const cookieName = "owner_access_token";

export async function POST(request: Request) {
  const body = await request.json();
  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken : "";
  if (!accessToken)
    return NextResponse.json(
      { error: "No session was provided." },
      { status: 400 },
    );
  const { data, error } =
    await getSupabaseServerClient().auth.getUser(accessToken);
  if (error || !data.user)
    return NextResponse.json(
      { error: "The session could not be verified." },
      { status: 401 },
    );
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.VERCEL === "1",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
