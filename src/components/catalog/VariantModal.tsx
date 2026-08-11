"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { CatalogProduct } from "@/app/actions";
import { PriceMode, CATEGORY_EMOJIS, CartItem } from "./types";

interface VariantModalProps {
  product: CatalogProduct | null;
  isOpen: boolean;
  onClose: () => void;
  priceMode: PriceMode;
  cart: CartItem[];
  onConfirmAddVariants: (updatedCart: CartItem[], productName: string) => void;
}

export default function VariantModal({
  product,
  isOpen,
  onClose,
  priceMode,
  cart,
  onConfirmAddVariants,
}: VariantModalProps) {
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (product) {
      const initialQtys: Record<string, number> = {};
      product.variants.forEach((v) => {
        const existing = cart.find(
          (c) => c.productId === product.id && c.variantId === v.id
        );
        initialQtys[v.id] = existing ? existing.qty : 0;
      });
      setVariantQtys(initialQtys);
    }
  }, [product, cart]);

  if (!isOpen || !product) return null;

  const stepVariantQty = (vId: string, delta: number) => {
    setVariantQtys((prev) => {
      const curr = prev[vId] || 0;
      const next = Math.max(0, curr + delta);
      return { ...prev, [vId]: next };
    });
  };

  const handleConfirm = () => {
    let updatedCart = [...cart];

    product.variants.forEach((v) => {
      const qty = variantQtys[v.id] || 0;
      const key = `${product.id}-${v.id}`;
      const price = priceMode === "retail" ? v.retailPrice : v.wholesalePrice;

      if (qty > 0) {
        const existingIdx = updatedCart.findIndex((c) => c.key === key);
        if (existingIdx >= 0) {
          updatedCart[existingIdx].qty = qty;
          updatedCart[existingIdx].unitPrice = price;
        } else {
          updatedCart.push({
            key,
            productId: product.id,
            variantId: v.id,
            name: product.name,
            brand: product.brand,
            variantLabel: v.label,
            unitPrice: price,
            qty,
          });
        }
      } else {
        updatedCart = updatedCart.filter((c) => c.key !== key);
      }
    });

    onConfirmAddVariants(updatedCart, product.name);
    onClose();
  };

  const totalSelectedCount = Object.values(variantQtys).reduce((a, b) => a + b, 0);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal relative">
        <button
          onClick={onClose}
          className="modal-close-btn"
          title="Close modal"
          aria-label="Close"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X width="18" height="18" />
        </button>
        <div className="vm-header" style={{ paddingRight: "32px" }}>
          <div className="vm-thumb">
            {CATEGORY_EMOJIS[product.categoryName] || "🥤"}
          </div>
          <div>
            <h3 style={{ marginBottom: "1px" }}>{product.name}</h3>
            <div className="sub" style={{ marginBottom: 0 }}>
              {product.brand || "Standard Line"}
            </div>
          </div>
        </div>

        <div>
          {product.variants.map((v) => {
            const price = priceMode === "retail" ? v.retailPrice : v.wholesalePrice;
            const qty = variantQtys[v.id] || 0;
            return (
              <div key={v.id} className="vm-line">
                <div className="vm-info">
                  <div className="vm-label">{v.label}</div>
                  <div className={`vm-price ${priceMode}-mode`}>
                    ₱{price.toFixed(2)}
                  </div>
                </div>
                <div className="vm-stepper">
                  <button onClick={() => stepVariantQty(v.id, -1)} disabled={qty === 0}>
                    −
                  </button>
                  <span>{qty}</span>
                  <button onClick={() => stepVariantQty(v.id, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="vm-summary">
          <span>Selected</span>
          <span className="amt">
            ₱
            {product.variants
              .reduce((sum, v) => {
                const price = priceMode === "retail" ? v.retailPrice : v.wholesalePrice;
                return sum + price * (variantQtys[v.id] || 0);
              }, 0)
              .toFixed(2)}
          </span>
        </div>

        <button
          className="confirm-add-btn"
          disabled={totalSelectedCount === 0}
          onClick={handleConfirm}
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
