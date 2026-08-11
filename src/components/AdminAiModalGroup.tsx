"use client";

import React, { useState, useRef } from "react";
import { Sparkles, Calculator, X, Upload, Download, RefreshCw, CheckCircle2, Loader2, Bot, Send, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
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

interface AdminAiModalGroupProps {
  existingCategories: string[];
}

/**
 * Unified Admin AI Modal Group Component
 * 
 * Features:
 * - Single modal with a top Segmented Button Group to toggle between AI Chatbot and AI Calculator modes.
 * - Uses ShadCN Message, MessageContent, MessageAvatar, and MessageScroller components.
 * - Styled 100% strictly with Tailwind CSS.
 * - Fully documented with comments for code review.
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
  // AI Calculator State & Logic
  // ---------------------------------------------------------------------------
  const [calcSelectedImage, setCalcSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isCalcLoading, setIsCalcLoading] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [calcItems, setCalcItems] = useState<CalculatorItem[]>([]);
  const [calcTotalSum, setCalcTotalSum] = useState<number>(0);
  const calcFileInputRef = useRef<HTMLInputElement>(null);
  const calcCardRef = useRef<HTMLDivElement>(null);

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
        setCalcSelectedImage({ base64: compressed.split(",")[1], mimeType: "image/jpeg", previewUrl: compressed });
        setCalcItems([]);
        setCalcTotalSum(0);
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

  const handleSaveCalcScreenshot = async () => {
    if (!calcCardRef.current) return;
    setIsCapturingScreenshot(true);
    try {
      const dataUrl = await toPng(calcCardRef.current, { cacheBust: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `growsary-calculator-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Screenshot downloaded!");
    } catch (err) {
      toast.error("Failed to capture screenshot");
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  return (
    <>
      {/* Trigger Button Component */}
      <Button
        variant="outline"
        className="border-teal-200 bg-teal-50/60 hover:bg-teal-100/60 text-teal-700 dark:text-teal-300 dark:bg-teal-950 dark:border-teal-900 rounded-[9px] text-xs font-semibold"
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
                {/* Joined Segmented Button Group to Switch Features */}
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

              {/* Top Close Button */}
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

                {/* Chatbot Image Attachment Indicator */}
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

                {/* Chat Input Bar */}
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
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: AI CALCULATOR MODE */}
            {activeTab === "calculator" && (
              <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-zinc-50 dark:bg-zinc-950">
                <input
                  type="file"
                  accept="image/*"
                  ref={calcFileInputRef}
                  onChange={handleCalcImageSelect}
                  className="hidden"
                />

                <div ref={calcCardRef} className="space-y-4">
                  {!calcSelectedImage ? (
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
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
                        <img src={calcSelectedImage.previewUrl} alt="Prices list" className="w-full max-h-44 object-contain" />
                        <button
                          onClick={() => { setCalcSelectedImage(null); setCalcItems([]); setCalcTotalSum(0); }}
                          className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 hover:bg-zinc-900 text-white rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {calcItems.length === 0 && (
                        <Button
                          onClick={handleCalculateRightNumbers}
                          disabled={isCalcLoading}
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2"
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
                  )}

                  {/* Calculator Extracted Results Breakdown Card */}
                  {calcItems.length > 0 && (
                    <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Right-Side Extracted Items
                        </span>
                        <span className="text-[10px] bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">
                          {calcItems.length} entries
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {calcItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">• {item.name}</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">₱{item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        <span>Grand Total Sum (Right Side):</span>
                        <span className="text-teal-600 text-lg">₱{calcTotalSum.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Calculator Action Footer */}
                {calcItems.length > 0 && (
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSaveCalcScreenshot}
                      disabled={isCapturingScreenshot}
                      className="flex-1 text-xs font-bold border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 dark:bg-teal-950 dark:border-teal-900 rounded-xl"
                    >
                      {isCapturingScreenshot ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                          Save as Screenshot
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setCalcSelectedImage(null); setCalcItems([]); setCalcTotalSum(0); }}
                      className="text-xs font-semibold border-zinc-300 rounded-xl"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Reset
                    </Button>
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
