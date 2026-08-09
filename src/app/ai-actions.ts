"use server";

import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";

export interface ParsedProductAI {
  action: "create_product" | "clarify_category" | "missing_info";
  reply: string;
  categoryName?: string;
  isNewCategory?: boolean;
  product?: {
    name: string;
    brand?: string;
    barcode?: string;
    variantLabel: string;
    retailPrice: number;
    wholesalePrice: number;
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

  // If user provided a specific category choice to clarify category prompt
  if (payload.categoryChoice && payload.message.startsWith("CONFIRM_PRODUCT_CREATE:")) {
    try {
      const rawJson = payload.message.replace("CONFIRM_PRODUCT_CREATE:", "");
      const productData = JSON.parse(rawJson);

      let targetCategory = await prisma.category.findUnique({
        where: { name: payload.categoryChoice },
      });

      if (!targetCategory) {
        targetCategory = await prisma.category.create({
          data: { name: payload.categoryChoice },
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
                  { type: "WHOLESALE", amount: Number(productData.wholesalePrice) || 0 },
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
        reply: `Successfully added **${created.name}** under category **"${targetCategory.name}"**!`,
        categoryName: targetCategory.name,
      };
    } catch (e: any) {
      return {
        action: "missing_info",
        reply: `Failed to create product: ${e.message || "Invalid product data"}`,
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
Your task is to analyze user text messages and/or uploaded product images (receipts, price tags, packaging photos, written notes) to extract product information for catalog entry.

Existing Store Categories:
${JSON.stringify(existingCategoryNames)}

Extraction Guidelines:
1. Identify:
   - Product Name (required)
   - Brand (optional)
   - Retail Price (numeric, required)
   - Wholesale Price (numeric, optional; if missing, set equal to retail price)
   - Variant Label (e.g. "1.5L Bottle", "250g Pack", "Single", "Standard"; default to "Standard" if not specified)
   - Barcode (optional numeric string)

2. Category Assignment:
   - Match the product to one of the Existing Store Categories if it clearly fits (case-insensitive).
   - If it does NOT fit any existing category, suggest a clean, standard category name (e.g. "Dairy", "Beverages", "Toiletries", "Household"). Set "isNewCategory": true.

3. Output Format:
You MUST respond strictly with a JSON object matching this structure:
{
  "status": "success" | "missing_info" | "unclear_category",
  "reply": "Friendly explanation of what was extracted or requested",
  "product": {
    "name": string,
    "brand": string | null,
    "barcode": string | null,
    "variantLabel": string,
    "retailPrice": number,
    "wholesalePrice": number
  },
  "matchedCategory": string,
  "isNewCategory": boolean,
  "suggestedNewCategory"?: string
}

If critical information (like Product Name or Retail Price) cannot be determined from text or image, set status to "missing_info" and explain what is missing in "reply".
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
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);

    if (parsed.status === "missing_info" || !parsed.product?.name) {
      return {
        action: "missing_info",
        reply: parsed.reply || "Could not determine complete product details. Please provide the product name and price.",
      };
    }

    // Auto-create product if matched to existing category
    const categoryName = parsed.matchedCategory || payload.categoryChoice;
    const isNew = parsed.isNewCategory && !existingCategoryNames.some(c => c.toLowerCase() === categoryName?.toLowerCase());

    if (isNew && !payload.categoryChoice) {
      return {
        action: "clarify_category",
        reply: `Extracted **${parsed.product.name}** (${parsed.product.variantLabel}) priced at **₱${parsed.product.retailPrice}**.

I noticed this doesn't fit existing categories (${existingCategoryNames.join(", ")}).
Would you like to assign it to **"${parsed.suggestedNewCategory || categoryName}"** or choose an existing category?`,
        categoryName: parsed.suggestedNewCategory || categoryName,
        isNewCategory: true,
        product: parsed.product,
      };
    }

    // Save product directly
    const targetCategoryName = categoryName || existingCategoryNames[0] || "General";
    let targetCat = await prisma.category.findUnique({
      where: { name: targetCategoryName },
    });

    if (!targetCat) {
      targetCat = await prisma.category.create({
        data: { name: targetCategoryName },
      });
    }

    const created = await prisma.product.create({
      data: {
        name: parsed.product.name,
        brand: parsed.product.brand || null,
        barcode: parsed.product.barcode || null,
        categoryId: targetCat.id,
        variants: {
          create: {
            label: parsed.product.variantLabel || "Standard",
            prices: {
              create: [
                { type: "RETAIL", amount: Number(parsed.product.retailPrice) || 0 },
                { type: "WHOLESALE", amount: Number(parsed.product.wholesalePrice) || Number(parsed.product.retailPrice) || 0 },
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
      reply: `✨ **Added ${created.name}** (${parsed.product.variantLabel}) — ₱${parsed.product.retailPrice} under **${targetCat.name}**!`,
      categoryName: targetCat.name,
    };
  } catch (err: any) {
    console.error("AI Assistant Error:", err);
    return {
      action: "missing_info",
      reply: `Sorry, I ran into an error processing your request: ${err.message || "Failed to parse AI response."}`,
    };
  }
}
