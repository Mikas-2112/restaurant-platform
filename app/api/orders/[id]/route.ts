import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { data, error } = await getSupabaseServerClient().from("orders").select("id, status, payment_status, table_number, created_at").eq("id", id).maybeSingle();
  return error || !data ? NextResponse.json({ error: "Order not found." }, { status: 404 }) : NextResponse.json(data);
}
