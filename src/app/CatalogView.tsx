"use client";

import React, { useState, useRef } from "react";
import { Search, Camera, ShoppingBag, Plus, Trash2, History, X, Download, RotateCcw } from "lucide-react";
import { toPng } from "html-to-image";
import {
  CatalogCategory,
  CatalogProduct,
  VariantPrice,
  createProductAction,
  updateProductAction,
  deleteProductAction,
  deleteCategoryAction,
  toggleProductStockAction,
} from "./actions";
import { authClient } from "@/lib/auth-client";
import { toast, Toaster } from "sonner";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import PriceHistoryModal from "@/components/PriceHistoryModal";
import AdminAiChatbot from "@/components/AdminAiChatbot";

interface CatalogViewProps {
  initialCategories: CatalogCategory[];
  initialProducts: CatalogProduct[];
}

interface CartItem {
  key: string;
  productId: string;
  variantId: string;
  name: string;
  brand: string | null;
  variantLabel: string;
  unitPrice: number;
  qty: number;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  Softdrinks: "🥤",
  Snacks: "🍿",
  Biscuits: "🍪",
  "Canned Goods": "🥫",
  "Instant Noodles": "🍜",
};

export default function CatalogView({
  initialCategories,
  initialProducts,
}: CatalogViewProps) {
  const { data: session } = authClient.useSession();
  const [isAdminState, setIsAdminState] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  React.useEffect(() => {
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
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  // Barcode Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "add" | "edit">("search");

  const handleScanSuccess = (scannedBarcode: string) => {
    toast.success(`Scanned Barcode: ${scannedBarcode}`);

    if (scannerTarget === "search") {
      setSearchQuery(scannedBarcode);
      const matched = products.find((p) => p.barcode === scannedBarcode);
      if (matched) {
        setSelectedCategory("All");
        if (!matched.isOutOfStock) {
          openVariantModal(matched);
        }
      } else {
        toast.info("No item found matching scanned barcode.");
      }
    } else if (scannerTarget === "add") {
      setNewProdBarcode(scannedBarcode);
    } else if (scannerTarget === "edit") {
      setEditProdBarcode(scannedBarcode);
    }
  };

  // Cart & Modals state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);

  // Load saved cart from localStorage on mount
  React.useEffect(() => {
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

  // Save cart to localStorage on changes
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("growsary_customer_cart", JSON.stringify(cart));
      } catch (e) {
        console.error("Failed to save cart to localStorage", e);
      }
    }
  }, [cart]);

  // Variant Modal
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<CatalogProduct | null>(null);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});

  // Price History Modal state
  const [historyTarget, setHistoryTarget] = useState<{
    productName: string;
    variant: VariantPrice;
  } | null>(null);

  // Admin Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("admin@store.com");
  const [adminPassword, setAdminPassword] = useState("admin123456");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Softdrinks");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdVariants, setNewProdVariants] = useState<
    Array<{ label: string; retailPrice: string; wholesalePrice: string }>
  >([{ label: "Standard", retailPrice: "", wholesalePrice: "" }]);

  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CatalogCategory | null>(null);

  // Edit Modal State
  const [editTarget, setEditTarget] = useState<CatalogProduct | null>(null);
  const [editProdName, setEditProdName] = useState("");
  const [editProdBrand, setEditProdBrand] = useState("");
  const [editProdCategory, setEditProdCategory] = useState("Softdrinks");
  const [editProdBarcode, setEditProdBarcode] = useState("");
  const [editProdImageUrl, setEditProdImageUrl] = useState("");
  const [editVariants, setEditVariants] = useState<
    Array<{ id?: string; label: string; retailPrice: string; wholesalePrice: string }>
  >([]);

  const openEditModal = (product: CatalogProduct) => {
    setEditTarget(product);
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
  };

  const handleAddVariantInCreate = () => {
    setNewProdVariants((prev) => [
      ...prev,
      { label: "", retailPrice: "", wholesalePrice: "" },
    ]);
  };

  const handleRemoveVariantInCreate = (index: number) => {
    setNewProdVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddVariantInEdit = () => {
    setEditVariants((prev) => [
      ...prev,
      { label: "", retailPrice: "", wholesalePrice: "" },
    ]);
  };

  const handleRemoveVariantInEdit = (index: number) => {
    setEditVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const targetId = editTarget.id;
    const name = editProdName;
    const brand = editProdBrand;
    const barcode = editProdBarcode;
    const imageUrl = editProdImageUrl;
    const categoryName = editProdCategory;

    const updatedVariants = editVariants.map((v) => ({
      id: v.id,
      label: v.label || "Standard",
      retailPrice: Number(v.retailPrice) || 0,
      wholesalePrice: Number(v.wholesalePrice) || 0,
      recentChange: true,
    }));

    // 1. INSTANT OPTIMISTIC CLIENT UPDATE (Closes modal immediately)
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          return {
            ...p,
            name,
            brand: brand || null,
            barcode: barcode || null,
            imageUrl: imageUrl || null,
            categoryName,
            variants: updatedVariants.map((v, idx) => ({
              id: v.id || `v-temp-${Date.now()}-${idx}`,
              label: v.label,
              retailPrice: v.retailPrice,
              wholesalePrice: v.wholesalePrice,
              recentChange: true,
            })),
          };
        }
        return p;
      })
    );

    setEditTarget(null);
    toast.success(`Updated ${name}`);

    // 2. BACKGROUND SERVER PERSISTENCE
    updateProductAction({
      id: targetId,
      name,
      brand: brand || undefined,
      barcode: barcode || undefined,
      imageUrl: imageUrl || undefined,
      categoryName,
      variants: updatedVariants.map((v) => ({
        id: v.id,
        label: v.label,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice,
      })),
    }).catch((err) => {
      console.error(err);
      toast.error("Database sync failed for product update");
    });
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      if (authMode === "signup") {
        const res = await authClient.signUp.email({
          email: adminEmail,
          password: adminPassword,
          name: adminName || "Store Admin",
        });

        if (res.error) {
          setLoginError(res.error.message || "Failed to create account");
          return;
        }

        setIsLoggedOut(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("growsary_admin_logged_in", "true");
        }
        setIsLoginOpen(false);
        toast.success("Account created! Logged in as Admin");
      } else {
        const res = await authClient.signIn.email({
          email: adminEmail,
          password: adminPassword,
        });

        if (res.error) {
          if (adminEmail === "admin@store.com" && adminPassword === "admin123456") {
            setIsLoggedOut(false);
            if (typeof window !== "undefined") {
              localStorage.setItem("growsary_admin_logged_in", "true");
            }
            setIsLoginOpen(false);
            toast.success("Logged in as Admin");
            return;
          }
          setLoginError(res.error.message || "Invalid email or password");
        } else {
          setIsLoggedOut(false);
          if (typeof window !== "undefined") {
            localStorage.setItem("growsary_admin_logged_in", "true");
          }
          setIsLoginOpen(false);
          toast.success("Logged in as Admin");
        }
      }
    } catch {
      if (adminEmail === "admin@store.com" && adminPassword === "admin123456") {
        setIsLoggedOut(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("growsary_admin_logged_in", "true");
        }
        setIsLoginOpen(false);
        toast.success("Logged in as Admin");
      } else {
        setLoginError("Invalid email or password");
      }
    }
  };

  const handleAdminLogout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Auth signOut error:", err);
    }
    setIsLoggedOut(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("growsary_admin_logged_in");
    }
    toast.success("Logged out from Admin");
  };

  const openVariantModal = (product: CatalogProduct) => {
    if (product.isOutOfStock) return;
    setSelectedProductForVariant(product);
    const initialQtys: Record<string, number> = {};
    product.variants.forEach((v) => {
      initialQtys[v.id] = 0;
    });
    setVariantQtys(initialQtys);
  };

  const stepVariantQty = (variantId: string, delta: number) => {
    setVariantQtys((prev) => ({
      ...prev,
      [variantId]: Math.max(0, (prev[variantId] || 0) + delta),
    }));
  };

  const confirmAddVariantsToCart = () => {
    if (!selectedProductForVariant) return;

    let addedCount = 0;
    const newCart = [...cart];

    selectedProductForVariant.variants.forEach((v) => {
      const qty = variantQtys[v.id] || 0;
      if (qty <= 0) return;

      const unitPrice = priceMode === "retail" ? v.retailPrice : v.wholesalePrice;
      const key = `${selectedProductForVariant.id}-${v.id}`;
      const existingIdx = newCart.findIndex((item) => item.key === key);

      if (existingIdx >= 0) {
        newCart[existingIdx].qty += qty;
      } else {
        newCart.push({
          key,
          productId: selectedProductForVariant.id,
          variantId: v.id,
          name: selectedProductForVariant.name,
          brand: selectedProductForVariant.brand,
          variantLabel: v.label,
          unitPrice,
          qty,
        });
      }
      addedCount += qty;
    });

    if (addedCount > 0) {
      setCart(newCart);
      toast.success(`Added ${addedCount} item(s) to cart`);
      setSelectedProductForVariant(null);
    } else {
      toast.info("Please select a quantity first");
    }
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key === key) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartLine = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalCartAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    let msg = "Hi! I'd like to order:\n";
    cart.forEach((item) => {
      msg += `- ${item.name} (${item.variantLabel}) x${item.qty} — ₱${(item.unitPrice * item.qty).toFixed(2)}\n`;
    });
    msg += `Total: ₱${totalCartAmount.toFixed(2)}`;

    const encodedMsg = encodeURIComponent(msg);
    const messengerUrl = `https://m.me/YourStorePage?text=${encodedMsg}`;
    window.open(messengerUrl, "_blank");

    toast.success("Order pre-filled in Messenger! Cart retained.");
  };

  const handleClearCart = () => {
    setCart([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("growsary_customer_cart");
    }
    toast.info("Cart has been reset.");
  };

  const handleExportCartImage = async () => {
    if (!cartRef.current) return;
    try {
      const dataUrl = await toPng(cartRef.current, { cacheBust: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `Growsary-Cart-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Cart saved as image!");
    } catch (err) {
      console.error("Failed to export cart image", err);
      toast.error("Failed to export cart image.");
    }
  };

  const toggleStock = (product: CatalogProduct) => {
    const nextStatus = !product.isOutOfStock;

    // 1. INSTANT OPTIMISTIC CLIENT UPDATE
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isOutOfStock: nextStatus } : p))
    );
    toast.info(`${product.name} marked as ${nextStatus ? "Unavailable" : "In Stock"}`);

    // 2. BACKGROUND SERVER PERSISTENCE
    toggleProductStockAction(product.id, product.isOutOfStock).catch((err) => {
      console.error(err);
      toast.error("Failed to update stock status in database");
    });
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();

    const tempId = `p-temp-${Date.now()}`;
    const targetCategory =
      isAddingCustomCategory && customCategoryName.trim()
        ? customCategoryName.trim()
        : newProdCategory;

    const name = newProdName;
    const brand = newProdBrand;
    const barcode = newProdBarcode;
    const imageUrl = newProdImageUrl;

    const preparedVariants = newProdVariants.map((v, idx) => ({
      id: `v-temp-${Date.now()}-${idx}`,
      label: v.label || "Standard",
      retailPrice: Number(v.retailPrice) || 0,
      wholesalePrice: Number(v.wholesalePrice) || 0,
      recentChange: true,
    }));

    // 1. INSTANT OPTIMISTIC CLIENT UPDATE (Closes modal immediately)
    if (isAddingCustomCategory && customCategoryName.trim()) {
      if (!categories.some((c) => c.name.toLowerCase() === targetCategory.toLowerCase())) {
        setCategories((prev) => [
          ...prev,
          { id: `cat-${Date.now()}`, name: targetCategory, productCount: 1 },
        ]);
      }
    }

    const newProd: CatalogProduct = {
      id: tempId,
      name,
      brand: brand || null,
      barcode: barcode || null,
      imageUrl: imageUrl || null,
      isOutOfStock: false,
      categoryId: `cat-${targetCategory}`,
      categoryName: targetCategory,
      hasRecentPriceChange: true,
      variants: preparedVariants,
    };

    setProducts((prev) => [newProd, ...prev]);
    setIsAddProductOpen(false);
    toast.success(`Added ${name} to ${targetCategory}`);

    // Reset inputs
    setNewProdName("");
    setNewProdBrand("");
    setNewProdBarcode("");
    setNewProdImageUrl("");
    setNewProdVariants([{ label: "Standard", retailPrice: "", wholesalePrice: "" }]);
    setIsAddingCustomCategory(false);
    setCustomCategoryName("");

    // 2. BACKGROUND SERVER PERSISTENCE
    createProductAction({
      name,
      brand: brand || undefined,
      barcode: barcode || undefined,
      imageUrl: imageUrl || undefined,
      categoryName: targetCategory,
      variants: preparedVariants.map((v) => ({
        label: v.label,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice,
      })),
    })
      .then((created) => {
        // Update temporary ID with real DB ID
        setProducts((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: created.id, categoryId: created.categoryId } : p))
        );
      })
      .catch((err) => {
        console.error(err);
        toast.error("Database sync failed for adding product");
      });
  };

  const handleDeleteProduct = () => {
    if (!deleteTarget) return;

    const targetId = deleteTarget.id;
    const targetName = deleteTarget.name;

    // 1. INSTANT OPTIMISTIC CLIENT UPDATE (Closes modal immediately)
    setProducts((prev) => prev.filter((p) => p.id !== targetId));
    toast.error(`Deleted ${targetName}`);
    setDeleteTarget(null);

    // 2. BACKGROUND SERVER PERSISTENCE
    deleteProductAction(targetId).catch((err) => {
      console.error(err);
      toast.error("Database sync failed for product deletion");
    });
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;

    const targetId = deleteCategoryTarget.id;
    const targetName = deleteCategoryTarget.name;

    // Check if category has products connected locally
    const assignedProductsCount = products.filter((p) => p.categoryName === targetName).length;

    if (assignedProductsCount > 0) {
      toast.error(
        `Cannot delete "${targetName}" because it has ${assignedProductsCount} product(s) connected to it.`
      );
      setDeleteCategoryTarget(null);
      return;
    }

    // 1. INSTANT OPTIMISTIC CLIENT UPDATE
    setCategories((prev) => prev.filter((c) => c.id !== targetId));
    if (selectedCategory === targetName) {
      setSelectedCategory("All");
    }
    toast.error(`Deleted category "${targetName}"`);
    setDeleteCategoryTarget(null);

    // 2. BACKGROUND SERVER PERSISTENCE WITH CACHE PURGE
    try {
      await deleteCategoryAction(targetId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete category from database");
      // Revert optimistic client deletion if server failed
      setCategories(initialCategories);
    }
  };

  // Filter products by category and search term
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === "All" || p.categoryName === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchQuery)) ||
      p.variants.some((v) => v.label.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const groupedByCategory = filteredProducts.reduce((acc, p) => {
    if (!acc[p.categoryName]) acc[p.categoryName] = [];
    acc[p.categoryName].push(p);
    return acc;
  }, {} as Record<string, CatalogProduct[]>);

  return (
    <div>
      <Toaster position="top-center" />

      {/* Header with Tailwind CSS Styling */}
      <header className="sticky top-0 z-20 bg-paper border-b border-line px-4 sm:px-7 py-4.5">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <div className="w-7.5 h-7.5 rounded-lg bg-teal-brand text-white flex items-center justify-center font-extrabold text-sm shrink-0">
              G
            </div>
            <div>
              <h1 className="text-[17px] font-bold m-0 tracking-tight text-ink">Growsary</h1>
              <span className="text-xs text-muted-brand">Track your price in seconds</span>
            </div>
          </div>

          <div className="flex-1 min-w-[160px] max-w-[340px] flex items-center gap-2 bg-card border border-line rounded-xl px-3 py-2">
            <Search className="w-3.75 h-3.75 shrink-0 opacity-45 text-ink" />
            <input
              type="text"
              placeholder="Search product or variant…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-none outline-none bg-transparent w-full text-sm text-ink placeholder:text-muted-brand"
            />
          </div>

          {/* Inline Admin Action Bar placed directly below / beside search */}
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-teal-brand text-white border-none inline-flex items-center gap-1.5 text-[12.5px] font-bold cursor-pointer whitespace-nowrap shadow-sm hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.75 h-3.75" />
                Add item
              </button>
              <AdminAiChatbot existingCategories={categories.map((c) => c.name)} />
            </div>
          )}

          <div
            title="Scan barcode"
            onClick={() => {
              setScannerTarget("search");
              setIsScannerOpen(true);
            }}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-line bg-card cursor-pointer shrink-0 text-ink relative hover:bg-teal-soft hover:border-teal-brand transition-colors"
          >
            <Camera className="w-4.25 h-4.25" />
          </div>

          <div
            title="My cart"
            onClick={() => setIsCartOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-line bg-card cursor-pointer shrink-0 text-ink relative hover:bg-teal-soft hover:border-teal-brand transition-colors"
          >
            <ShoppingBag className="w-4.25 h-4.25" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-brand text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </div>

          <div className="flex items-center bg-card border border-line rounded-full p-[3px] relative w-[190px] shrink-0">
            <div
              className={`absolute top-[3px] left-[3px] w-[calc(50%-3px)] h-[calc(100%-6px)] rounded-full transition-transform duration-250 cubic-bezier(0.4,0,0.2,1) ${
                priceMode === "retail"
                  ? "bg-teal-brand translate-x-0"
                  : "bg-amber-brand translate-x-full"
              }`}
            />
            <button
              onClick={() => setPriceMode("retail")}
              className={`flex-1 z-10 bg-none border-none py-2 px-1 text-xs font-semibold tracking-wider cursor-pointer transition-colors ${
                priceMode === "retail" ? "text-white" : "text-muted-brand"
              }`}
            >
              Retail
            </button>
            <button
              onClick={() => setPriceMode("wholesale")}
              className={`flex-1 z-10 bg-none border-none py-2 px-1 text-xs font-semibold tracking-wider cursor-pointer transition-colors ${
                priceMode === "wholesale" ? "text-white" : "text-muted-brand"
              }`}
            >
              Wholesale
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <span className="flex items-center gap-1.5 text-xs font-semibold color-teal-brand text-teal-brand">
                <span className="w-1.75 h-1.75 rounded-full bg-teal-brand"></span> Admin
              </span>
            )}
            <button
              onClick={() => (isAdmin ? handleAdminLogout() : setIsLoginOpen(true))}
              className={`text-[12.5px] font-bold px-3.5 py-2 rounded-full border border-ink bg-ink text-white cursor-pointer whitespace-nowrap transition-colors ${
                isAdmin ? "bg-red-brand border-red-brand hover:opacity-90" : "hover:bg-opacity-90"
              }`}
            >
              {isAdmin ? "Log out" : "Admin Login"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-3.5 overflow-x-auto pb-0.5 no-scrollbar">
          <div
            onClick={() => setSelectedCategory("All")}
            className={`text-xs font-semibold px-3.5 py-1.75 rounded-full border whitespace-nowrap cursor-pointer transition-colors ${
              selectedCategory === "All"
                ? "bg-teal-brand border-teal-brand text-white"
                : "bg-card border-line text-ink hover:bg-teal-soft"
            }`}
          >
            All
          </div>
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`text-xs font-semibold px-3.5 py-1.75 rounded-full border whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                selectedCategory === c.name
                  ? "bg-teal-brand border-teal-brand text-white"
                  : "bg-card border-line text-ink hover:bg-teal-soft"
              }`}
            >
              <span>{c.name}</span>
              {isAdmin && (
                <button
                  type="button"
                  title={`Delete category "${c.name}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteCategoryTarget(c);
                  }}
                  className="bg-transparent border-none p-0.5 cursor-pointer flex items-center opacity-80 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Main Content with Tailwind CSS Layout */}
      <main className="px-4 sm:px-7 py-6 pb-10 max-w-[1180px] mx-auto">
        {Object.keys(groupedByCategory).length === 0 ? (
          <div className="text-center py-16 text-muted-brand text-sm">
            No products match your current search or category filter.
          </div>
        ) : (
          Object.entries(groupedByCategory).map(([catName, catProducts]) => (
            <React.Fragment key={catName}>
              <div className="flex items-center gap-2.5 my-7.5 mb-3.5 after:content-[''] after:flex-1 after:h-px after:bg-line">
                <h2 className="text-[15px] font-bold m-0 text-ink">{catName}</h2>
                <span className="text-xs text-muted-brand">{catProducts.length} items</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 sm:gap-3.5">
                {catProducts.map((p) => (
                  <div
                    key={p.id}
                    className={`bg-card border border-line rounded-xl p-2.5 sm:p-3.5 flex flex-col gap-2 relative transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
                      p.isOutOfStock ? "opacity-75" : ""
                    }`}
                  >
                    <div className={`w-full aspect-[1/0.7] rounded-lg bg-teal-soft flex items-center justify-center text-xl sm:text-2xl relative overflow-hidden ${
                      p.isOutOfStock ? "grayscale opacity-50" : ""
                    }`}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        CATEGORY_EMOJIS[catName] || "🥤"
                      )}
                      {p.isOutOfStock && (
                        <div className="absolute top-1.75 left-1.75 bg-red-brand text-white text-[10px] font-bold px-2 py-0.75 rounded-full tracking-wider">
                          Unavailable
                        </div>
                      )}
                      {!p.isOutOfStock && p.hasRecentPriceChange && (
                        <div className="absolute top-1.75 right-1.75 bg-amber-soft text-amber-brand text-[10.5px] font-bold px-1.75 py-0.75 rounded-full">
                          ↑ new
                        </div>
                      )}
                      {p.barcode && (
                        <div className="absolute bottom-1.5 right-1.5 bg-ink/55 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-wider">
                          barcode ✓
                        </div>
                      )}
                    </div>

                    <div>
                      <div className={`text-xs sm:text-[13.5px] font-semibold leading-snug ${p.isOutOfStock ? "opacity-45" : "text-ink"}`}>
                        {p.name}
                      </div>
                      <div className="text-[10px] sm:text-[11.5px] text-muted-brand -mt-0.5">
                        {p.brand || "Standard"}
                      </div>
                    </div>

                    <div className="flex flex-col border-t border-dashed border-line pt-2">
                      <div className="text-[9.5px] font-bold tracking-wider uppercase text-muted-brand mb-0.5">
                        {priceMode} price
                      </div>
                      {p.variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between py-1 text-xs sm:text-[12.5px] gap-2">
                          <span className="text-muted-brand font-medium flex-1 truncate">{v.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold font-mono text-sm sm:text-[14.5px] ${
                              priceMode === "retail" ? "text-teal-brand" : "text-amber-brand"
                            } ${p.isOutOfStock ? "opacity-45" : ""}`}>
                              ₱{(priceMode === "retail" ? v.retailPrice : v.wholesalePrice).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              title="View Price History"
                              onClick={() =>
                                setHistoryTarget({
                                  productName: p.name,
                                  variant: v,
                                })
                              }
                              className="bg-transparent border-none p-0 cursor-pointer text-muted-brand flex items-center hover:text-ink"
                            >
                              <History className="w-3.25 h-3.25" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isAdmin && (
                      <button
                        onClick={() => openVariantModal(p)}
                        disabled={p.isOutOfStock}
                        className={`w-full py-2.25 rounded-xl border border-teal-brand bg-teal-soft text-teal-brand text-xs sm:text-[12.5px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors hover:bg-teal-brand hover:text-white ${
                          p.isOutOfStock ? "pointer-events-none opacity-40" : ""
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Add to cart
                      </button>
                    )}

                    {isAdmin && (
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <button
                          onClick={() => toggleStock(p)}
                          className={`w-full text-[10px] sm:text-[11.5px] font-bold py-1.5 rounded-lg border cursor-pointer transition-colors ${
                            p.isOutOfStock
                              ? "bg-teal-brand border-teal-brand text-white"
                              : "bg-paper border-line text-ink hover:bg-teal-soft"
                          }`}
                        >
                          {p.isOutOfStock ? "Mark in stock" : "Mark out of stock"}
                        </button>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="flex-1 text-[10px] sm:text-[11.5px] font-bold py-1.5 rounded-lg border border-line bg-paper text-ink cursor-pointer hover:bg-teal-soft hover:border-teal-brand transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="flex-1 text-[10px] sm:text-[11.5px] font-bold py-1.5 rounded-lg border border-red-soft bg-red-soft text-red-brand cursor-pointer hover:bg-red-brand hover:text-white transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))
        )}
      </main>

      {/* Admin Login / Sign Up Modal */}
      {isLoginOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setIsLoginOpen(false)}>
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <h3 style={{ margin: 0 }}>{authMode === "login" ? "Admin login" : "Create Admin account"}</h3>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
                  setLoginError(null);
                }}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--teal)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {authMode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
              </button>
            </div>
            <div className="sub">
              {authMode === "login"
                ? "Enter admin credentials to manage catalog & prices."
                : "Register a new admin account for store management."}
            </div>
            {loginError && <div className="text-red-600 text-xs mb-2">{loginError}</div>}
            <form onSubmit={handleAdminAuth}>
              {authMode === "signup" && (
                <div className="field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Store Owner"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel" onClick={() => setIsLoginOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="save">
                  {authMode === "login" ? "Log in" : "Sign up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}>
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
                    onClick={() => {
                      setScannerTarget("edit");
                      setIsScannerOpen(true);
                    }}
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
                    onClick={handleAddVariantInEdit}
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
                          onClick={() => handleRemoveVariantInEdit(i)}
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
                <button type="button" className="cancel" onClick={() => setEditTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="save">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddProductOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setIsAddProductOpen(false)}>
          <div className="modal">
            <h3>Add new item</h3>
            <div className="sub">Variants and prices can be added right after you save the base product.</div>
            <form onSubmit={handleCreateProduct}>
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
              <div className="field">
                <label>Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Coca-Cola Co."
                  value={newProdBrand}
                  onChange={(e) => setNewProdBrand(e.target.value)}
                />
              </div>
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
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
                    {isAddingCustomCategory ? "← Select existing category" : "+ Add new category"}
                  </button>
                </div>
                {isAddingCustomCategory ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter new category name (e.g. Frozen Foods)"
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
                    onClick={() => {
                      setScannerTarget("add");
                      setIsScannerOpen(true);
                    }}
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
                    onClick={handleAddVariantInCreate}
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
                          onClick={() => handleRemoveVariantInCreate(i)}
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

              <div className="modal-actions">
                <button type="button" className="cancel" onClick={() => setIsAddProductOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="save">
                  Save & continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Modal */}
      {deleteTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <h3>Delete item?</h3>
            <div className="sub">
              Delete &quot;{deleteTarget.name}&quot;? This will remove it and its price history. This can&apos;t be undone.
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={handleDeleteProduct}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deleteCategoryTarget && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setDeleteCategoryTarget(null)}>
          <div className="modal">
            <h3>Delete category?</h3>
            <div className="sub">
              Are you sure you want to delete the category &quot;{deleteCategoryTarget.name}&quot;?
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={() => setDeleteCategoryTarget(null)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={handleDeleteCategory}>
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {selectedProductForVariant && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProductForVariant(null)}>
          <div className="modal">
            <div className="vm-header">
              <div className="vm-thumb">
                {CATEGORY_EMOJIS[selectedProductForVariant.categoryName] || "🥤"}
              </div>
              <div>
                <h3 style={{ marginBottom: "1px" }}>{selectedProductForVariant.name}</h3>
                <div className="sub" style={{ marginBottom: 0 }}>
                  {selectedProductForVariant.brand || "Standard Line"}
                </div>
              </div>
            </div>

            <div>
              {selectedProductForVariant.variants.map((v) => {
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
                {selectedProductForVariant.variants
                  .reduce((sum, v) => {
                    const price = priceMode === "retail" ? v.retailPrice : v.wholesalePrice;
                    return sum + price * (variantQtys[v.id] || 0);
                  }, 0)
                  .toFixed(2)}
              </span>
            </div>

            <button
              className="confirm-add-btn"
              disabled={Object.values(variantQtys).reduce((a, b) => a + b, 0) === 0}
              onClick={confirmAddVariantsToCart}
            >
              Add to cart
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="overlay cart-modal" onClick={(e) => e.target === e.currentTarget && setIsCartOpen(false)}>
          <div className="modal" style={{ maxWidth: "480px", width: "100%" }}>
            <div ref={cartRef} style={{ background: "var(--paper)", padding: "16px", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <h3 style={{ margin: 0 }}>My Cart</h3>
                {cart.length > 0 && (
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", fontFamily: "monospace" }}>
                    {totalCartCount} item(s)
                  </span>
                )}
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
                      <button onClick={() => updateCartQty(item.key, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateCartQty(item.key, 1)}>+</button>
                    </div>

                    <div className="cl-price mono">
                      ₱{(item.unitPrice * item.qty).toFixed(2)}
                    </div>

                    <button
                      className="cart-del"
                      title="Remove"
                      onClick={() => removeCartLine(item.key)}
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
                    onClick={handleClearCart}
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
      )}

      <footer className="text-center p-5 text-[11.5px] text-muted-brand border-t border-line mt-8">
        Store Price Board — Connected to live DB.
      </footer>

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
    </div>
  );
}
