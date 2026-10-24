import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
type Context = { params: Promise<{ id: string }> };
const unavailable = () =>
  NextResponse.json(
    { error: "Demo tip checkout is disabled." },
    { status: 404 },
  );
export async function GET(_: Request, { params }: Context) {
  if (process.env.PAYMENT_MODE !== "demo") return unavailable();
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: tip } = await supabase
    .from("waiter_tips")
    .select(
      "id, restaurant_id, waiter_id, amount, currency, customer_message, status",
    )
    .eq("id", id)
    .eq("restaurant_id", process.env.PAYMENT_RESTAURANT_ID)
    .maybeSingle();
  if (!tip)
    return NextResponse.json({ error: "Tip not found." }, { status: 404 });
  const [{ data: waiter }, { data: restaurant }] = await Promise.all([
    supabase
      .from("waiters")
      .select("name, role")
      .eq("id", tip.waiter_id)
      .maybeSingle(),
    supabase
      .from("restaurants")
      .select("name, slug")
      .eq("id", tip.restaurant_id)
      .maybeSingle(),
  ]);
  return NextResponse.json({ tip, waiter, restaurant });
}
export async function POST(request: Request, { params }: Context) {
  if (process.env.PAYMENT_MODE !== "demo") return unavailable();
  const { id } = await params;
  const { outcome } = await request.json();
  const success = outcome === "success";
  if (!["success", "cancelled", "failed"].includes(outcome))
    return NextResponse.json({ error: "Invalid outcome." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("waiter_tips")
    .update({
      status: success ? "paid" : "failed",
      payment_reference: `demo_tip_${outcome}_${id}`,
      paid_at: success ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", process.env.PAYMENT_RESTAURANT_ID)
    .eq("status", "pending")
    .select("restaurant_id")
    .maybeSingle();
  if (error || !data)
    return NextResponse.json(
      { error: "Could not update tip." },
      { status: 409 },
    );
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", data.restaurant_id)
    .maybeSingle();
  return NextResponse.json({
    redirectUrl: `/tip/${restaurant?.slug}?result=${success ? "success" : "cancelled"}`,
  });
}
