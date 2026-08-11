"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button"

import { CatalogCategory } from "@/app/actions";

interface CategoryFilterBarProps {
  categories: CatalogCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryName: string) => void;
  isAdmin: boolean;
  onDeleteCategory: (category: CatalogCategory) => void;
}

export default function CategoryFilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
  isAdmin,
  onDeleteCategory,
}: CategoryFilterBarProps) {
  return (
    <div className="flex flex-row gap-x-2 p-4 overflow-x-scroll">
      <div
        className={`chip ${selectedCategory === "All" ? "active" : ""}`}
        onClick={() => onSelectCategory("All")}
      >
        All
      </div>
      {categories.map((c) => (
        <div
          key={c.id}
          className={`chip ${selectedCategory === c.name ? "active" : ""}`}
          onClick={() => onSelectCategory(c.name)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span>{c.name}</span>
          {isAdmin && (
            <button
              type="button"
              title={`Delete category "${c.name}"`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCategory(c);
              }}
              style={{
                background: "none",
                border: "none",
                padding: "2px",
                margin: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: selectedCategory === c.name ? "var(--paper)" : "var(--muted)",
                opacity: 0.8,
              }}
            >
              <X width="12" height="12" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
