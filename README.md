# Growsary — Store Price Board & Ordering System

**Growsary** is a modern, high-performance web application designed for small grocery stores and neighborhood shops (*Sari-sari stores*). It acts as a digital price board for shop floors, enabling store owners to manage price changes (retail vs. wholesale) and allowing customers to browse live catalog prices, scan item barcodes, and place orders directly via Facebook Messenger.

---

## Features

### Customer Experience
- **1:1 Native Mockup UI**: Modern, responsive interface with category chips, dual-knob retail/wholesale price toggling, and clean visual indicators.
- **Camera Barcode Lookup**: Built-in camera scanner (`@zxing/browser`) in the search bar. Scanning any 1D/2D product barcode immediately filters the catalog and opens its variant selection modal.
- **Direct Facebook Messenger Ordering**: Pre-fills an order list from the customer's cart (with item descriptions, variants, quantities, and totals) and hands off directly to Facebook Messenger (`m.me`).
- **Public Price History Timeline**: Customers can view historical price change logs per variant over time.

### Store Operations & Admin Tools
- **Authentication**: Powered by **Better-Auth** with secure admin login.
- **Product & Variant Management**: Add, edit, or delete product lines and dynamic size/pack variants (e.g. 500ml, 1.5L, Case of 12).
- **In-App Out-of-Stock Toggle**: Mark items as unavailable with one click, greying out product cards for customers in real time.
- **Barcode Data Entry**: Fast barcode capture using the camera directly inside the Add/Edit product modals.
- **Margin Calculator & Profit Logs**: Automatic profit margin percentage calculations ($\frac{\text{Retail} - \text{Wholesale}}{\text{Wholesale}} \times 100$) and complete price audit history.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Next.js 16.3](https://nextjs.org/) (App Router, Turbopack)
- **Database & ORM**: [Supabase PostgreSQL](https://supabase.com/) & [Prisma ORM 5.22](https://www.prisma.io/)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **Caching & Performance**: 24-Hour Static Generation with On-Demand Tag Revalidation (`revalidateTag("catalog")`)
- **Barcode Scanning**: `@zxing/browser` (1D/2D EAN-13, UPC, Code 128)
- **Styling & UI**: Custom CSS Design Tokens, Lucide Icons, Sonner Toasts

---

## 📄 License
MIT License
