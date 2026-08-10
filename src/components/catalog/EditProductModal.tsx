"use client";

import React, { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { CatalogCategory, CatalogProduct, updateProductAction } from "@/app/actions";
import { toast } from "sonner";

interface EditProductModalProps {
  product: CatalogProduct | null;
  isOpen: boolean;
  onClose: () => void;
  categories: CatalogCategory[];
  onOpenScanner: () => void;
  onProductUpdated: (updatedProduct: CatalogProduct) => void;
}

export default function EditProductModal({
  product,
  isOpen,
  onClose,
  categories,
  onOpenScanner,
  onProductUpdated,
}: EditProductModalProps) {
  const [editProdName, setEditProdName] = useState("");
  const [editProdBrand, setEditProdBrand] = useState("");
  const [editProdCategory, setEditProdCategory] = useState("Softdrinks");
  const [editProdBarcode, setEditProdBarcode] = useState("");
  const [editProdImageUrl, setEditProdImageUrl] = useState("");
  const [editVariants, setEditVariants] = useState<
    Array<{ id?: string; label: string; retailPrice: string; wholesalePrice: string }>
  >([]);

  useEffect(() => {
    if (product) {
      setEditProdName(product.name);
      setEditProdBrand(product.brand || "");
      setEditProdCategory(product.categoryName);
      setEditProdBarcode(product.barcode || "");
      setEditProdImageUrl(product.imageUrl || "");
      setEditVariants(
        product.variants.map((v) => ({
          id: v.id,
          label: v.label,
          retailPrice: v.retailPrice.toString(),
          wholesalePrice: v.wholesalePrice.toString(),
        }))
      );
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handleAddVariant = () => {
    setEditVariants((prev) => [
      ...prev,
      { label: "", retailPrice: "", wholesalePrice: "" },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setEditVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetId = product.id;
    const name = editProdName;
    const brand = editProdBrand;
    const barcode = editProdBarcode;
    const imageUrl = editProdImageUrl;
    const categoryName = editProdCategory;

    const validVariants = editVariants.map((v) => ({
      id: v.id,
      label: v.label.trim() || "Standard",
      retailPrice: parseFloat(v.retailPrice) || 0,
      wholesalePrice: parseFloat(v.wholesalePrice) || 0,
    }));

    // Optimistic update
    const updatedProd: CatalogProduct = {
      ...product,
      name,
      brand: brand || null,
      barcode: barcode || null,
      imageUrl: imageUrl || null,
      categoryName,
      variants: validVariants.map((v, idx) => ({
        id: v.id || `v-temp-${Date.now()}-${idx}`,
        label: v.label,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice,
        recentChange: true,
      })),
    };

    onProductUpdated(updatedProd);
    toast.success(`Updated "${name}"!`);
    onClose();

    try {
      await updateProductAction({
        id: targetId,
        name,
        brand: brand || undefined,
        categoryName,
        imageUrl: imageUrl || undefined,
        barcode: barcode || undefined,
        variants: validVariants,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to update product in database");
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Edit item</h3>
        <div className="sub">Update product details, sizes, and pricing.</div>
        <form onSubmit={handleUpdateProduct}>
          <div className="field">
            <label>Product name</label>
            <input
              type="text"
              required
              value={editProdName}
              onChange={(e) => setEditProdName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Brand</label>
            <input
              type="text"
              value={editProdBrand}
              onChange={(e) => setEditProdBrand(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Category</label>
            <select
              value={editProdCategory}
              onChange={(e) => setEditProdCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Image URL <span className="optional-tag">— optional image link</span>
            </label>
            <input
              type="url"
              placeholder="e.g. https://images.unsplash.com/photo-..."
              value={editProdImageUrl}
              onChange={(e) => setEditProdImageUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Barcode <span className="optional-tag">— optional, one per product</span>
            </label>
            <div className="barcode-row">
              <input
                type="text"
                placeholder="Leave blank if none"
                value={editProdBarcode}
                onChange={(e) => setEditProdBarcode(e.target.value)}
              />
              <div
                className="scan-inline"
                onClick={onOpenScanner}
              >
                <Camera width="16" height="16" />
              </div>
            </div>
          </div>

          {/* Variants Section */}
          <div className="field" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ margin: 0 }}>Variants & Prices</label>
              <button
                type="button"
                onClick={handleAddVariant}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  cursor: "pointer",
                }}
              >
                + Add Variant
              </button>
            </div>

            {editVariants.map((v, i) => (
              <div
                key={v.id || i}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: "9px",
                  padding: "10px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Variant label (e.g. 1.5L Bottle)"
                    required
                    value={v.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditVariants((prev) =>
                        prev.map((item, idx) => (idx === i ? { ...item, label: val } : item))
                      );
                    }}
                    style={{ flex: 1 }}
                  />
                  {editVariants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(i)}
                      style={{
                        background: "var(--red-soft)",
                        color: "var(--red)",
                        border: "1px solid var(--red-soft)",
                        borderRadius: "6px",
                        padding: "6px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "2px" }}>
                      Retail (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={v.retailPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVariants((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, retailPrice: val } : item))
                        );
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "2px" }}>
                      Wholesale (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={v.wholesalePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVariants((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, wholesalePrice: val } : item))
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
