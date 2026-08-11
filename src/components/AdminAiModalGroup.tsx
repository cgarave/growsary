"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Calculator, X, Upload, RefreshCw, CheckCircle2, Loader2, Send, Image as ImageIcon, Bookmark, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Message, MessageContent, MessageAvatar, MessageScroller } from "@/components/ui/message";
import { processAiProductMessageAction, processAiCalculatorAction, ParsedProductAI, ParsedProductItem, CalculatorItem } from "@/app/ai-actions";

interface ChatMessageItem {
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
}

/** Saved Memory Entry Structure for AI Calculator (without base64 image) */
export interface SavedCalculatorMemory {
  id: string;
  date: string;
  items: CalculatorItem[];
  totalSum: number;
}

interface AdminAiModalGroupProps {
  existingCategories: string[];
}

/** LocalStorage keys */
const CALCULATOR_STORAGE_KEY = "growsary_admin_calculator_state";
const SAVED_MEMORIES_STORAGE_KEY = "growsary_admin_calculator_memories";
const MAX_MEMORIES = 5;

/**
 * Unified Admin AI Modal Group Component
 * 
 * Features:
 * - Single modal with a top Segmented Button Group to toggle between AI Chatbot and AI Calculator modes.
 * - Uses ShadCN Message, MessageContent, MessageAvatar, and MessageScroller components.
 * - Persistent Calculator Active State & Saved Memories (max 5 saved calculations in localStorage).
 * - "Save for later" (left) & "Reset" (right) button pair.
 * - "Delete Memory" button when viewing/inspecting a saved memory.
 * - Styled 100% strictly with Tailwind CSS and fully commented.
 */
