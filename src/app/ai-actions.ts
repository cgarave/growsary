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

export interface ParsedProductAI {
  action: "confirm_product" | "confirm_multiple" | "create_product" | "missing_info";
  reply: string;
  categoryName?: string;
  isNewCategory?: boolean;
  product?: ParsedProductItem;
  multipleProducts?: ParsedProductItem[];
  detectedMode?: "single_with_variants" | "multiple_single_items";
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

  // Direct execution action if confirmed by user
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

  // Direct execution action for multiple items/variants confirmed by user
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

  // Fallback check if API key is not configured
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return {
      action: "missing_info",
      reply:
        "⚠️ `GEMINI_API_KEY` is not configured yet. Please set `GEMINI_API_KEY` in your environment variables to enable AI processing.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an intelligent store inventory assistant for Growsary.
Your task is to analyze user text messages and/or uploaded product images (receipts, price tags, packaging photos, written notes, store price lists) to extract product information for store catalog entry.

Existing Store Categories:
${JSON.stringify(existingCategoryNames)}

Extraction Guidelines:
1. Price Equalization Rule:
   - When an image or text contains a product name and a single price value, set BOTH "retailPrice" and "wholesalePrice" to that exact price value unless separate retail and wholesale prices are explicitly specified.

2. Multiple Products Inspection:
   - Carefully inspect the image or text to see if there are multiple products listed (e.g., price lists with item names on the right and prices on the left/right, receipts, written price sheets).
   - If multiple product entries or sizes are detected, extract all of them into the "multipleProducts" array.

3. Output Format:
Respond strictly with a JSON object in this format:
{
  "status": "success" | "missing_info",
  "hasMultiple": boolean,
  "reply": "Friendly summary of what was extracted from the image/text.",
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

- If critical info (Product Name or Price) is missing, set status to "missing_info" and explain what is missing in "reply".
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
