"use client";

import React, { useState, useRef } from "react";
import { Bot, Send, Image as ImageIcon, X, Loader2, Sparkles } from "lucide-react";
import { processAiProductMessageAction, ParsedProductAI, ParsedProductItem } from "@/app/ai-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button"

interface MessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  imagePreview?: string;
  confirmationCard?: {
    product: ParsedProductItem;
    isEditing?: boolean;
  };
  multipleConfirmationCard?: {
    items: ParsedProductItem[];
  };
  /**
   * Price Update Confirmation Card State
   * Holds the product, its variants, checkbox selections for retail/wholesale update, and input prices.
   */
  priceUpdateCard?: {
    productId: string;
    productName: string;
    brand?: string;
    categoryName: string;
    variantSelections: Array<{
      variantId: string;
      label: string;
      currentRetail: number;
      currentWholesale: number;
      updateRetail: boolean;
      updateWholesale: boolean;
      newRetailPrice: number;
      newWholesalePrice: number;
    }>;
  };
  /**
   * AI Calculator Mode Result Card State
   * Holds calculated receipt items and grand total sum.
   */
  calculatorCard?: {
    items: Array<{ name: string; price: number; qty?: number }>;
    totalSum: number;
  };
}

interface AdminAiChatbotProps {
  existingCategories: string[];
}

