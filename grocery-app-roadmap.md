# Grocery Store Web App — Rebuild Roadmap

## Goals

The current app solves basic product/price listing. This rebuild targets three core pain points directly:

1. **Prices are hard to memorize** — retail and wholesale prices change often and need to be looked up fast, at the counter, in front of a customer.
2. **Products have multiple variants** — sizes, packs, and flavors of the same item need a data model that doesn't duplicate the whole product per variant.
3. **Products belong to groups** — softdrinks, snacks, biscuits, etc. need real category structure, not just tags.

Beyond that, the app expands into two new directions: a **public-facing catalog** customers can browse and order from via Messenger, and a proper **admin system** protected by real authentication.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server components for the public catalog, client components for admin interactivity |
| UI | Tailwind CSS + shadcn/ui | Matches the mockup direction already built |
| Icons | lucide-react | Already shadcn's default icon set |
| Database | PostgreSQL | Managed via Neon, Supabase, or Railway |
| ORM | Prisma | Schema-first, migrations, type-safe queries |
| Auth | **better-auth** | Email/password for admin accounts, session-based, protects `/admin` routes via middleware |
| Forms & validation | react-hook-form + zod | Pairs with shadcn form components; zod schemas double as Prisma input validators |
| Data fetching | TanStack Query (client) + Server Actions (mutations) | Avoids over-fetching on the public catalog; keeps admin writes simple |
| Barcode scanning | `@zxing/browser` | Runs in any modern mobile browser, no native app needed |
| Cart persistence | Browser `localStorage` | No backend table — cart is ephemeral and guest-only |
| Order handoff | `m.me` deep link (`?text=` param) | No Messenger Platform API needed for MVP |
| Image storage | Vercel Blob or Cloudinary (optional) | Only needed once products start getting real photos |
| Hosting | Vercel | Native Next.js support, easy Postgres integration |

**Phase 5 addition (optional):** Claude API (vision) for photo-based fallback search on barcode-less items.

---

## Core Data Model (established in Phase 1)

```prisma
model Category {
  id       String    @id @default(cuid())
  name     String    @unique
  products Product[]
}

model Product {
  id         String           @id @default(cuid())
  name       String
  brand      String?
  barcode    String?          @unique   // one per product, optional
  imageUrl   String?                    // optional — falls back to category emoji
  categoryId String
  category   Category         @relation(fields: [categoryId], references: [id])
  variants   ProductVariant[]
  isOutOfStock Boolean        @default(false)
  createdAt  DateTime         @default(now())
}

model ProductVariant {
  id        String   @id @default(cuid())
  label     String                    // e.g. "1.5L Bottle"
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  prices    Price[]
}

model Price {
  id            String       @id @default(cuid())
  variantId     String
  variant       ProductVariant @relation(fields: [variantId], references: [id])
  type          PriceType    // RETAIL | WHOLESALE
  amount        Decimal
  effectiveFrom DateTime     @default(now())
}

enum PriceType {
  RETAIL
  WHOLESALE
}

model AdminUser {
  id       String @id @default(cuid())
  email    String @unique
  // remaining fields managed by better-auth
}
```

Prices are stored as an append-only log rather than a column on the variant. This gives full price history for free — useful for spotting margin erosion and for the "price changed recently" badge in the UI.

---

## Phase 1 — Foundation & Core Catalog

**Goal:** replace the old app's core function (browse products, see prices) on the new stack, plus give the owner a working way to manage data.

- Project scaffold: Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + Postgres
- Prisma schema above, migrated and seeded with real product data
- **better-auth** wired up: single admin account, email/password login, session cookies, `/admin` routes protected by middleware
- Admin CRUD (functional, not polished): create/edit/delete Product, ProductVariant, and Price entries
- Public product grid: card layout, category sections, retail/wholesale toggle, search
- Deploy to Vercel with a managed Postgres instance

**Ships:** the owner can manage prices and products; customers can browse current prices online. This alone fixes the "hard to memorize prices" problem.

---

## Phase 2 — UX Polish & Store Operations

**Goal:** bring the live app up to the fidelity of the mockups already built.

- Card redesign: 2-column mobile grid, all variants + prices visible at once (no click-to-reveal)
- Category filter chips wired to real data
- Search across product name + variant label
- "Price changed recently" badge, computed from the `Price` log (`effectiveFrom` within last N days)
- **Out-of-stock toggle** on admin cards; grays out the card and shows "Unavailable" to customers
- Delete confirmation, edit forms, and toasts (no native browser dialogs — build them as in-app modals, since some environments block `alert`/`confirm`/`prompt`)
- Admin login UI polish: proper error states, session persistence, logout

**Ships:** full parity with the approved mockups, live and functional.

---

## Phase 3 — Barcode Scanning & Ordering Flow

**Goal:** speed up both admin data entry and the customer path from "found it" to "ordered it."

- Barcode field on `Product` (optional, unique) — one barcode per product line, not per variant
- Camera-based barcode scan (`@zxing/browser`) in two places: the search bar (jump straight to a product) and the Add Item form (auto-fill the barcode field)
- Customer cart: `localStorage`-backed, no accounts needed
- "Add to cart" flow: single button per card opens a variant picker modal with a **−/+ counter per variant** and one confirm action
- Cart page: line items, qty steppers, delete per line, running total
- **Place Order**: builds a templated message from the cart, opens `m.me/YourPage?text=...`, clears the cart on success

**Ships:** a customer can browse, scan, add to cart, and send an order to your Messenger — with zero backend order storage needed.

---

## Phase 4 — Admin Power Tools

**Goal:** tools that scale the price-management pain point beyond one-item-at-a-time edits.

- Bulk price update: select multiple variants or a whole category, adjust by % or fixed amount in one action (e.g., supplier raises wholesale prices across a product line)
- Price history view per variant, pulled straight from the `Price` log
- Margin calculator: retail vs. wholesale % shown per variant, flagging thin-margin items
- Price-change broadcast: generate a ready-to-post caption (and optionally an image) summarizing recent price changes, for manual posting to your Facebook Page

**Ships:** the owner can manage pricing at the category/supplier level instead of item-by-item, and keep the FB Page in sync with the catalog.

---

## Phase 5 — Fallback Intelligence & Scale (optional / later)

**Goal:** nice-to-haves once the core system is stable and in daily use.

- Photo-based fallback search (Claude vision API) for items without a barcode yet — secondary path only, not a replacement for scanning
- Per-variant out-of-stock granularity, if whole-product toggling turns out to be too coarse in practice
- Lightweight anonymous analytics: most-viewed / most-carted items, to inform what to keep in stock
- PWA / offline caching for the admin view, useful if the shop's wifi is unreliable during scanning

---

## Sequencing Notes

- **Auth (better-auth) is in Phase 1**, not later — every admin feature after that depends on protected routes existing first.
- **Cart and Messenger ordering wait until Phase 3** because they depend on the catalog and variant model being stable; building ordering on top of a shifting data model would mean rework.
- **Bulk tools and broadcast are Phase 4**, after the single-item admin flows have been used for a while — real usage will surface which bulk operations actually save time, rather than guessing upfront.
- **Phase 5 is explicitly optional** — nothing in Phases 1–4 depends on it, and it can be reprioritized or dropped based on how the app is actually used day to day.
