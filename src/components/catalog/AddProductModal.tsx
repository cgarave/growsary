"use client";

import React, { useState } from "react";
import { Camera } from "lucide-react";
import { CatalogCategory, CatalogProduct, createProductAction } from "@/app/actions";
import { toast } from "sonner";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CatalogCategory[];
  onOpenScanner: () => void;
  onProductCreated: (newProduct: CatalogProduct, newCategoryName?: string) => void;
  onProductUpdated: (updatedProduct: CatalogProduct) => void;
}

export default function AddProductModal({
  isOpen,
  onClose,
  categories,
  onOpenScanner,
  onProductCreated,
  onProductUpdated,
}: AddProductModalProps) {
  const [newProdName, setNewProdName] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdCategory, setNewProdCategory] = useState(categories[0]?.name || "Softdrinks");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdVariants, setNewProdVariants] = useState<
    Array<{ label: string; retailPrice: string; wholesalePrice: string }>
  >([{ label: "Standard", retailPrice: "", wholesalePrice: "" }]);

  if (!isOpen) return null;

  const handleAddVariant = () => {
    setNewProdVariants((prev) => [
      ...prev,
      { label: "", retailPrice: "", wholesalePrice: "" },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setNewProdVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalCategory = newProdCategory;
    if (isAddingCustomCategory && customCategoryName.trim()) {
      finalCategory = customCategoryName.trim();
    }

    const validVariants = newProdVariants.map((v) => ({
      label: v.label.trim() || "Standard",
      retailPrice: parseFloat(v.retailPrice) || 0,
      wholesalePrice: parseFloat(v.wholesalePrice) || 0,
    }));

    // 1. INSTANT OPTIMISTIC LOCAL UPDATE (Closes modal immediately, non-blocking)
    const tempId = `temp-prod-${Date.now()}`;
    const tempProd: CatalogProduct = {
      id: tempId,
      name: newProdName,
      brand: newProdBrand || null,
      barcode: newProdBarcode || null,
      imageUrl: newProdImageUrl || null,
      isOutOfStock: false,
      categoryId: `cat-temp`,
      categoryName: finalCategory,
      hasRecentPriceChange: true,
      variants: validVariants.map((v, idx) => ({
        id: `v-new-${Date.now()}-${idx}`,
        label: v.label,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice,
        recentChange: true,
      })),
    };

    toast.success(`Created product "${newProdName}"!`);
    onProductCreated(tempProd, isAddingCustomCategory ? finalCategory : undefined);
    onClose();

    // Reset form fields immediately
    const nameToSave = newProdName;
    const brandToSave = newProdBrand;
    const barcodeToSave = newProdBarcode;
    const imageToSave = newProdImageUrl;

    setNewProdName("");
    setNewProdBrand("");
    setIsAddingCustomCategory(false);
    setCustomCategoryName("");
    setNewProdImageUrl("");
    setNewProdBarcode("");
    setNewProdVariants([{ label: "Standard", retailPrice: "", wholesalePrice: "" }]);

    // 2. BACKGROUND SERVER CALL
    try {
      const created = await createProductAction({
        name: nameToSave,
        brand: brandToSave || undefined,
        categoryName: finalCategory,
        imageUrl: imageToSave || undefined,
        barcode: barcodeToSave || undefined,
        variants: validVariants,
      });

      // Update local state with official DB id
      onProductUpdated({
        ...tempProd,
        id: created.id,
        categoryId: created.categoryId,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save product in database");
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Add new item</h3>
        <div className="sub">Variants and prices can be added right after you save the base product.</div>
        <form onSubmit={handleCreateProduct}>
          <div className="modal-scroll-content">
            <div className="field">
              <label>Product name</label>
              <input
                type="text"
                required
                placeholder="e.g. Coca-Cola"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
              />
            </div>

            {/* Merged Brand & Category Row */}
            <div style={{ display: "flex", gap: "10px" }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Coca-Cola Co."
                  value={newProdBrand}
                  onChange={(e) => setNewProdBrand(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <label style={{ margin: 0 }}>Category</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCategory((prev) => !prev)}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--teal)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {isAddingCustomCategory ? "← Select existing" : "+ Add new category"}
                  </button>
                </div>
                {isAddingCustomCategory ? (
                  <input
                    type="text"
                    required
                    placeholder="New category name"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                  />
                ) : (
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="field">
              <label>
                Image URL <span className="optional-tag">— optional image link</span>
              </label>
              <input
                type="url"
                placeholder="e.g. https://images.unsplash.com/photo-..."
                value={newProdImageUrl}
                onChange={(e) => setNewProdImageUrl(e.target.value)}
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
                  value={newProdBarcode}
                  onChange={(e) => setNewProdBarcode(e.target.value)}
                />
                <div
                  className="scan-inline"
                  onClick={onOpenScanner}
                >
                  <Camera width="16" height="16" />
                </div>
              </div>
            </div>

            {/* Multi-Variant Section */}
            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ margin: 0 }}>Product Variants & Pricing</label>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--teal)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + Add variant
                </button>
              </div>

              {newProdVariants.map((v, i) => (
                <div
                  key={i}
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
                      placeholder="Variant label (e.g. 1.5L Bottle, 250g)"
                      required
                      value={v.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewProdVariants((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, label: val } : item))
                        );
                      }}
                      style={{ flex: 1 }}
                    />
                    {newProdVariants.length > 1 && (
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
                          setNewProdVariants((prev) =>
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
                          setNewProdVariants((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, wholesalePrice: val } : item))
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save">
              Save & continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