export default function AdminAiChatbot({ existingCategories }: AdminAiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCalculatorMode, setIsCalculatorMode] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "👋 Hi Admin! I can help you add products instantly or update prices for existing variants. Try uploading a photo or typing 'update price of Coca-Cola'!",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const calculatorFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64Data = compressedDataUrl.split(",")[1];

        setSelectedImage({
          base64: base64Data,
          mimeType: "image/jpeg",
          previewUrl: compressedDataUrl,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  /**
   * Core AI Message Handler
   * Sends user prompt/image to server action and renders corresponding interactive confirmation cards.
   */
  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : inputText;
    if (!textToSend.trim() && !selectedImage) return;

    const userMsgId = `usr-${Date.now()}`;
    if (
      !customMessage?.startsWith("EXECUTE_PRODUCT_CREATE:") &&
      !customMessage?.startsWith("EXECUTE_MULTIPLE_CREATE:") &&
      !customMessage?.startsWith("EXECUTE_PRICE_UPDATE:")
    ) {
      const userMessage: MessageItem = {
        id: userMsgId,
        sender: "user",
        text: textToSend,
        imagePreview: selectedImage?.previewUrl,
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    const imagePayload = selectedImage;
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);
    setTimeout(scrollToBottom, 100);

    try {
      const result = await processAiProductMessageAction({
        message: textToSend,
        imageBase64: imagePayload?.base64,
        imageMimeType: imagePayload?.mimeType,
      });

      const aiMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: result.reply,
      };

      // 1. Single Product Addition Confirmation
      if (result.action === "confirm_product" && result.product) {
        aiMsg.confirmationCard = {
          product: result.product,
          isEditing: false,
        };
      }
      // 2. Multi-Product / Variant Choice Confirmation
      else if (result.action === "confirm_multiple" && result.multipleProducts) {
        aiMsg.multipleConfirmationCard = {
          items: result.multipleProducts,
        };
      }
      // 3. Price Update Intent Confirmation with Checkbox Selections
      else if (result.action === "confirm_price_update" && result.updateTarget) {
        const target = result.updateTarget;
        const suggestedRetail = target.suggestedNewPrices?.newRetailPrice;
        const suggestedWholesale = target.suggestedNewPrices?.newWholesalePrice;

        aiMsg.priceUpdateCard = {
          productId: target.productId,
          productName: target.productName,
          brand: target.brand,
          categoryName: target.categoryName,
          variantSelections: target.variants.map((v) => {
            const isSuggestedTarget =
              !target.suggestedNewPrices?.targetVariantLabel ||
              v.label.toLowerCase().includes(target.suggestedNewPrices.targetVariantLabel.toLowerCase());

            return {
              variantId: v.id,
              label: v.label,
              currentRetail: v.retailPrice,
              currentWholesale: v.wholesalePrice,
              updateRetail: isSuggestedTarget && suggestedRetail !== undefined,
              updateWholesale: isSuggestedTarget && suggestedWholesale !== undefined,
              newRetailPrice: (isSuggestedTarget && suggestedRetail !== undefined) ? suggestedRetail : v.retailPrice,
              newWholesalePrice: (isSuggestedTarget && suggestedWholesale !== undefined) ? suggestedWholesale : v.wholesalePrice,
            };
          }),
        };
      }

      setMessages((prev) => [...prev, aiMsg]);
      if (result.action === "create_product") {
        toast.success("Product added by AI!");
      } else if (result.action === "update_price_success") {
        toast.success("Variant prices updated!");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: `Error: ${err.message || "Failed to process request"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleConfirmAndAddSingle = (msgId: string, product: ParsedProductItem) => {
    const execMessage = `EXECUTE_PRODUCT_CREATE:${JSON.stringify(product)}`;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmationCard: undefined } : m))
    );
    handleSendMessage(execMessage);
  };

  const handleCancelCard = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, confirmationCard: undefined, multipleConfirmationCard: undefined, priceUpdateCard: undefined }
          : m
      )
    );
    toast.info("Cancelled action.");
  };

  const handleToggleEditMode = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.confirmationCard) {
          return {
            ...m,
            confirmationCard: {
              ...m.confirmationCard,
              isEditing: !m.confirmationCard.isEditing,
            },
          };
        }
        return m;
      })
    );
  };

  const handleUpdateCardField = (
    msgId: string,
    field: keyof ParsedProductItem,
    value: any
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.confirmationCard) {
          return {
            ...m,
            confirmationCard: {
              ...m.confirmationCard,
              product: {
                ...m.confirmationCard.product,
                [field]: value,
              },
            },
          };
        }
        return m;
      })
    );
  };

  const handleConfirmMultipleMode = (
    msgId: string,
    items: ParsedProductItem[],
    mode: "single_with_variants" | "multiple_single_items"
  ) => {
    const execMessage = `EXECUTE_MULTIPLE_CREATE:${JSON.stringify({ items, mode })}`;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, multipleConfirmationCard: undefined } : m))
    );
    handleSendMessage(execMessage);
  };

  /**
   * Helper Handler: Update Checkbox & Input State for Price Update Confirmation Card
   */
  const handleTogglePriceUpdateField = (
    msgId: string,
    variantId: string,
    field: "updateRetail" | "updateWholesale" | "newRetailPrice" | "newWholesalePrice",
    value: any
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.priceUpdateCard) {
          return {
            ...m,
            priceUpdateCard: {
              ...m.priceUpdateCard,
              variantSelections: m.priceUpdateCard.variantSelections.map((v) =>
                v.variantId === variantId ? { ...v, [field]: value } : v
              ),
            },
          };
        }
        return m;
      })
    );
  };

  /**
   * Execution Handler: Submits Price Update Confirmation to Backend Action
   */
  const handleExecutePriceUpdate = (msgId: string, card: NonNullable<MessageItem["priceUpdateCard"]>) => {
    const updatesToPerform = card.variantSelections.filter(
      (v) => v.updateRetail || v.updateWholesale
    );

    if (updatesToPerform.length === 0) {
      toast.error("Please check at least one price (retail or wholesale) to update.");
      return;
    }

    const payloadObj = {
      productId: card.productId,
      variantUpdates: updatesToPerform.map((v) => ({
        variantId: v.variantId,
        updateRetail: v.updateRetail,
        updateWholesale: v.updateWholesale,
        newRetailPrice: v.newRetailPrice,
        newWholesalePrice: v.newWholesalePrice,
      })),
    };

    const execMessage = `EXECUTE_PRICE_UPDATE:${JSON.stringify(payloadObj)}`;

    // Clear card UI after submission
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, priceUpdateCard: undefined } : m))
    );

    handleSendMessage(execMessage);
  };

  return (
    <>
      {/* AI Assistant Button Component */}
      <Button
        variant="outline"
        className="border-zinc-300 rounded-[9px] text-xs"
        onClick={() => setIsOpen((prev) => !prev)}
        title="AI Store Assistant"
      >
        <Sparkles data-icon="inline-start" />
      </Button>

      {/* AI Chat Drawer / Modal - Mobile Friendly */}
      {isOpen && (
        <div
          className="ai-chat-overlay"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(28, 27, 25, 0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="ai-chat-card"
            style={{
              width: "100%",
              maxWidth: "420px",
              height: "100%",
              maxHeight: "560px",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 16px",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Bot width="20" height="20" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: "1.2" }}>Growsary AI</div>
                  <div style={{ fontSize: "11px", opacity: 0.9 }}>Add products via text or photo</div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "4px" }}
              >
                <X width="18" height="18" />
              </button>
            </div>

            {/* Messages Body */}
            <div
              style={{
                flex: 1,
                padding: "12px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "var(--bg)",
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: msg.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      background: msg.sender === "user" ? "var(--teal)" : "var(--paper)",
                      color: msg.sender === "user" ? "#ffffff" : "var(--ink)",
                      border: msg.sender === "user" ? "none" : "1px solid var(--line)",
                      fontSize: "13px",
                      lineHeight: "1.4",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Uploaded preview"
                        style={{ width: "100%", height: "auto", borderRadius: "8px", marginBottom: "6px" }}
                      />
                    )}
                    <div style={{ whiteSpace: "pre-line" }}>{msg.text}</div>

                    {/* AI Calculator Result Card (Styled with Tailwind CSS) */}
                    {msg.calculatorCard && (
                      <div className="mt-2.5 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                            🧮 AI Receipt Calculator
                          </span>
                          <span className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-semibold px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                            {msg.calculatorCard.items.length} items parsed
                          </span>
                        </div>

                        {/* Line items list */}
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {msg.calculatorCard.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 border-b border-zinc-50 dark:border-zinc-850"
                            >
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                {item.name} {item.qty && item.qty > 1 ? `(x${item.qty})` : ""}
                              </span>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                ₱{(item.price * (item.qty || 1)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Sum Display */}
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-bold text-sm text-zinc-900 dark:text-zinc-50">
                          <span>Grand Total Sum:</span>
                          <span className="text-teal-600 dark:text-teal-400 text-base">
                            ₱{msg.calculatorCard.totalSum.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Price Update Confirmation Card (Styled with Tailwind CSS) */}
                    {msg.priceUpdateCard && (
                      <div className="mt-2.5 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-3">
                        {/* Header details */}
                        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                            🏷️ Price Update Confirmation
                          </div>
                          <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                            {msg.priceUpdateCard.productName}
                            {msg.priceUpdateCard.brand && <span className="text-zinc-400 font-normal"> ({msg.priceUpdateCard.brand})</span>}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Category: {msg.priceUpdateCard.categoryName}
                          </div>
                        </div>

                        {/* Variants List with Checkboxes and Inputs */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {msg.priceUpdateCard.variantSelections.map((v) => (
                            <div
                              key={v.variantId}
                              className="p-2 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-xs space-y-1.5"
                            >
                              <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex justify-between items-center">
                                <span>{v.label}</span>
                                <span className="text-[10px] text-zinc-400">
                                  Current: ₱{v.currentRetail} R / ₱{v.currentWholesale} W
                                </span>
                              </div>

                              {/* Checkbox 1: Retail Price */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-zinc-700 dark:text-zinc-300 select-none">
                                  <input
                                    type="checkbox"
                                    checked={v.updateRetail}
                                    onChange={(e) =>
                                      handleTogglePriceUpdateField(
                                        msg.id,
                                        v.variantId,
                                        "updateRetail",
                                        e.target.checked
                                      )
                                    }
                                    className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                                  />
                                  <span>Retail Price (₱)</span>
                                </label>
                                {v.updateRetail && (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={v.newRetailPrice}
                                    onChange={(e) =>
                                      handleTogglePriceUpdateField(
                                        msg.id,
                                        v.variantId,
                                        "newRetailPrice",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="ml-auto w-20 px-2 py-0.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:border-teal-500"
                                  />
                                )}
                              </div>

                              {/* Checkbox 2: Wholesale Price */}
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-zinc-700 dark:text-zinc-300 select-none">
                                  <input
                                    type="checkbox"
                                    checked={v.updateWholesale}
                                    onChange={(e) =>
                                      handleTogglePriceUpdateField(
                                        msg.id,
                                        v.variantId,
                                        "updateWholesale",
                                        e.target.checked
                                      )
                                    }
                                    className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                                  />
                                  <span>Wholesale Price (₱)</span>
                                </label>
                                {v.updateWholesale && (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={v.newWholesalePrice}
                                    onChange={(e) =>
                                      handleTogglePriceUpdateField(
                                        msg.id,
                                        v.variantId,
                                        "newWholesalePrice",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="ml-auto w-20 px-2 py-0.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:border-teal-500"
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons: Confirm & Cancel */}
                        <div className="flex gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleExecutePriceUpdate(msg.id, msg.priceUpdateCard!)}
                            className="flex-1 py-1.5 px-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold rounded-md shadow-sm transition-colors cursor-pointer"
                          >
                            Confirm Price Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelCard(msg.id)}
                            className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.confirmationCard && (
                      <div style={{ marginTop: "10px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "10px", padding: "10px" }}>
                        {!msg.confirmationCard.isEditing ? (
                          <>
                            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
                              <div><strong>Product:</strong> {msg.confirmationCard.product.name}</div>
                              <div><strong>Brand:</strong> {msg.confirmationCard.product.brand || "—"}</div>
                              <div><strong>Variant:</strong> {msg.confirmationCard.product.variantLabel}</div>
                              <div><strong>Category:</strong> {msg.confirmationCard.product.categoryName || "General"}</div>
                              <div style={{ display: "flex", gap: "10px", color: "var(--teal)", fontWeight: 700, marginTop: "2px" }}>
                                <span>Retail: ₱{msg.confirmationCard.product.retailPrice.toFixed(2)}</span>
                                <span>Wholesale: ₱{msg.confirmationCard.product.wholesalePrice.toFixed(2)}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => handleConfirmAndAddSingle(msg.id, msg.confirmationCard!.product)}
                                style={{ flex: 1, background: "var(--teal)", color: "#fff", border: "none", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleEditMode(msg.id)}
                                style={{ flex: 1, background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelCard(msg.id)}
                                style={{ flex: 1, background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red-soft)", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", marginBottom: "6px" }}>
                              ✏️ Edit Product & Prices:
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                              <input
                                type="text"
                                placeholder="Product Name"
                                value={msg.confirmationCard.product.name}
                                onChange={(e) => handleUpdateCardField(msg.id, "name", e.target.value)}
                                style={{ fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)" }}
                              />
                              <div style={{ display: "flex", gap: "6px" }}>
                                <input
                                  type="text"
                                  placeholder="Brand"
                                  value={msg.confirmationCard.product.brand || ""}
                                  onChange={(e) => handleUpdateCardField(msg.id, "brand", e.target.value)}
                                  style={{ flex: 1, fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)" }}
                                />
                                <input
                                  type="text"
                                  placeholder="Variant Label"
                                  value={msg.confirmationCard.product.variantLabel}
                                  onChange={(e) => handleUpdateCardField(msg.id, "variantLabel", e.target.value)}
                                  style={{ flex: 1, fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)" }}
                                />
                              </div>
                              <select
                                value={msg.confirmationCard.product.categoryName || existingCategories[0] || "General"}
                                onChange={(e) => handleUpdateCardField(msg.id, "categoryName", e.target.value)}
                                style={{ fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)", background: "#fff" }}
                              >
                                {existingCategories.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: "9.5px", color: "var(--muted)" }}>Retail (₱)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={msg.confirmationCard.product.retailPrice}
                                    onChange={(e) => handleUpdateCardField(msg.id, "retailPrice", parseFloat(e.target.value) || 0)}
                                    style={{ width: "100%", fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)" }}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: "9.5px", color: "var(--muted)" }}>Wholesale (₱)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={msg.confirmationCard.product.wholesalePrice}
                                    onChange={(e) => handleUpdateCardField(msg.id, "wholesalePrice", parseFloat(e.target.value) || 0)}
                                    style={{ width: "100%", fontSize: "11.5px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--line)" }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => handleConfirmAndAddSingle(msg.id, msg.confirmationCard!.product)}
                                style={{ flex: 1, background: "var(--teal)", color: "#fff", border: "none", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Confirm and add
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelCard(msg.id)}
                                style={{ flex: 1, background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Multiple Products / Variants Confirmation Card */}
                    {msg.multipleConfirmationCard && (
                      <div style={{ marginTop: "10px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "10px", padding: "10px" }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--teal)", marginBottom: "6px" }}>
                          Extracted {msg.multipleConfirmationCard.items.length} Entries:
                        </div>
                        <div style={{ maxHeight: "100px", overflowY: "auto", fontSize: "11px", display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                          {msg.multipleConfirmationCard.items.map((item, idx) => (
                            <div key={idx} style={{ display: "flex", justifySelf: "space-between", justifyContent: "space-between" }}>
                              <span>• {item.name} ({item.variantLabel})</span>
                              <span style={{ fontWeight: 700, color: "var(--teal)" }}>₱{item.retailPrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <button
                            type="button"
                            onClick={() => handleConfirmMultipleMode(msg.id, msg.multipleConfirmationCard!.items, "single_with_variants")}
                            style={{ background: "var(--teal-soft)", color: "var(--teal)", border: "1px solid var(--teal-soft)", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", textAlign: "center" }}
                          >
                            Single item with multiple variants
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmMultipleMode(msg.id, msg.multipleConfirmationCard!.items, "multiple_single_items")}
                            style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: "6px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", textAlign: "center" }}
                          >
                            Multiple separate single items
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelCard(msg.id)}
                            style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red-soft)", borderRadius: "6px", padding: "5px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", textAlign: "center" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "12px" }}>
                  <Loader2 width="14" height="14" className="animate-spin" />
                  Analyzing product details...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Image Selected Bar */}
            {selectedImage && (
              <div
                style={{
                  padding: "6px 12px",
                  background: "var(--paper)",
                  borderTop: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <img
                    src={selectedImage.previewUrl}
                    alt="Selected"
                    style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "cover" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Photo attached</span>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}
                >
                  <X width="14" height="14" />
                </button>
              </div>
            )}

            {/* Input Footer */}
            <div
              style={{
                padding: "10px",
                background: "var(--paper)",
                borderTop: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo/receipt"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "8px",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ImageIcon width="16" height="16" />
              </button>
              <input
                type="text"
                placeholder="e.g. Sprite 1.5L ₱65 retail ₱55 wholesale"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || (!inputText.trim() && !selectedImage)}
                style={{
                  background: "var(--teal)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading || (!inputText.trim() && !selectedImage) ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Send width="14" height="14" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
