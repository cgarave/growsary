"use client";

import React from "react";
import { Search, Camera, ShoppingBag, Plus } from "lucide-react";
import AdminAiChatbot from "@/components/AdminAiChatbot";
import { PriceMode } from "./types";

interface CatalogHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAdmin: boolean;
  onOpenAddProduct: () => void;
  onOpenScanner: () => void;
  onOpenCart: () => void;
  totalCartCount: number;
  priceMode: PriceMode;
  onTogglePriceMode: (mode: PriceMode) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  categories: string[];
}

export default function CatalogHeader({
  searchQuery,
  onSearchChange,
  isAdmin,
  onOpenAddProduct,
  onOpenScanner,
  onOpenCart,
  totalCartCount,
  priceMode,
  onTogglePriceMode,
  onOpenLogin,
  onLogout,
  categories,
}: CatalogHeaderProps) {
  return (
    <header>
      <div className="top-row">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <h1>Growsary</h1>
            <span>quick lookup for the shop floor</span>
          </div>
        </div>

        <div className="search">
          <Search width="15" height="15" />
          <input
            type="text"
            placeholder="Search product or variant…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Inline Admin Action Bar */}
        {isAdmin && (
          <div className="admin-actions-bar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="add-item-btn"
              onClick={onOpenAddProduct}
              style={{
                padding: "8px 14px",
                borderRadius: "9px",
                background: "var(--teal)",
                color: "#ffffff",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Plus width="15" height="15" />
              Add item
            </button>
            <AdminAiChatbot existingCategories={categories} />
          </div>
        )}

        <div
          className="icon-btn"
          title="Scan barcode"
          onClick={onOpenScanner}
        >
          <Camera width="17" height="17" />
        </div>

        <div
          className="icon-btn"
          title="My cart"
          onClick={onOpenCart}
        >
          <ShoppingBag width="17" height="17" />
          {totalCartCount > 0 && (
            <span className="cart-count">{totalCartCount}</span>
          )}
        </div>

        <div className={`price-toggle ${priceMode}`} id="priceToggle">
          <div className="knob"></div>
          <button onClick={() => onTogglePriceMode("retail")}>Retail</button>
          <button onClick={() => onTogglePriceMode("wholesale")}>Wholesale</button>
        </div>

        <div className="admin-zone">
          {isAdmin && (
            <span className="admin-badge">
              <span className="dot"></span> Admin
            </span>
          )}
          <button
            className={`admin-btn ${isAdmin ? "is-logged-in" : ""}`}
            onClick={() => (isAdmin ? onLogout() : onOpenLogin())}
          >
            {isAdmin ? "Log out" : "Admin Login"}
          </button>
        </div>
      </div>
    </header>
  );
}
