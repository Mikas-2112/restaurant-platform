import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secretKey || !webhookSecret || !signature)
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === "paid") {
      const { error } = await getSupabaseServerClient()
        .from("orders")
        .update({
          payment_status: "paid",
          status: "new",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("payment_reference", session.id)
        .eq("payment_status", "pending");
      if (error)
        return NextResponse.json({ error: "Could not confirm order." }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    if (session.metadata?.order_id)
      await getSupabaseServerClient()
        .from("orders")
        .update({ payment_status: "failed", status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", session.metadata.order_id)
        .eq("payment_reference", session.id)
        .eq("payment_status", "pending");
  }

  return NextResponse.json({ received: true });
}
