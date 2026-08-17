"use client";

import React, { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { toast, Toaster } from "sonner";
import {
  CatalogCategory,
  CatalogProduct,
  VariantPrice,
  getCatalogData,
  deleteProductAction,
  deleteCategoryAction,
  toggleProductStockAction,
} from "./actions";

import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import PriceHistoryModal from "@/components/PriceHistoryModal";

import { CartItem, PriceMode } from "@/components/catalog/types";
import CatalogHeader from "@/components/catalog/CatalogHeader";
import CategoryFilterBar from "@/components/catalog/CategoryFilterBar";
import ProductGrid from "@/components/catalog/ProductGrid";
import AdminAuthModal from "@/components/catalog/AdminAuthModal";
import AddProductModal from "@/components/catalog/AddProductModal";
import EditProductModal from "@/components/catalog/EditProductModal";
import DeleteConfirmModal from "@/components/catalog/DeleteConfirmModal";
import VariantModal from "@/components/catalog/VariantModal";
import CartModal from "@/components/catalog/CartModal";
import { supabase } from "@/lib/supabase-client";
import {
  loadCachedCatalog,
  saveCachedCatalog,
  CATALOG_STORAGE_KEY,
  CATALOG_SYNC_EVENT,
  CachedCatalogData,
} from "@/lib/catalog-storage";

interface CatalogViewProps {
  initialCategories: CatalogCategory[];
  initialProducts: CatalogProduct[];
}

export default function CatalogView({
  initialCategories,
  initialProducts,
}: CatalogViewProps) {
  const { data: session } = authClient.useSession();
  const [isAdminState, setIsAdminState] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAdmin = localStorage.getItem("growsary_admin_logged_in");
      if (savedAdmin === "true") {
        setIsAdminState(true);
      }
    }
  }, []);

  const isAdmin = !isLoggedOut && (!!session?.user || isAdminState);

  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [categories, setCategories] = useState<CatalogCategory[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priceMode, setPriceMode] = useState<PriceMode>("retail");

  // Scanner & Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "add" | "edit">("search");
  const [activeScanVariantIndex, setActiveScanVariantIndex] = useState<number | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CatalogCategory | null>(null);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<CatalogProduct | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{
    productName: string;
    variant: VariantPrice;
  } | null>(null);

  /**
   * ==============================================================================
   * 1. LOCAL STORAGE CACHE INITIALIZATION (CLIENT HYDRATION)
   * ==============================================================================
   * Hydrates state instantly from browser localStorage if available.
   * If cache is empty, seeds localStorage with the server-rendered initial catalog.
   */
  useEffect(() => {
    const cached = loadCachedCatalog();
    if (cached) {
      setProducts(cached.products);
      setCategories(cached.categories);
    } else {
      saveCachedCatalog(initialProducts, initialCategories);
    }
  }, [initialProducts, initialCategories]);

  /**
   * ==============================================================================
   * 2. CROSS-TAB & SAME-TAB LOCAL STORAGE SYNC
   * ==============================================================================
   * Listens for changes committed across other open browser tabs or windows.
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CATALOG_STORAGE_KEY && e.newValue) {
        try {
          const cached: CachedCatalogData = JSON.parse(e.newValue);
          if (cached && Array.isArray(cached.products) && Array.isArray(cached.categories)) {
            setProducts(cached.products);
            setCategories(cached.categories);
          }
        } catch (err) {
          console.error("Error processing cross-tab catalog sync:", err);
        }
      }
    };

    const handleSameTabSync = (e: Event) => {
      const customEvent = e as CustomEvent<CachedCatalogData | null>;
      if (customEvent.detail) {
        setProducts(customEvent.detail.products);
        setCategories(customEvent.detail.categories);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(CATALOG_SYNC_EVENT, handleSameTabSync);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(CATALOG_SYNC_EVENT, handleSameTabSync);
    };
  }, []);

  /**
   * ==============================================================================
   * 3. NETWORK STATUS MONITORING (OFFLINE-FIRST RESILIENCE)
   * ==============================================================================
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online — syncing catalog");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline. Showing cached catalog.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /**
   * ==============================================================================
   * 4. SUPABASE REALTIME WEBSOCKETS + WINDOW FOCUS SYNC HOOK
   * ==============================================================================
   */
  useEffect(() => {
    let isSubscribed = true;

    // Helper to fetch latest fresh catalog from Supabase via Server Action and sync cache
    const fetchLatestData = async () => {
      // Pause automatic state updates while an admin is actively editing a form in a modal
      if (isAddProductOpen || editTarget) return;

      try {
        const fresh = await getCatalogData();
        if (isSubscribed) {
          setProducts(fresh.products);
          setCategories(fresh.categories);
          saveCachedCatalog(fresh.products, fresh.categories);
        }
      } catch (err) {
        console.error("Failed to sync catalog data:", err);
      }
    };

    // A. SUBSCRIBE TO SUPABASE REALTIME WEBSOCKETS
    const channel = supabase
      .channel("public-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => {
          console.log("⚡ Realtime Supabase Database Change Push Received:", payload);
          fetchLatestData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("🟢 Connected to Supabase Realtime WebSockets channel!");
        }
      });

    // B. LISTEN TO WINDOW FOCUS & TAB VISIBILITY EVENTS
    const handleFocus = () => fetchLatestData();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLatestData();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("visibilitychange", handleVisibility);

    // CLEANUP ON UNMOUNT
    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAddProductOpen, editTarget]);

  // Load saved cart from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedCart = localStorage.getItem("growsary_customer_cart");
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (Array.isArray(parsed)) {
            setCart(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to load cart from localStorage", e);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("growsary_customer_cart", JSON.stringify(cart));
      } catch (e) {
        console.error("Failed to save cart to localStorage", e);
      }
    }
  }, [cart]);

  // Barcode Scanner Handler
  const handleScanSuccess = (code: string) => {
    toast.success(`Scanned Barcode: ${code}`);
    setScannedBarcode(code);

    if (scannerTarget === "search") {
      setSearchQuery(code);
      const matched = products.find((p) => p.variants.some((v) => v.barcode === code));
      if (matched) {
        setSelectedCategory("All");
        if (!matched.isOutOfStock) {
          setSelectedProductForVariant(matched);
        }
      } else {
        toast.info("No item found matching scanned barcode. Opening Add Item modal...");
        setActiveScanVariantIndex(0);
        setIsAddProductOpen(true);
      }
    }
  };

  const handleAdminLogout = async () => {
    try {
      if (session?.user) {
        await authClient.signOut().catch(() => { });
      }
    } catch (err) {
      // Ignore network errors when signing out
    }
    setIsLoggedOut(true);
    setIsAdminState(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("growsary_admin_logged_in");
    }
    toast.info("Logged out from Admin mode");
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminState(true);
    setIsLoggedOut(false);
  };

  /**
   * ==============================================================================
   * PRODUCT CRUD & CACHE INVALIDATION HANDLERS
   * ==============================================================================
   */
  const handleProductCreated = (newProduct: CatalogProduct, newCategoryName?: string) => {
    let nextCategories = categories;
    if (newCategoryName && !categories.some((c) => c.name === newCategoryName)) {
      nextCategories = [
        ...categories,
        {
          id: `cat-${Date.now()}`,
          name: newCategoryName,
          productCount: 1,
        },
      ];
      setCategories(nextCategories);
    }
    const nextProducts = [newProduct, ...products];
    setProducts(nextProducts);
    saveCachedCatalog(nextProducts, nextCategories);
  };

  const handleProductUpdated = (updatedProduct: CatalogProduct) => {
    const nextProducts = products.map((p) =>
      p.id === updatedProduct.id ? updatedProduct : p
    );
    setProducts(nextProducts);
    saveCachedCatalog(nextProducts, categories);
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;

    // 1. INSTANT OPTIMISTIC DELETE & CACHE UPDATE
    const nextProducts = products.filter((p) => p.id !== target.id);
    setProducts(nextProducts);
    saveCachedCatalog(nextProducts, categories);
    setDeleteTarget(null);
    toast.success(`Deleted "${target.name}"`);

    // 2. BACKGROUND SERVER CALL
    try {
      await deleteProductAction(target.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product in database");
      // Rollback on failure
      const rolledBack = [target, ...nextProducts];
      setProducts(rolledBack);
      saveCachedCatalog(rolledBack, categories);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    const target = deleteCategoryTarget;

    // 1. INSTANT OPTIMISTIC DELETE & CACHE UPDATE
    const nextCategories = categories.filter((c) => c.id !== target.id);
    setCategories(nextCategories);
    saveCachedCatalog(products, nextCategories);
    if (selectedCategory === target.name) {
      setSelectedCategory("All");
    }
    setDeleteCategoryTarget(null);
    toast.success(`Deleted category "${target.name}"`);

    // 2. BACKGROUND SERVER CALL
    try {
      await deleteCategoryAction(target.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category in database");
      // Rollback on failure
      const rolledBack = [...nextCategories, target];
      setCategories(rolledBack);
      saveCachedCatalog(products, rolledBack);
    }
  };

  const handleToggleStock = async (product: CatalogProduct) => {
    const nextStatus = !product.isOutOfStock;

    // 1. INSTANT OPTIMISTIC TOGGLE & CACHE UPDATE
    const nextProducts = products.map((p) =>
      p.id === product.id ? { ...p, isOutOfStock: nextStatus } : p
    );
    setProducts(nextProducts);
    saveCachedCatalog(nextProducts, categories);
    toast.info(`"${product.name}" marked as ${nextStatus ? "Out of Stock" : "In Stock"}`);

    // 2. BACKGROUND SERVER CALL
    try {
      await toggleProductStockAction(product.id, product.isOutOfStock);
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock state in database");
      // Rollback on failure
      const rolledBack = products.map((p) =>
        p.id === product.id ? { ...p, isOutOfStock: !nextStatus } : p
      );
      setProducts(rolledBack);
      saveCachedCatalog(rolledBack, categories);
    }
  };

  // Cart operations
  const handleUpdateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key === key) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  };

  const handleClearCart = () => {
    setCart([]);
    toast.info("Cart cleared");
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Filtering Logic
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "All" || p.categoryName === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      p.variants.some(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          (v.barcode && v.barcode.toLowerCase().includes(q))
      );

    return matchesCategory && matchesSearch;
  });

  const groupedByCategory = filteredProducts.reduce((acc, p) => {
    if (!acc[p.categoryName]) acc[p.categoryName] = [];
    acc[p.categoryName].push(p);
    return acc;
  }, {} as Record<string, CatalogProduct[]>);

  return (
    <div>
      <Toaster position="top-center" />

      {/* Header */}
      <CatalogHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isAdmin={isAdmin}
        onOpenAddProduct={() => setIsAddProductOpen(true)}
        onOpenScanner={() => {
          setScannerTarget("search");
          setIsScannerOpen(true);
        }}
        onOpenCart={() => setIsCartOpen(true)}
        totalCartCount={totalCartCount}
        priceMode={priceMode}
        onTogglePriceMode={setPriceMode}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleAdminLogout}
        categories={categories.map((c) => c.name)}
      />

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="my-2 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Offline mode — viewing cached catalog from local storage</span>
        </div>
      )}

      {/* Category Chips Bar */}
      <CategoryFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        isAdmin={isAdmin}
        onDeleteCategory={setDeleteCategoryTarget}
      />

      {/* Main Product Section */}
      <main>
        <ProductGrid
          groupedByCategory={groupedByCategory}
          priceMode={priceMode}
          isAdmin={isAdmin}
          onOpenVariantModal={setSelectedProductForVariant}
          onToggleStock={handleToggleStock}
          onOpenEdit={setEditTarget}
          onDeleteProduct={setDeleteTarget}
          onOpenPriceHistory={(productName, variant) => setHistoryTarget({ productName, variant })}
        />
      </main>

      {/* Admin Login Modal */}
      <AdminAuthModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        categories={categories}
        onOpenScanner={(variantIndex?: number) => {
          setScannerTarget("add");
          setActiveScanVariantIndex(variantIndex ?? 0);
          setIsScannerOpen(true);
        }}
        scannedBarcode={scannedBarcode}
        activeScanVariantIndex={activeScanVariantIndex}
        onProductCreated={handleProductCreated}
        onProductUpdated={handleProductUpdated}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        product={editTarget}
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        categories={categories}
        onOpenScanner={(variantIndex?: number) => {
          setScannerTarget("edit");
          setActiveScanVariantIndex(variantIndex ?? 0);
          setIsScannerOpen(true);
        }}
        scannedBarcode={scannedBarcode}
        activeScanVariantIndex={activeScanVariantIndex}
        onProductUpdated={handleProductUpdated}
      />

      {/* Delete Product Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete item?"
        description={`Delete "${deleteTarget?.name || ""}"? This will remove it and its price history. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteProduct}
      />

      {/* Delete Category Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        title="Delete category?"
        description={`Are you sure you want to delete the category "${deleteCategoryTarget?.name || ""}"?`}
        confirmLabel="Delete Category"
        onConfirm={handleDeleteCategory}
      />

      {/* Variant Modal */}
      <VariantModal
        product={selectedProductForVariant}
        isOpen={!!selectedProductForVariant}
        onClose={() => setSelectedProductForVariant(null)}
        priceMode={priceMode}
        cart={cart}
        onConfirmAddVariants={(updatedCart, productName) => {
          setCart(updatedCart);
          toast.success(`Updated cart for ${productName}`);
        }}
      />

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Price History Modal */}
      {historyTarget && (
        <PriceHistoryModal
          isOpen={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
          productName={historyTarget.productName}
          variantLabel={historyTarget.variant.label}
          variantId={historyTarget.variant.id}
          currentRetail={historyTarget.variant.retailPrice}
          currentWholesale={historyTarget.variant.wholesalePrice}
          isAdmin={isAdmin}
        />
      )}

      <footer>Created by Rave</footer>
    </div>
  );
}
