"use server";

import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";

export interface ParsedProductItem {
  name: string;
  brand?: string;
  barcode?: string;
  variantLabel: string;
  retailPrice: number;
  wholesalePrice: number;
  categoryName?: string;
}

export interface ProductVariantPriceItem {
  id: string;
  label: string;
  retailPrice: number;
  wholesalePrice: number;
}

export interface ParsedProductAI {
  action: "confirm_product" | "confirm_multiple" | "confirm_price_update" | "create_product" | "update_price_success" | "missing_info";
  reply: string;
  categoryName?: string;
  isNewCategory?: boolean;
  product?: ParsedProductItem;
  multipleProducts?: ParsedProductItem[];
  detectedMode?: "single_with_variants" | "multiple_single_items";
  updateTarget?: {
    productId: string;
    productName: string;
    brand?: string;
    categoryName: string;
    variants: ProductVariantPriceItem[];
    suggestedNewPrices?: {
      targetVariantLabel?: string;
      newRetailPrice?: number;
      newWholesalePrice?: number;
    };
  };
}

export async function processAiProductMessageAction(payload: {
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
  categoryChoice?: string;
}): Promise<ParsedProductAI> {
  const apiKey = process.env.GEMINI_API_KEY;
  const categories = await prisma.category.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const existingCategoryNames = categories.map((c) => c.name);

  // ---------------------------------------------------------------------------
  // Action Handler 1: Direct Execution for Creating a Single Product
  // ---------------------------------------------------------------------------
  if (payload.message.startsWith("EXECUTE_PRODUCT_CREATE:")) {
    try {
      const rawJson = payload.message.replace("EXECUTE_PRODUCT_CREATE:", "");
      const productData: ParsedProductItem = JSON.parse(rawJson);
      const catName = payload.categoryChoice || productData.categoryName || existingCategoryNames[0] || "General";

      let targetCategory = await prisma.category.findUnique({
        where: { name: catName },
      });

      if (!targetCategory) {
        targetCategory = await prisma.category.create({
          data: { name: catName },
        });
      }

      const created = await prisma.product.create({
        data: {
          name: productData.name,
          brand: productData.brand || null,
          barcode: productData.barcode || null,
          categoryId: targetCategory.id,
          variants: {
            create: {
              label: productData.variantLabel || "Standard",
              prices: {
                create: [
                  { type: "RETAIL", amount: Number(productData.retailPrice) || 0 },
                  { type: "WHOLESALE", amount: Number(productData.wholesalePrice) ?? Number(productData.retailPrice) ?? 0 },
                ],
              },
            },
          },
        },
      });

      revalidateTag("catalog", "max");
      revalidatePath("/", "layout");

      return {
        action: "create_product",
        reply: `✨ **Added ${created.name}** (${productData.variantLabel || "Standard"}) under category **"${targetCategory.name}"**!`,
        categoryName: targetCategory.name,
      };
    } catch (e: any) {
      return {
        action: "missing_info",
        reply: `Failed to create product: ${e.message || "Invalid product data"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Action Handler 2: Direct Execution for Creating Multiple Products/Variants
  // ---------------------------------------------------------------------------
  if (payload.message.startsWith("EXECUTE_MULTIPLE_CREATE:")) {
    try {
      const rawJson = payload.message.replace("EXECUTE_MULTIPLE_CREATE:", "");
      const payloadData: { items: ParsedProductItem[]; mode: "single_with_variants" | "multiple_single_items" } = JSON.parse(rawJson);

      const defaultCatName = payload.categoryChoice || payloadData.items[0]?.categoryName || existingCategoryNames[0] || "General";
      let targetCat = await prisma.category.findUnique({
        where: { name: defaultCatName },
      });

      if (!targetCat) {
        targetCat = await prisma.category.create({
          data: { name: defaultCatName },
        });
      }

      if (payloadData.mode === "single_with_variants" && payloadData.items.length > 0) {
        // Create 1 product with multiple variants
        const baseItem = payloadData.items[0];
        const created = await prisma.product.create({
          data: {
            name: baseItem.name,
            brand: baseItem.brand || null,
            barcode: baseItem.barcode || null,
            categoryId: targetCat.id,
            variants: {
              create: payloadData.items.map((item) => ({
                label: item.variantLabel || "Standard",
                prices: {
                  create: [
                    { type: "RETAIL", amount: Number(item.retailPrice) || 0 },
                    { type: "WHOLESALE", amount: Number(item.wholesalePrice) ?? Number(item.retailPrice) ?? 0 },
                  ],
                },
              })),
            },
          },
        });

        revalidateTag("catalog", "max");
        revalidatePath("/", "layout");

        return {
          action: "create_product",
          reply: `✨ **Added ${created.name}** with ${payloadData.items.length} variants under category **"${targetCat.name}"**!`,
          categoryName: targetCat.name,
        };
      } else {
        // Create multiple separate products
        for (const item of payloadData.items) {
          const itemCatName = item.categoryName || defaultCatName;
          let itemCat = await prisma.category.findUnique({ where: { name: itemCatName } });
          if (!itemCat) {
            itemCat = await prisma.category.create({ data: { name: itemCatName } });
          }

          await prisma.product.create({
            data: {
              name: item.name,
              brand: item.brand || null,
              barcode: item.barcode || null,
              categoryId: itemCat.id,
              variants: {
                create: {
                  label: item.variantLabel || "Standard",
                  prices: {
                    create: [
                      { type: "RETAIL", amount: Number(item.retailPrice) || 0 },
                      { type: "WHOLESALE", amount: Number(item.wholesalePrice) ?? Number(item.retailPrice) ?? 0 },
                    ],
                  },
                },
              },
            },
          });
        }

        revalidateTag("catalog", "max");
        revalidatePath("/", "layout");

        return {
          action: "create_product",
          reply: `✨ **Added ${payloadData.items.length} products** to your catalog!`,
          categoryName: targetCat.name,
        };
      }
    } catch (e: any) {
      return {
        action: "missing_info",
        reply: `Failed to create products: ${e.message || "Invalid payload"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Action Handler 3: Direct Execution for Updating Selected Variant Prices
  // ---------------------------------------------------------------------------
  if (payload.message.startsWith("EXECUTE_PRICE_UPDATE:")) {
    try {
      const rawJson = payload.message.replace("EXECUTE_PRICE_UPDATE:", "");
      const updateData: {
        productId: string;
        variantUpdates: Array<{
          variantId: string;
          updateRetail: boolean;
          updateWholesale: boolean;
          newRetailPrice?: number;
          newWholesalePrice?: number;
        }>;
      } = JSON.parse(rawJson);

      let updatedCount = 0;

      for (const update of updateData.variantUpdates) {
        if (!update.updateRetail && !update.updateWholesale) continue;

        if (update.updateRetail && update.newRetailPrice !== undefined) {
          const retailPriceObj = await prisma.price.findFirst({
            where: { variantId: update.variantId, type: "RETAIL" },
          });

          if (retailPriceObj) {
            await prisma.price.update({
              where: { id: retailPriceObj.id },
              data: { amount: update.newRetailPrice },
            });
          } else {
            await prisma.price.create({
              data: {
                variantId: update.variantId,
                type: "RETAIL",
                amount: update.newRetailPrice,
              },
            });
          }
        }

        if (update.updateWholesale && update.newWholesalePrice !== undefined) {
          const wholesalePriceObj = await prisma.price.findFirst({
            where: { variantId: update.variantId, type: "WHOLESALE" },
          });

          if (wholesalePriceObj) {
            await prisma.price.update({
              where: { id: wholesalePriceObj.id },
              data: { amount: update.newWholesalePrice },
            });
          } else {
            await prisma.price.create({
              data: {
                variantId: update.variantId,
                type: "WHOLESALE",
                amount: update.newWholesalePrice,
              },
            });
          }
        }

        updatedCount++;
      }

      revalidateTag("catalog", "max");
      revalidatePath("/", "layout");

      return {
        action: "update_price_success",
        reply: `✅ Successfully updated prices for ${updatedCount} variant(s)!`,
      };
    } catch (e: any) {
      return {
        action: "missing_info",
        reply: `Failed to update variant prices: ${e.message || "Invalid payload"}`,
      };
    }
  }

  // Fallback check if API key is not configured
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return {
      action: "missing_info",
      reply:
        "⚠️ `GEMINI_API_KEY` is not configured yet. Please set `GEMINI_API_KEY` in your environment variables to enable AI processing.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // System instruction for intent classification & extraction
  const systemInstruction = `
You are an intelligent store inventory assistant for Growsary.
Your task is to analyze user text messages and/or uploaded product images (receipts, price tags, packaging photos, written notes, store price lists) to extract product details OR detect intent to update existing item prices.

Existing Store Categories:
${JSON.stringify(existingCategoryNames)}

Extraction Guidelines:
1. Intent Classification:
   - "update_price": User wants to update/change/adjust the retail or wholesale price of an existing product (e.g. "update Coca-Cola 1.5L price to 70", "change retail price of Sprite", "update price for Royal").
   - "add_product": User wants to add new product(s) or upload a photo/receipt of new inventory.

2. Price Equalization Rule (for add_product):
   - When an image or text contains a product name and a single price value, set BOTH "retailPrice" and "wholesalePrice" to that exact price value unless separate retail and wholesale prices are explicitly specified.

3. Output Format:
Respond strictly with a JSON object in this format:
{
  "intent": "update_price" | "add_product",
  "status": "success" | "missing_info",
  "targetProductName"?: string,
  "targetVariantLabel"?: string,
  "newRetailPrice"?: number,
  "newWholesalePrice"?: number,
  "hasMultiple"?: boolean,
  "reply"?: string,
  "product"?: {
    "name": string,
    "brand": string | null,
    "barcode": string | null,
    "variantLabel": string,
    "retailPrice": number,
    "wholesalePrice": number,
    "categoryName": string
  },
  "multipleProducts"?: Array<{
    "name": string,
    "brand": string | null,
    "barcode": string | null,
    "variantLabel": string,
    "retailPrice": number,
    "wholesalePrice": number,
    "categoryName": string
  }>
}
`;

  try {
    const contents: any[] = [];
    if (payload.imageBase64 && payload.imageMimeType) {
      contents.push({
        inlineData: {
          mimeType: payload.imageMimeType,
          data: payload.imageBase64,
        },
      });
    }
    if (payload.message) {
      contents.push({ text: payload.message });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);

    // ---------------------------------------------------------------------------
    // Path A: User wants to UPDATE an existing item's variant price
    // ---------------------------------------------------------------------------
    if (parsed.intent === "update_price" || payload.message.toLowerCase().includes("update price") || payload.message.toLowerCase().includes("change price")) {
      const searchName = parsed.targetProductName || payload.message.replace(/update|price|change|to|for/gi, "").trim();

      // Find matching products in database
      const matchedProducts = await prisma.product.findMany({
        where: {
          name: { contains: searchName, mode: "insensitive" },
        },
        include: {
          category: true,
          variants: {
            include: {
              prices: true,
            },
          },
        },
        take: 3,
      });

      if (matchedProducts.length === 0) {
        return {
          action: "missing_info",
          reply: `I couldn't find any existing product matching **"${searchName}"** in your store catalog. Please check the product name or add it as a new item.`,
        };
      }

      const targetProd = matchedProducts[0];
      const variantsWithPrices: ProductVariantPriceItem[] = targetProd.variants.map((v) => {
        const retail = Number(v.prices.find((p) => p.type === "RETAIL")?.amount || 0);
        const wholesale = Number(v.prices.find((p) => p.type === "WHOLESALE")?.amount || 0);
        return {
          id: v.id,
          label: v.label,
          retailPrice: retail,
          wholesalePrice: wholesale,
        };
      });

      return {
        action: "confirm_price_update",
        reply: `I found **${targetProd.name}** under **${targetProd.category.name}**. Select which variant and price type (retail or wholesale) you'd like to update:`,
        updateTarget: {
          productId: targetProd.id,
          productName: targetProd.name,
          brand: targetProd.brand || undefined,
          categoryName: targetProd.category.name,
          variants: variantsWithPrices,
          suggestedNewPrices: {
            targetVariantLabel: parsed.targetVariantLabel,
            newRetailPrice: parsed.newRetailPrice,
            newWholesalePrice: parsed.newWholesalePrice,
          },
        },
      };
    }

    // ---------------------------------------------------------------------------
    // Path B: User wants to ADD new product(s)
    // ---------------------------------------------------------------------------
    if (parsed.status === "missing_info" || (!parsed.product?.name && (!parsed.multipleProducts || parsed.multipleProducts.length === 0))) {
      return {
        action: "missing_info",
        reply: parsed.reply || "Could not determine complete product details. Please provide the product name and price.",
      };
    }

    // Handle multiple items detected in image/text
    if (parsed.hasMultiple && parsed.multipleProducts && parsed.multipleProducts.length > 1) {
      const items: ParsedProductItem[] = parsed.multipleProducts.map((p: any) => ({
        name: p.name,
        brand: p.brand || undefined,
        barcode: p.barcode || undefined,
        variantLabel: p.variantLabel || "Standard",
        retailPrice: Number(p.retailPrice) || 0,
        wholesalePrice: Number(p.wholesalePrice) ?? Number(p.retailPrice) ?? 0,
        categoryName: p.categoryName || existingCategoryNames[0] || "General",
      }));

      return {
        action: "confirm_multiple",
        reply: `I found **${items.length} entries** in your photo/message! Would you like to add them as a **Single product with ${items.length} variants** or as **${items.length} separate single products**?`,
        multipleProducts: items,
      };
    }

    // Handle single item detected
    const singleProduct: ParsedProductItem = {
      name: parsed.product.name,
      brand: parsed.product.brand || undefined,
      barcode: parsed.product.barcode || undefined,
      variantLabel: parsed.product.variantLabel || "Standard",
      retailPrice: Number(parsed.product.retailPrice) || 0,
      wholesalePrice: Number(parsed.product.wholesalePrice) ?? Number(parsed.product.retailPrice) ?? 0,
      categoryName: parsed.product.categoryName || existingCategoryNames[0] || "General",
    };

    return {
      action: "confirm_product",
      reply: `Please confirm the extracted details for **${singleProduct.name}**:`,
      product: singleProduct,
      categoryName: singleProduct.categoryName,
    };
  } catch (err: any) {
    console.error("AI Assistant Error:", err);
    return {
      action: "missing_info",
      reply: `Sorry, I ran into an error processing your request: ${err.message || "Failed to parse AI response."}`,
    };
  }
}
