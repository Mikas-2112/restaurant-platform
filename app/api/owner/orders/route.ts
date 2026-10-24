import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase.from("restaurants").select("id, name, ordering_enabled").eq("owner_id", user.id).limit(1).maybeSingle();
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  const { data, error } = await supabase.from("orders").select("id, table_number, customer_note, status, subtotal, service_charge_amount, tip_amount, total, payment_status, created_at, order_items(id, item_name, unit_price, quantity, customer_note)").eq("restaurant_id", restaurant.id).eq("payment_status", "paid").order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: "Could not load orders." }, { status: 500 }) : NextResponse.json({ restaurant, orders: data });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json();
  const statuses = ["new", "accepted", "preparing", "ready", "completed", "cancelled"];
  if (!body.orderId || !statuses.includes(body.status)) return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  const { data, error } = await supabase.from("orders").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.orderId).eq("restaurant_id", restaurant.id).select("id").maybeSingle();
  return error || !data ? NextResponse.json({ error: "Could not update the order." }, { status: 404 }) : NextResponse.json({ success: true });
}
