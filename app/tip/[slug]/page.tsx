import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import TipClient, { TipPageData } from "./tip-client";

export const dynamic = "force-dynamic";

export default async function TipPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ waiter?: string; result?: string }>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, currency, logo_url, tipping_enabled, published")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant?.published || !restaurant.tipping_enabled) notFound();

  const { data: waiters, error } = await supabase
    .from("waiters")
    .select("id, name, role, photo_url")
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .order("name");
  if (error) throw new Error("Could not load waiters.");

  const data = { restaurant, waiters: waiters ?? [] } as TipPageData;
  const selectedWaiter = data.waiters.some(
    (waiter) => waiter.id === search.waiter,
  )
    ? search.waiter
    : "";

  return (
    <TipClient
      data={data}
      slug={slug}
      selectedWaiter={selectedWaiter}
      result={search.result ?? ""}
    />
  );
}
