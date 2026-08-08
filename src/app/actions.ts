"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

export type PriceType = "RETAIL" | "WHOLESALE";

export interface VariantPrice {
  id: string;
  label: string;
  retailPrice: number;
  wholesalePrice: number;
  recentChange: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string | null;
  isOutOfStock: boolean;
  categoryId: string;
  categoryName: string;
  hasRecentPriceChange: boolean;
  variants: VariantPrice[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  productCount: number;
}

export const getCatalogData = unstable_cache(
  async () => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

  const rawProducts = await prisma.product.findMany({
    include: {
      category: true,
      variants: {
        include: {
          prices: {
            orderBy: { effectiveFrom: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const products: CatalogProduct[] = rawProducts.map((p) => {
    let hasRecentChange = false;

    const variants: VariantPrice[] = p.variants.map((v) => {
      const latestRetail = v.prices.find((pr) => pr.type === "RETAIL");
      const latestWholesale = v.prices.find((pr) => pr.type === "WHOLESALE");

      const retailAmt = latestRetail ? Number(latestRetail.amount) : 0;
      const wholesaleAmt = latestWholesale ? Number(latestWholesale.amount) : 0;

      const recentChange = v.prices.some(
        (pr) => new Date(pr.effectiveFrom) >= thirtyDaysAgo
      );

      if (recentChange) hasRecentChange = true;

      return {
        id: v.id,
        label: v.label,
        retailPrice: retailAmt,
        wholesalePrice: wholesaleAmt,
        recentChange,
      };
    });

    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      isOutOfStock: p.isOutOfStock,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      hasRecentPriceChange: hasRecentChange,
      variants,
    };
  });

  const formattedCategories: CatalogCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    productCount: c._count.products,
  }));

    return {
      categories: formattedCategories,
      products,
    };
  },
  ["catalog-data"],
  {
    revalidate: 86400, // Cache for 24 hours (1 day)
    tags: ["catalog"],
  }
);

export async function toggleProductStockAction(productId: string, currentStatus: boolean) {
  await prisma.product.update({
    where: { id: productId },
    data: { isOutOfStock: !currentStatus },
  });
  revalidateTag("catalog", "max");
  revalidatePath("/");
}

export async function deleteProductAction(productId: string) {
  await prisma.product.delete({
    where: { id: productId },
  });
  revalidateTag("catalog", "max");
  revalidatePath("/");
}

export async function createProductAction(data: {
  name: string;
  brand?: string;
  barcode?: string;
  categoryName: string;
  variantLabel: string;
  retailPrice: number;
  wholesalePrice: number;
}) {
  let category = await prisma.category.findUnique({
    where: { name: data.categoryName },
  });

  if (!category) {
    category = await prisma.category.create({
      data: { name: data.categoryName },
    });
  }

  const product = await prisma.product.create({
    data: {
      name: data.name,
      brand: data.brand || null,
      barcode: data.barcode || null,
      categoryId: category.id,
      variants: {
        create: {
          label: data.variantLabel,
          prices: {
            create: [
              { type: "RETAIL", amount: data.retailPrice },
              { type: "WHOLESALE", amount: data.wholesalePrice },
            ],
          },
        },
      },
    },
  });

  revalidateTag("catalog", "max");
  revalidatePath("/");
  return product;
}

export async function updateProductAction(data: {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  categoryName: string;
  variants: Array<{
    id?: string;
    label: string;
    retailPrice: number;
    wholesalePrice: number;
  }>;
}) {
  let category = await prisma.category.findUnique({
    where: { name: data.categoryName },
  });

  if (!category) {
    category = await prisma.category.create({
      data: { name: data.categoryName },
    });
  }

  await prisma.product.update({
    where: { id: data.id },
    data: {
      name: data.name,
      brand: data.brand || null,
      barcode: data.barcode || null,
      categoryId: category.id,
    },
  });

  for (const v of data.variants) {
    if (v.id) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { label: v.label },
      });

      // Append new price records for price log history if modified
      await prisma.price.create({
        data: {
          variantId: v.id,
          type: "RETAIL",
          amount: v.retailPrice,
        },
      });

      await prisma.price.create({
        data: {
          variantId: v.id,
          type: "WHOLESALE",
          amount: v.wholesalePrice,
        },
      });
    } else {
      // New variant added during edit
      await prisma.productVariant.create({
        data: {
          label: v.label,
          productId: data.id,
          prices: {
            create: [
              { type: "RETAIL", amount: v.retailPrice },
              { type: "WHOLESALE", amount: v.wholesalePrice },
            ],
          },
        },
      });
    }
  }

  revalidateTag("catalog", "max");
  revalidatePath("/");
}

export async function getPriceHistoryAction(variantId: string) {
  const prices = await prisma.price.findMany({
    where: { variantId },
    orderBy: { effectiveFrom: "desc" },
  });

  return prices.map((p) => ({
    id: p.id,
    type: p.type as "RETAIL" | "WHOLESALE",
    amount: Number(p.amount),
    effectiveFrom: p.effectiveFrom.toISOString(),
  }));
}

