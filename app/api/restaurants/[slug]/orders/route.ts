import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json();
  const tableId = typeof body.tableId === "string" ? body.tableId : "";
  const customerNote = String(body.customerNote ?? "").trim();
  const requestedItems: {
    itemId?: unknown;
    quantity?: unknown;
    note?: unknown;
  }[] = Array.isArray(body.items) ? body.items : [];
  if (
    !tableId ||
    customerNote.length > 500 ||
    requestedItems.length === 0 ||
    requestedItems.length > 50
  )
    return NextResponse.json(
      { error: "Orders can only be submitted from a valid table QR code." },
      { status: 400 },
    );
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, ordering_enabled, published, service_charge_percent")
    .eq("slug", slug)
    .maybeSingle();
  if (!restaurant?.published || !restaurant.ordering_enabled)
    return NextResponse.json(
      { error: "Online ordering is not available." },
      { status: 403 },
    );
  const paymentMode = process.env.PAYMENT_MODE === "demo" ? "demo" : "stripe";
  if (paymentMode === "stripe" && !process.env.STRIPE_SECRET_KEY)
    return NextResponse.json(
      { error: "Secure payments are not configured yet." },
      { status: 503 },
    );
  if (
    !process.env.PAYMENT_RESTAURANT_ID ||
    process.env.PAYMENT_RESTAURANT_ID !== restaurant.id
  )
    return NextResponse.json(
      { error: "Payments are not configured for this restaurant." },
      { status: 503 },
    );
  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("id, name")
    .eq("id", tableId)
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .maybeSingle();
  if (!table)
    return NextResponse.json(
      { error: "This table QR is not valid. Please ask a member of staff." },
      { status: 400 },
    );
  const ids = [
    ...new Set(
      requestedItems.map((item: { itemId?: unknown }) =>
        String(item.itemId ?? ""),
      ),
    ),
  ];
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id, name, price, available")
    .eq("restaurant_id", restaurant.id)
    .in("id", ids);
  if (menuError)
    return NextResponse.json(
      { error: "Could not check the menu." },
      { status: 500 },
    );
  const menuMap = new Map(
    (
      menuItems as {
        id: string;
        name: string;
        price: number | string;
        available: boolean;
      }[]
    ).map((item) => [item.id, item]),
  );
  const items = requestedItems.map(
    (requested: { itemId?: unknown; quantity?: unknown; note?: unknown }) => {
      const item = menuMap.get(String(requested.itemId ?? ""));
      const quantity = Number(requested.quantity);
      const note = String(requested.note ?? "").trim();
      return item &&
        item.available &&
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= 99 &&
        note.length <= 300
        ? { item, quantity, note }
        : null;
    },
  );
  if (items.some((item) => !item))
    return NextResponse.json(
      { error: "One of the selected dishes is no longer available." },
      { status: 409 },
    );
  const validItems = items.filter(Boolean) as {
    item: { id: string; name: string; price: number | string };
    quantity: number;
    note: string;
  }[];
  const subtotal = validItems.reduce(
    (sum, { item, quantity }) => sum + Number(item.price) * quantity,
    0,
  );
  const subtotalPence = Math.round(subtotal * 100);
  const serviceChargePence = Math.round(
    subtotalPence * (Number(restaurant.service_charge_percent) / 100),
  );
  const totalPence = subtotalPence + serviceChargePence;
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurant.id,
      table_id: tableId,
      table_number: table.name,
      customer_note: customerNote,
      status: "pending_payment",
      subtotal: subtotalPence / 100,
      service_charge_amount: serviceChargePence / 100,
      total: totalPence / 100,
      payment_status: "pending",
      payment_provider: paymentMode,
    })
    .select("id, status")
    .single();
  if (orderError)
    return NextResponse.json(
      { error: "Could not submit the order." },
      { status: 500 },
    );
  const { error: itemError } = await supabase.from("order_items").insert(
    validItems.map(({ item, quantity, note }) => ({
      order_id: order.id,
      menu_item_id: item.id,
      item_name: item.name,
      unit_price: Number(item.price),
      quantity,
      customer_note: note,
    })),
  );
  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: "Could not submit the order." },
      { status: 500 },
    );
  }
  if (paymentMode === "demo") {
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      { orderId: order.id, status: order.status, checkoutUrl: `${origin}/demo-checkout/${order.id}` },
      { status: 201 },
    );
  }
  try {
    const origin = new URL(request.url).origin;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/menu/${encodeURIComponent(slug)}?table=${encodeURIComponent(tableId)}&payment=success&order=${order.id}`,
      cancel_url: `${origin}/menu/${encodeURIComponent(slug)}?table=${encodeURIComponent(tableId)}&payment=cancelled&order=${order.id}`,
      line_items: [
        ...validItems.map(({ item, quantity }) => ({
          quantity,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(Number(item.price) * 100),
            product_data: { name: item.name },
          },
        })),
        ...(serviceChargePence > 0
          ? [{
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: serviceChargePence,
                product_data: {
                  name: `Service charge (${Number(restaurant.service_charge_percent)}%)`,
                },
              },
            }]
          : []),
      ],
      payment_intent_data: {
        metadata: { order_id: order.id, restaurant_id: restaurant.id },
      },
      metadata: { order_id: order.id, restaurant_id: restaurant.id },
    });
    await supabase
      .from("orders")
      .update({ payment_reference: session.id })
      .eq("id", order.id);
    return NextResponse.json(
      { orderId: order.id, status: order.status, checkoutUrl: session.url },
      { status: 201 },
    );
  } catch {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: "Could not start secure checkout. Please try again." },
      { status: 502 },
    );
  }
}
