"use client";

import React, { useRef } from "react";
import { Trash2, Download, RotateCcw, X } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { CartItem } from "./types";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
}

export default function CartModal({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
}: CartModalProps) {
  const cartRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalCartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalCartAmount = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  );

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    let text = `🛒 *New Growsary Order*\n\n`;
    cart.forEach((item) => {
      text += `• ${item.name} (${item.variantLabel}) x${item.qty} - ₱${(
        item.unitPrice * item.qty
      ).toFixed(2)}\n`;
    });
    text += `\n*Total Amount:* ₱${totalCartAmount.toFixed(2)}`;

    navigator.clipboard.writeText(text);
    toast.success("Order details copied! Opening Messenger...");
    window.open("https://m.me/your-store-page", "_blank");
  };

  const handleExportCartImage = async () => {
    if (!cartRef.current) return;
    try {
      const dataUrl = await toPng(cartRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = `growsary-cart-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Cart saved as PNG image!");
    } catch (err) {
      console.error("Failed to generate image", err);
      toast.error("Could not export cart image.");
    }
  };

  return (
    <div className="overlay cart-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal relative" style={{ maxWidth: "480px", width: "100%" }}>
        {/* Close Button Top Right of Drawer/Modal Overlay */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button
            onClick={onClose}
            title="Close cart"
            aria-label="Close"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <X width="18" height="18" />
          </button>
        </div>

        <div ref={cartRef} style={{ background: "var(--paper)", padding: "16px", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>My Cart</h3>
              {cart.length > 0 && (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", fontFamily: "monospace" }}>
                  ({totalCartCount} item(s))
                </span>
              )}
            </div>
          </div>
          <div className="sub" style={{ marginBottom: "16px" }}>
            Review your items, then send your order to us on Messenger or save your cart image.
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              Your cart is empty — tap the + next to any item to add it.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="cart-line">
                <div className="cl-info">
                  <div className="cl-name">{item.name}</div>
                  <div className="cl-variant">
                    {item.variantLabel} · ₱{item.unitPrice.toFixed(2)} each
                  </div>
                </div>

                <div className="qty-stepper">
                  <button onClick={() => onUpdateQty(item.key, -1)}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => onUpdateQty(item.key, 1)}>+</button>
                </div>

                <div className="cl-price mono">
                  ₱{(item.unitPrice * item.qty).toFixed(2)}
                </div>

                <button
                  className="cart-del"
                  title="Remove"
                  onClick={() => onRemoveItem(item.key)}
                >
                  <Trash2 width="12" height="12" />
                </button>
              </div>
            ))
          )}

          {cart.length > 0 && (
            <div className="cart-total-row">
              <span>Total</span>
              <span className="amt">₱{totalCartAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <button className="place-order-btn" onClick={handlePlaceOrder} style={{ marginBottom: "8px" }}>
              Place order via Messenger
            </button>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={handleExportCartImage}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "var(--teal-soft)",
                  color: "var(--teal)",
                  border: "1px solid var(--teal-soft)",
                  borderRadius: "9px",
                  padding: "9px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Download width="14" height="14" />
                Save as Image
              </button>
              <button
                type="button"
                onClick={onClearCart}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "var(--red-soft)",
                  color: "var(--red)",
                  border: "1px solid var(--red-soft)",
                  borderRadius: "9px",
                  padding: "9px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <RotateCcw width="14" height="14" />
                Reset Cart
              </button>
            </div>
            <div className="cart-note">
              Cart is saved automatically to your device. You can reset it anytime using the Reset Cart button above.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
