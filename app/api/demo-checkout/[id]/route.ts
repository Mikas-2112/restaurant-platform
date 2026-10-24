import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const unavailable = () => NextResponse.json({ error: "Demo checkout is disabled." }, { status: 404 });

export async function GET(_: Request, { params }: Context) {
  if (process.env.PAYMENT_MODE !== "demo") return unavailable();
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("id, restaurant_id, table_id, table_number, subtotal, service_charge_amount, total, payment_status").eq("id", id).eq("restaurant_id", process.env.PAYMENT_RESTAURANT_ID).maybeSingle();
  if (!order) return NextResponse.json({ error: "Demo order not found." }, { status: 404 });
  const { data: restaurant } = await supabase.from("restaurants").select("name, slug, currency").eq("id", order.restaurant_id).maybeSingle();
  return restaurant ? NextResponse.json({ order, restaurant }) : NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  if (process.env.PAYMENT_MODE !== "demo") return unavailable();
  const { id } = await params;
  const { outcome } = await request.json();
  if (!["success", "failed", "cancelled"].includes(outcome)) return NextResponse.json({ error: "Invalid demo result." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const successful = outcome === "success";
  const { data, error } = await supabase.from("orders").update({ payment_status: successful ? "paid" : "failed", status: successful ? "new" : "cancelled", paid_at: successful ? new Date().toISOString() : null, payment_reference: `demo_${outcome}_${id}`, updated_at: new Date().toISOString() }).eq("id", id).eq("restaurant_id", process.env.PAYMENT_RESTAURANT_ID).eq("payment_provider", "demo").eq("payment_status", "pending").select("id, table_id, restaurant_id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Demo order could not be updated." }, { status: 409 });
  const { data: restaurant } = await supabase.from("restaurants").select("slug").eq("id", data.restaurant_id).maybeSingle();
  return NextResponse.json({ redirectUrl: `/menu/${restaurant?.slug}?table=${data.table_id}&payment=${successful ? "success" : "cancelled"}&order=${id}` });
}
