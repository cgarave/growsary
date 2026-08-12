"use client";

import React from "react";
import { ShoppingBag, History } from "lucide-react";
import { CatalogProduct, VariantPrice } from "@/app/actions";
import { PriceMode, CATEGORY_EMOJIS } from "./types";

interface ProductCardProps {
  product: CatalogProduct;
  categoryName: string;
  priceMode: PriceMode;
  isAdmin: boolean;
  onOpenVariantModal: (product: CatalogProduct) => void;
  onToggleStock: (product: CatalogProduct) => void;
  onOpenEdit: (product: CatalogProduct) => void;
  onDeleteProduct: (product: CatalogProduct) => void;
  onOpenPriceHistory: (productName: string, variant: VariantPrice) => void;
}

export default function ProductCard({
  product,
  categoryName,
  priceMode,
  isAdmin,
  onOpenVariantModal,
  onToggleStock,
  onOpenEdit,
  onDeleteProduct,
  onOpenPriceHistory,
}: ProductCardProps) {
  const p = product;

  return (
    <div className={`card ${p.isOutOfStock ? "out-of-stock" : ""}`}>
      <div className="thumb">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          CATEGORY_EMOJIS[categoryName] || "🥤"
        )}
        {p.isOutOfStock && <div className="oos-badge">Unavailable</div>}
        {p.variants.some((v) => !!v.barcode) && <div className="barcode-badge">barcode ✓</div>}
      </div>

      <div>
        <div className="name">{p.name}</div>
        <div className="brand-line">{p.brand || "Standard"}</div>
      </div>

      <div className="variant-list">
        <div className="mode-tag">{priceMode} price</div>
        {p.variants.map((v) => (
          <div key={v.id} className="variant-row">
            <span className="lbl">{v.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className={`amt ${priceMode}-mode mono`}>
                ₱
                {(priceMode === "retail"
                  ? v.retailPrice
                  : v.wholesalePrice
                ).toFixed(2)}
              </span>
              <button
                type="button"
                title="View Price History"
                onClick={() => onOpenPriceHistory(p.name, v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <History width="13" height="13" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-y-2 mt-auto">
        {!isAdmin && (
          <button
            className="card-add-btn"
            onClick={() => onOpenVariantModal(p)}
          >
            <ShoppingBag width="14" height="14" />
            Add to cart
          </button>
        )}
        {isAdmin && (
          <div className="admin-controls">
            <button
              className="stock-btn"
              onClick={() => onToggleStock(p)}
            >
              {p.isOutOfStock ? "Mark in stock" : "Mark out of stock"}
            </button>
            <div className="admin-row">
              <button
                className="edit"
                onClick={() => onOpenEdit(p)}
              >
                Edit
              </button>
              <button
                className="del"
                onClick={() => onDeleteProduct(p)}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
