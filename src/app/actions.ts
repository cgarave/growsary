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

/**
 * ==============================================================================
 * SERVER-SIDE CATALOG DATA FETCHING & REVALIDATION
 * ==============================================================================
 * 
 * We tag cached results with "catalog" so that when any mutation (create, update,
 * delete, stock toggle) occurs, calling revalidateTag("catalog", "max") purges stale
 * data immediately across Next.js server instances.
 */
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
    revalidate: false, // Expire only on-demand via revalidateTag("catalog", "max") when mutations occur
    tags: ["catalog"],
  }
);

export async function toggleProductStockAction(productId: string, currentStatus: boolean) {
  await prisma.product.update({
    where: { id: productId },
    data: { isOutOfStock: !currentStatus },
  });
  revalidateTag("catalog", "max");
  revalidatePath("/", "layout");
}

export async function deleteProductAction(productId: string) {
  await prisma.product.delete({
    where: { id: productId },
  });
  revalidateTag("catalog", "max");
  revalidatePath("/", "layout");
}

export async function deleteCategoryAction(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  if (category._count.products > 0) {
    throw new Error(
      `Cannot delete "${category.name}" because it still has ${category._count.products} product(s) assigned to it.`
    );
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });

  revalidateTag("catalog", "max");
  revalidatePath("/", "layout");
}

export async function createProductAction(data: {
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  categoryName: string;
  variantLabel?: string;
  retailPrice?: number;
  wholesalePrice?: number;
  variants?: Array<{
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

  const variantsList =
    data.variants && data.variants.length > 0
      ? data.variants
      : [
          {
            label: data.variantLabel || "Standard",
            retailPrice: data.retailPrice || 0,
            wholesalePrice: data.wholesalePrice || 0,
          },
        ];

  const product = await prisma.product.create({
    data: {
      name: data.name,
      brand: data.brand || null,
      barcode: data.barcode || null,
      imageUrl: data.imageUrl || null,
      categoryId: category.id,
      variants: {
        create: variantsList.map((v) => ({
          label: v.label || "Standard",
          prices: {
            create: [
              { type: "RETAIL", amount: v.retailPrice },
              { type: "WHOLESALE", amount: v.wholesalePrice },
            ],
          },
        })),
      },
    },
  });

  revalidateTag("catalog", "max");
  revalidatePath("/", "layout");
  return product;
}

export async function updateProductAction(data: {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
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
      imageUrl: data.imageUrl || null,
      categoryId: category.id,
    },
  });

  // Handle deleted variants
  const existingVariants = await prisma.productVariant.findMany({
    where: { productId: data.id },
    select: { id: true },
  });

  const keepVariantIds = data.variants.map((v) => v.id).filter(Boolean) as string[];
  const deleteVariantIds = existingVariants
    .map((v) => v.id)
    .filter((id) => !keepVariantIds.includes(id));

  if (deleteVariantIds.length > 0) {
    await prisma.productVariant.deleteMany({
      where: { id: { in: deleteVariantIds } },
    });
  }

  for (const v of data.variants) {
    if (v.id && !v.id.startsWith("v-temp-")) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { label: v.label },
      });

      const latestPrices = await prisma.price.findMany({
        where: { variantId: v.id },
        orderBy: { effectiveFrom: "desc" },
        take: 2,
      });

      const latestRetail = latestPrices.find((p) => p.type === "RETAIL");
      const latestWholesale = latestPrices.find((p) => p.type === "WHOLESALE");

      if (!latestRetail || Number(latestRetail.amount) !== v.retailPrice) {
        await prisma.price.create({
          data: {
            variantId: v.id,
            type: "RETAIL",
            amount: v.retailPrice,
          },
        });
      }

      if (!latestWholesale || Number(latestWholesale.amount) !== v.wholesalePrice) {
        await prisma.price.create({
          data: {
            variantId: v.id,
            type: "WHOLESALE",
            amount: v.wholesalePrice,
          },
        });
      }
    } else {
      await prisma.productVariant.create({
        data: {
          label: v.label || "Standard",
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
  revalidatePath("/", "layout");
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
