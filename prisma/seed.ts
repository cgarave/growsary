import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_EMOJIS: Record<string, string> = {
  Softdrinks: "🥤",
  Snacks: "🍿",
  Biscuits: "🍪",
  "Canned Goods": "🥫",
  "Instant Noodles": "🍜",
};

const INITIAL_DATA = [
  {
    category: "Softdrinks",
    products: [
      {
        name: "Coca-Cola",
        brand: "Coca-Cola Co.",
        barcode: "4801234567890",
        isOutOfStock: false,
        variants: [
          { label: "330ml Can", retail: 22, wholesale: 18 },
          { label: "1L Bottle", retail: 55, wholesale: 46 },
          { label: "1.5L Bottle", retail: 78, wholesale: 65, recentChange: true },
        ],
      },
      {
        name: "Sprite",
        brand: "Coca-Cola Co.",
        barcode: "4801234567906",
        isOutOfStock: false,
        variants: [
          { label: "330ml Can", retail: 22, wholesale: 18 },
          { label: "1.5L Bottle", retail: 76, wholesale: 63 },
        ],
      },
      {
        name: "Royal",
        brand: "Coca-Cola Co.",
        barcode: null,
        isOutOfStock: true,
        variants: [
          { label: "295ml", retail: 20, wholesale: 16 },
          { label: "1L", retail: 52, wholesale: 44 },
        ],
      },
      {
        name: "Pepsi",
        brand: "PepsiCo",
        barcode: "4805012349876",
        isOutOfStock: false,
        variants: [
          { label: "330ml Can", retail: 21, wholesale: 17, recentChange: true },
          { label: "1.5L", retail: 74, wholesale: 61 },
        ],
      },
      {
        name: "Mountain Dew",
        brand: "PepsiCo",
        barcode: null,
        isOutOfStock: false,
        variants: [{ label: "330ml Can", retail: 22, wholesale: 18 }],
      },
      {
        name: "Mirinda",
        brand: "PepsiCo",
        barcode: "4805012349883",
        isOutOfStock: false,
        variants: [
          { label: "295ml", retail: 20, wholesale: 16 },
          { label: "1L", retail: 50, wholesale: 42 },
        ],
      },
    ],
  },
  {
    category: "Snacks",
    products: [
      {
        name: "Piattos",
        brand: "Jack n Jill",
        barcode: "4800016543210",
        isOutOfStock: false,
        variants: [
          { label: "40g", retail: 24, wholesale: 20 },
          { label: "85g", retail: 45, wholesale: 38 },
        ],
      },
      {
        name: "Nova",
        brand: "Jack n Jill",
        barcode: null,
        isOutOfStock: false,
        variants: [{ label: "78g", retail: 22, wholesale: 18, recentChange: true }],
      },
      {
        name: "Chippy",
        brand: "Jack n Jill",
        barcode: "4800016543227",
        isOutOfStock: false,
        variants: [
          { label: "110g", retail: 22, wholesale: 18 },
          { label: "150g", retail: 30, wholesale: 25 },
        ],
      },
      {
        name: "Clover Chips",
        brand: "Leslie's",
        barcode: null,
        isOutOfStock: false,
        variants: [{ label: "60g", retail: 15, wholesale: 12 }],
      },
    ],
  },
  {
    category: "Biscuits",
    products: [
      {
        name: "Rebisco Crackers",
        brand: "Rebisco",
        barcode: "4800088123456",
        isOutOfStock: false,
        variants: [
          { label: "32g Pack", retail: 8, wholesale: 6 },
          { label: "10-pack", retail: 75, wholesale: 60 },
        ],
      },
      {
        name: "Fita",
        brand: "Monde Nissin",
        barcode: null,
        isOutOfStock: false,
        variants: [{ label: "250g", retail: 38, wholesale: 31, recentChange: true }],
      },
      {
        name: "SkyFlakes",
        brand: "M.Y. San",
        barcode: "4800088123463",
        isOutOfStock: false,
        variants: [{ label: "32g Pack", retail: 9, wholesale: 7 }],
      },
    ],
  },
];

async function main() {
  console.log("Seeding database...");

  // Seed Categories, Products, Variants & Prices
  for (const catGroup of INITIAL_DATA) {
    const category = await prisma.category.upsert({
      where: { name: catGroup.category },
      update: {},
      create: { name: catGroup.category },
    });

    for (const prodData of catGroup.products) {
      const product = await prisma.product.upsert({
        where: { barcode: prodData.barcode ?? `temp-${prodData.name.toLowerCase().replace(/\s+/g, "-")}` },
        update: {
          name: prodData.name,
          brand: prodData.brand,
          isOutOfStock: prodData.isOutOfStock,
        },
        create: {
          name: prodData.name,
          brand: prodData.brand,
          barcode: prodData.barcode,
          categoryId: category.id,
          isOutOfStock: prodData.isOutOfStock,
        },
      });

      for (const vData of prodData.variants as Array<{ label: string; retail: number; wholesale: number; recentChange?: boolean }>) {
        let variant = await prisma.productVariant.findFirst({
          where: { productId: product.id, label: vData.label },
        });

        if (!variant) {
          variant = await prisma.productVariant.create({
            data: {
              label: vData.label,
              productId: product.id,
            },
          });
        }

        // Add Retail price log entry
        const effectiveDate = vData.recentChange
          ? new Date()
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        await prisma.price.create({
          data: {
            variantId: variant.id,
            type: "RETAIL",
            amount: vData.retail,
            effectiveFrom: effectiveDate,
          },
        });

        // Add Wholesale price log entry
        await prisma.price.create({
          data: {
            variantId: variant.id,
            type: "WHOLESALE",
            amount: vData.wholesale,
            effectiveFrom: effectiveDate,
          },
        });
      }
    }
  }

  // Seed Default Admin User for Better Auth
  const adminEmail = "admin@store.com";
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingUser) {
    const adminUser = await prisma.user.create({
      data: {
        id: "admin-user-id-001",
        name: "Store Admin",
        email: adminEmail,
        emailVerified: true,
      },
    });

    // Create password credential in Account table (Better-Auth format)
    // For demo/dev purposes, better-auth email/password uses standard hashed passwords,
    // or you can log in / sign up directly in the UI.
    console.log(`Created admin user: ${adminUser.email}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