export default function AdminAiModalGroup({ existingCategories }: AdminAiModalGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chatbot" | "calculator">("chatbot");

  // ---------------------------------------------------------------------------
  // AI Chatbot State & Logic
  // ---------------------------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "👋 Hi Admin! I can help you add products instantly or update prices for existing variants. Try uploading a photo or typing 'update price of Coca-Cola'!",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [chatSelectedImage, setChatSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // AI Calculator State & Saved Memories
  // ---------------------------------------------------------------------------
  const [calcSelectedImage, setCalcSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isCalcLoading, setIsCalcLoading] = useState(false);
  const [calcItems, setCalcItems] = useState<CalculatorItem[]>([]);
  const [calcTotalSum, setCalcTotalSum] = useState<number>(0);
  const [savedMemories, setSavedMemories] = useState<SavedCalculatorMemory[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);

  const calcFileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Load Active Calculator State & Saved Memories from LocalStorage
   */
  useEffect(() => {
    try {
      // 1. Active state
      const savedStateStr = localStorage.getItem(CALCULATOR_STORAGE_KEY);
      if (savedStateStr) {
        const saved = JSON.parse(savedStateStr);
        if (saved.calcItems && Array.isArray(saved.calcItems)) {
          setCalcItems(saved.calcItems);
        }
        if (typeof saved.calcTotalSum === "number") {
          setCalcTotalSum(saved.calcTotalSum);
        }
        if (saved.calcSelectedImage) {
          setCalcSelectedImage(saved.calcSelectedImage);
        }
        if (saved.activeMemoryId) {
          setActiveMemoryId(saved.activeMemoryId);
        }
      }

      // 2. Saved Memories list
      const savedMemoriesStr = localStorage.getItem(SAVED_MEMORIES_STORAGE_KEY);
      if (savedMemoriesStr) {
        const list = JSON.parse(savedMemoriesStr);
        if (Array.isArray(list)) {
          setSavedMemories(list);
        }
      }
    } catch (e) {
      console.error("Failed to load calculator state from localStorage:", e);
    }
  }, []);

  /**
   * Auto-compute total sum whenever items array changes & persist current work to LocalStorage
   */
  useEffect(() => {
    const computedTotal = calcItems.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.qty || 1), 0);
    setCalcTotalSum(computedTotal);

    if (calcItems.length > 0 || calcSelectedImage) {
      try {
        localStorage.setItem(
          CALCULATOR_STORAGE_KEY,
          JSON.stringify({
            calcItems,
            calcTotalSum: computedTotal,
            calcSelectedImage,
            activeMemoryId,
          })
        );
      } catch (e) {
        console.error("Failed to save active calculator state:", e);
      }
    }
  }, [calcItems, calcSelectedImage, activeMemoryId]);

  // ---------------------------------------------------------------------------
  // Chatbot Handlers
  // ---------------------------------------------------------------------------
  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
        else if (h > MAX) { w *= MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        setChatSelectedImage({ base64: compressed.split(",")[1], mimeType: "image/jpeg", previewUrl: compressed });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSendChatMessage = async (textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : inputText;
    if (!textToSend.trim() && !chatSelectedImage) return;

    const userMsg: ChatMessageItem = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      imagePreview: chatSelectedImage?.previewUrl,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (textOverride === undefined) setInputText("");

    const currentImage = chatSelectedImage;
    setChatSelectedImage(null);
    setIsChatLoading(true);

    try {
      const aiResponse = await processAiProductMessageAction({
        message: textToSend,
        imageBase64: currentImage?.base64,
        imageMimeType: currentImage?.mimeType,
      });

      const aiMsg: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiResponse.reply,
        confirmationCard: aiResponse.product ? { product: aiResponse.product } : undefined,
        multipleConfirmationCard: aiResponse.multipleProducts ? { items: aiResponse.multipleProducts } : undefined,
        priceUpdateCard: aiResponse.updateTarget ? {
          productId: aiResponse.updateTarget.productId,
          productName: aiResponse.updateTarget.productName,
          brand: aiResponse.updateTarget.brand,
          categoryName: aiResponse.updateTarget.categoryName,
          variantSelections: aiResponse.updateTarget.variants.map((v) => ({
            variantId: v.id,
            label: v.label,
            currentRetail: v.retailPrice,
            currentWholesale: v.wholesalePrice,
            updateRetail: false,
            updateWholesale: false,
            newRetailPrice: aiResponse.updateTarget?.suggestedNewPrices?.newRetailPrice ?? v.retailPrice,
            newWholesalePrice: aiResponse.updateTarget?.suggestedNewPrices?.newWholesalePrice ?? v.wholesalePrice,
          })),
        } : undefined,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      toast.error(err.message || "Failed to process chat request");
    } finally {
      setIsChatLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculator Handlers
  // ---------------------------------------------------------------------------
  const handleCalcImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
        else if (h > MAX) { w *= MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        const newImgState = { base64: compressed.split(",")[1], mimeType: "image/jpeg", previewUrl: compressed };
        setCalcSelectedImage(newImgState);
        setCalcItems([]);
        setCalcTotalSum(0);
        setActiveMemoryId(null);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCalculateRightNumbers = async () => {
    if (!calcSelectedImage) {
      toast.error("Please upload or take a photo first");
      return;
    }

    setIsCalcLoading(true);
    try {
      const res = await processAiCalculatorAction({
        imageBase64: calcSelectedImage.base64,
        imageMimeType: calcSelectedImage.mimeType,
      });

      if (res.success) {
        setCalcItems(res.items);
        setCalcTotalSum(res.totalSum);
        setActiveMemoryId(null);
        toast.success(`Calculated Right-Side Total: ₱${res.totalSum.toFixed(2)}`);
      } else {
        toast.error(res.reply || "Failed to calculate numbers");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing image calculation");
    } finally {
      setIsCalcLoading(false);
    }
  };

  /** Inline Edit Handler for Calculator Items */
  const handleItemFieldChange = (index: number, field: "name" | "price", value: string | number) => {
    setCalcItems((prev) => {
      const updated = [...prev];
      if (field === "price") {
        updated[index] = { ...updated[index], price: typeof value === "number" ? value : parseFloat(value) || 0 };
      } else {
        updated[index] = { ...updated[index], name: String(value) };
      }
      return updated;
    });
  };

  /** Reset Active Calculator Workspace */
  const handleResetCalculator = () => {
    setCalcSelectedImage(null);
    setCalcItems([]);
    setCalcTotalSum(0);
    setActiveMemoryId(null);
    try {
      localStorage.removeItem(CALCULATOR_STORAGE_KEY);
      toast.info("Calculator reset.");
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
  };

  /**
   * Save Memory for Later Handler
   * Saves only items breakdown and total sum (no base64 image). Limit max 5 items.
   */
  const handleSaveForLater = () => {
    if (calcItems.length === 0) {
      toast.error("No calculation results to save.");
      return;
    }

    if (savedMemories.length >= MAX_MEMORIES) {
      toast.error(`Memory limit reached (${MAX_MEMORIES} max). Please delete at least one memory to save a new one.`);
      return;
    }

    const newMemory: SavedCalculatorMemory = {
      id: `mem-${Date.now()}`,
      date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      items: calcItems,
      totalSum: calcTotalSum,
    };

    const updatedMemories = [newMemory, ...savedMemories];
    setSavedMemories(updatedMemories);
    setActiveMemoryId(newMemory.id);

    try {
      localStorage.setItem(SAVED_MEMORIES_STORAGE_KEY, JSON.stringify(updatedMemories));
      toast.success("Saved calculation to local memory!");
    } catch (e) {
      toast.error("Failed to save memory.");
    }
  };

  /**
   * Load Saved Memory into Active Calculator View
   */
  const handleLoadMemory = (mem: SavedCalculatorMemory) => {
    setCalcItems(mem.items);
    setCalcTotalSum(mem.totalSum);
    setCalcSelectedImage(null);
    setActiveMemoryId(mem.id);
    toast.info(`Loaded memory from ${mem.date}`);
  };

  /**
   * Delete Specific Saved Memory Handler
   */
  const handleDeleteMemory = (memId: string) => {
    const updated = savedMemories.filter((m) => m.id !== memId);
    setSavedMemories(updated);

    if (activeMemoryId === memId) {
      setActiveMemoryId(null);
      setCalcItems([]);
      setCalcTotalSum(0);
    }

    try {
      localStorage.setItem(SAVED_MEMORIES_STORAGE_KEY, JSON.stringify(updated));
      toast.success("Deleted memory entry.");
    } catch (e) {
      console.error("Failed to update saved memories:", e);
    }
  };

  return (
    <>
      {/* Trigger Button Component */}
      <Button
        variant="outline"
        className="border-teal-200 bg-teal-50/60 hover:bg-teal-100/60 text-teal-700 dark:text-teal-300 dark:bg-teal-950 dark:border-teal-900 rounded-[9px] text-xs font-semibold cursor-pointer"
        onClick={() => setIsOpen(true)}
        title="Growsary AI Hub (Assistant & Photo Calculator)"
      >
        <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-600" />
        AI Hub
      </Button>

      {/* Unified AI Modal Container */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[85vh] max-h-[640px]">
            
            {/* Modal Top Header with Joined Segmented Button Group */}
            <div className="px-4 py-3 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ButtonGroup className="bg-zinc-800 p-0.5 rounded-xl">
                  <Button
                    size="sm"
                    variant={activeTab === "chatbot" ? "default" : "ghost"}
                    onClick={() => setActiveTab("chatbot")}
                    className={
                      activeTab === "chatbot"
                        ? "bg-teal-600 text-white font-bold text-xs shadow-xs"
                        : "text-zinc-400 hover:text-white text-xs"
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    AI Assistant
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "calculator" ? "default" : "ghost"}
                    onClick={() => setActiveTab("calculator")}
                    className={
                      activeTab === "calculator"
                        ? "bg-teal-600 text-white font-bold text-xs shadow-xs"
                        : "text-zinc-400 hover:text-white text-xs"
                    }
                  >
                    <Calculator className="w-3.5 h-3.5 mr-1.5" />
                    AI Calculator
                  </Button>
                </ButtonGroup>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white cursor-pointer"
                title="Close AI Hub"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB 1: AI CHATBOT MODE (ShadCN Message & MessageScroller) */}
            {activeTab === "chatbot" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                <MessageScroller>
                  {chatMessages.map((msg) => (
                    <Message key={msg.id} sender={msg.sender}>
                      {msg.sender === "ai" && <MessageAvatar fallback="AI" />}
                      <MessageContent sender={msg.sender}>
                        {msg.imagePreview && (
                          <img
                            src={msg.imagePreview}
                            alt="Uploaded preview"
                            className="w-full h-auto rounded-lg mb-1.5"
                          />
                        )}
                        <div className="whitespace-pre-line">{msg.text}</div>
                      </MessageContent>
                    </Message>
                  ))}
                  {isChatLoading && (
                    <Message sender="ai">
                      <MessageAvatar fallback="AI" />
                      <MessageContent sender="ai">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          Analyzing request...
                        </div>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScroller>

                {chatSelectedImage && (
                  <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={chatSelectedImage.previewUrl} alt="Attachment" className="w-6 h-6 rounded object-cover" />
                      <span className="text-[11px] text-zinc-500">Photo attached</span>
                    </div>
                    <button onClick={() => setChatSelectedImage(null)} className="text-red-500 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="p-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={chatFileInputRef}
                    onChange={handleChatImageSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => chatFileInputRef.current?.click()}
                    className="shrink-0 border-zinc-300 dark:border-zinc-700"
                    title="Attach photo"
                  >
                    <ImageIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </Button>

                  <input
                    type="text"
                    placeholder="e.g. Sprite 1.5L ₱65 retail ₱55 wholesale"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    disabled={isChatLoading}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-600"
                  />

                  <Button
                    type="button"
                    onClick={() => handleSendChatMessage()}
                    disabled={isChatLoading || (!inputText.trim() && !chatSelectedImage)}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: AI CALCULATOR MODE (With Saved Memories Max 5, Save for Later & Delete Memory) */}
            {activeTab === "calculator" && (
              <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-zinc-50 dark:bg-zinc-950">
                <input
                  type="file"
                  accept="image/*"
                  ref={calcFileInputRef}
                  onChange={handleCalcImageSelect}
                  className="hidden"
                />

                {/* Saved Memories Quick Bar (Max 5) */}
                {savedMemories.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                        <Bookmark className="w-3.5 h-3.5" /> Saved Calculator Memories
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {savedMemories.length}/{MAX_MEMORIES} used
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {savedMemories.map((mem) => {
                        const isSelected = activeMemoryId === mem.id;
                        return (
                          <button
                            key={mem.id}
                            onClick={() => handleLoadMemory(mem)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? "bg-teal-600 text-white shadow-xs"
                                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            <Clock className="w-3 h-3 opacity-70" />
                            <span>₱{mem.totalSum.toFixed(2)}</span>
                            <span className="text-[10px] opacity-75">({mem.items.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  {!calcSelectedImage && !activeMemoryId && calcItems.length === 0 ? (
                    <div
                      onClick={() => calcFileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-teal-500 rounded-2xl p-6 text-center cursor-pointer bg-white dark:bg-zinc-900 transition-all group"
                    >
                      <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Upload or Take Photo of Prices / Receipt
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        AI will scan and calculate numbers listed on the <strong className="text-teal-600">RIGHT side</strong>
                      </p>
                    </div>
                  ) : (
                    calcSelectedImage && (
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
                          <img src={calcSelectedImage.previewUrl} alt="Prices list" className="w-full max-h-40 object-contain" />
                          <button
                            onClick={handleResetCalculator}
                            className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 hover:bg-zinc-900 text-white rounded-full cursor-pointer"
                            title="Clear photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {calcItems.length === 0 && (
                          <Button
                            onClick={handleCalculateRightNumbers}
                            disabled={isCalcLoading}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isCalcLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Scanning right-side numbers...
                              </>
                            ) : (
                              <>
                                <Calculator className="w-4 h-4" />
                                Calculate Right-Side Numbers
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  )}

                  {/* Calculator Extracted Results Breakdown Card with Editable Prices */}
                  {calcItems.length > 0 && (
                    <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Right-Side Extracted Items (Editable)
                        </span>
                        <span className="text-[10px] bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">
                          {calcItems.length} entries
                        </span>
                      </div>

                      {/* Interactive Editable Items List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {calcItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleItemFieldChange(idx, "name", e.target.value)}
                              className="flex-1 font-medium text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-teal-500 focus:outline-none px-1 py-0.5 rounded text-xs"
                            />
                            <div className="flex items-center gap-1 font-bold text-zinc-900 dark:text-zinc-100">
                              <span>₱</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => handleItemFieldChange(idx, "price", parseFloat(e.target.value) || 0)}
                                className="w-20 text-right font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-teal-500 text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Dynamic Grand Total Display (Auto Updates on Price Change) */}
                      <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        <span>Grand Total Sum (Right Side):</span>
                        <span className="text-teal-600 dark:text-teal-400 text-lg">₱{calcTotalSum.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Calculator Action Footer: "Save for later" (Left) | "Reset" (Right) */}
                {calcItems.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {/* Left: Save for later button */}
                      <Button
                        variant="outline"
                        onClick={handleSaveForLater}
                        className="flex-1 text-xs font-bold border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 dark:bg-teal-950 dark:border-teal-900 rounded-xl cursor-pointer"
                        title="Save calculation result to local memories"
                      >
                        <Bookmark className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                        Save for later
                      </Button>

                      {/* Right: Reset button */}
                      <Button
                        variant="outline"
                        onClick={handleResetCalculator}
                        className="flex-1 text-xs font-semibold border-zinc-300 rounded-xl cursor-pointer text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Reset current calculator view"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                        Reset
                      </Button>
                    </div>

                    {/* Delete Memory Button appears when a saved memory is currently loaded */}
                    {activeMemoryId && (
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteMemory(activeMemoryId)}
                        className="w-full text-xs font-bold text-red-600 border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:border-red-900 rounded-xl cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete Saved Memory
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}


