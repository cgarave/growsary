"use client";

import React from "react";
import { CatalogProduct, VariantPrice } from "@/app/actions";
import ProductCard from "./ProductCard";
import { PriceMode } from "./types";

interface ProductGridProps {
  groupedByCategory: Record<string, CatalogProduct[]>;
  priceMode: PriceMode;
  isAdmin: boolean;
  onOpenVariantModal: (product: CatalogProduct) => void;
  onToggleStock: (product: CatalogProduct) => void;
  onOpenEdit: (product: CatalogProduct) => void;
  onDeleteProduct: (product: CatalogProduct) => void;
  onOpenPriceHistory: (productName: string, variant: VariantPrice) => void;
}

export default function ProductGrid({
  groupedByCategory,
  priceMode,
  isAdmin,
  onOpenVariantModal,
  onToggleStock,
  onOpenEdit,
  onDeleteProduct,
  onOpenPriceHistory,
}: ProductGridProps) {
  const categoryEntries = Object.entries(groupedByCategory);

  if (categoryEntries.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--muted)]">
        No products match your current search or category filter.
      </div>
    );
  }

  return (
    <>
      {categoryEntries.map(([catName, catProducts]) => (
        <React.Fragment key={catName}>
          <div className="section-label">
            <h2>{catName}</h2>
            <span className="count">{catProducts.length} items</span>
          </div>

          <div className="grid">
            {catProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categoryName={catName}
                priceMode={priceMode}
                isAdmin={isAdmin}
                onOpenVariantModal={onOpenVariantModal}
                onToggleStock={onToggleStock}
                onOpenEdit={onOpenEdit}
                onDeleteProduct={onDeleteProduct}
                onOpenPriceHistory={onOpenPriceHistory}
              />
            ))}
          </div>
        </React.Fragment>
      ))}
    </>
  );
}
