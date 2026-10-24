export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string;
  countryCode: string;
  cuisine: string;
  location: string;
  currency: string;
  phone: string;
  email: string;
  website: string;
  openingHours: Record<string, { open: string; close: string; closed: boolean }>;
  logoUrl?: string;
  coverImageUrl?: string;
  published: boolean;
  orderingEnabled: boolean;
  serviceChargePercent: number;
  stripeChargesEnabled: boolean;
};

export type MenuCategory = {
  id: string;
  restaurantId: string;
  name: string;
  position: number;
};

export type MenuItem = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  price: number;
  description: string;
  image?: string;
  available: boolean;
};

export type MenuItemWithCategory = MenuItem & { category: string };

export type RestaurantMenu = {
  restaurant: Restaurant;
  categories: MenuCategory[];
  items: MenuItemWithCategory[];
};
