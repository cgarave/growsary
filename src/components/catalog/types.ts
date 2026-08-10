import { CatalogCategory, CatalogProduct, VariantPrice } from "@/app/actions";

export interface CartItem {
  key: string;
  productId: string;
  variantId: string;
  name: string;
  brand: string | null;
  variantLabel: string;
  unitPrice: number;
  qty: number;
}

export type PriceMode = "retail" | "wholesale";

export const CATEGORY_EMOJIS: Record<string, string> = {
  Softdrinks: "🥤",
  Snacks: "🍿",
  Biscuits: "🍪",
  "Canned Goods": "🥫",
  "Instant Noodles": "🍜",
};
