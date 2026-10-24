import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json();
  const amount = Number(body.amount);
  const message = String(body.message ?? "").trim();
  if (
    !body.waiterId ||
    !Number.isFinite(amount) ||
    amount < 0.5 ||
    amount > 1000 ||
    message.length > 300
  )
    return NextResponse.json(
      { error: "Choose a waiter and enter a valid tip." },
      { status: 400 },
    );
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, tipping_enabled, published")
    .eq("slug", slug)
    .maybeSingle();
  if (!restaurant?.published || !restaurant.tipping_enabled)
    return NextResponse.json(
      { error: "Waiter tipping is not available." },
      { status: 403 },
    );
  if (process.env.PAYMENT_RESTAURANT_ID !== restaurant.id)
    return NextResponse.json(
      { error: "Tips are not configured for this restaurant." },
      { status: 503 },
    );
  const { data: waiter } = await supabase
    .from("waiters")
    .select("id")
    .eq("id", body.waiterId)
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .maybeSingle();
  if (!waiter)
    return NextResponse.json(
      { error: "This waiter is unavailable." },
      { status: 404 },
    );
  const mode = process.env.PAYMENT_MODE === "demo" ? "demo" : "stripe";
  if (mode !== "demo")
    return NextResponse.json(
      {
        error:
          "Real tip payments will be enabled with the restaurant payment account.",
      },
      { status: 503 },
    );
  const { data: tip, error } = await supabase
    .from("waiter_tips")
    .insert({
      restaurant_id: restaurant.id,
      waiter_id: waiter.id,
      amount: Math.round(amount * 100) / 100,
      currency: "GBP",
      customer_message: message,
      payment_provider: "demo",
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json(
      { error: "Could not start tip payment." },
      { status: 500 },
    );
  return NextResponse.json(
    {
      checkoutUrl: `${new URL(request.url).origin}/demo-tip-checkout/${tip.id}`,
    },
    { status: 201 },
  );
}
