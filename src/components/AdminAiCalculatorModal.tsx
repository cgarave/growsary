"use client";

import React, { useState, useRef } from "react";
import { Calculator, Upload, X, Loader2, RefreshCw, CheckCircle2, Download, Camera } from "lucide-react";
import { processAiCalculatorAction, CalculatorItem } from "@/app/ai-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toPng } from "html-to-image";

interface AdminAiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dedicated Admin AI Calculator Modal Component
 * 
 * Purpose:
 * Provides a clean, standalone modal specifically for analyzing photos (price lists, receipts, tally sheets)
 * and calculating the sum of numbers located exclusively on the RIGHT side of the photo.
 * 
 * Features:
 * - Uses Tailwind CSS for all styling (dark mode compatible, smooth transitions).
 * - Instant image preview with canvas compression before sending to Gemini API.
 * - Extracts and lists right-side numbers with an editable total sum breakdown.
 * - Includes a "Save as Screenshot" button at the bottom to download the calculation result.
 * - Fully commented for easy code review.
 */
export default function AdminAiCalculatorModal({
  isOpen,
  onClose,
}: AdminAiCalculatorModalProps) {
  // State management for uploaded image, loading indicator, saving screenshot, and parsed calculation results
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [items, setItems] = useState<CalculatorItem[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [replyText, setReplyText] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  /**
   * File Selection Handler:
   * Compresses user-uploaded image using Canvas 2D to max 1024x1024 to keep payload lightweight.
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
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

        // Reset previous calculation state when new image is picked
        setItems([]);
        setTotalSum(0);
        setReplyText("");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  /**
   * Action Handler: Triggers Gemini 3.1 Flash Lite API to extract right-side numbers only
   */
  const handleCalculateRightNumbers = async () => {
    if (!selectedImage) {
      toast.error("Please upload or take a photo first");
      return;
    }

    setIsLoading(true);
    try {
      const result = await processAiCalculatorAction({
        imageBase64: selectedImage.base64,
        imageMimeType: selectedImage.mimeType,
      });

      if (result.success) {
        setItems(result.items);
        setTotalSum(result.totalSum);
        setReplyText(result.reply);
        toast.success(`Total Right-Side Sum: ₱${result.totalSum.toFixed(2)}`);
      } else {
        toast.error(result.reply || "Failed to calculate right-side numbers");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing image calculation");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Screenshot Download Handler:
   * Captures the calculator modal container as a PNG image and downloads it to the user's device.
   */
  const handleSaveScreenshot = async () => {
    if (!modalCardRef.current) return;

    setIsCapturingScreenshot(true);
    try {
      // Generate PNG data URL from modal DOM node
      const dataUrl = await toPng(modalCardRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      // Create download link element and trigger download
      const link = document.createElement("a");
      link.download = `growsary-calculator-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Screenshot saved to downloads!");
    } catch (err: any) {
      console.error("Screenshot capture failed:", err);
      toast.error("Failed to generate screenshot image.");
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  /**
   * Reset Handler: Clears image and calculation state for next photo
   */
  const handleReset = () => {
    setSelectedImage(null);
    setItems([]);
    setTotalSum(0);
    setReplyText("");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Standalone Modal Card Container */}
      <div
        ref={modalCardRef}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* Header Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">AI Photo Calculator</h3>
              <p className="text-[11px] text-teal-100 font-medium">Sums numbers on the right side of your photo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* Photo Upload Zone / Preview Container */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />

          {!selectedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-zinc-50 dark:bg-zinc-850 hover:bg-teal-50/30 group"
            >
              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Upload or Take Photo of Prices / Receipt
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                AI will scan and calculate numbers listed on the <strong className="text-teal-600 dark:text-teal-400">RIGHT side</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Preview & Change Photo Bar */}
              <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
                <img
                  src={selectedImage.previewUrl}
                  alt="Selected prices list"
                  className="w-full max-h-48 object-contain"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 hover:bg-zinc-900 text-white rounded-full transition-colors cursor-pointer shadow-md"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Trigger Button */}
              {items.length === 0 && (
                <Button
                  onClick={handleCalculateRightNumbers}
                  disabled={isLoading}
                  className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
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

          {/* Results Display Section */}
          {items.length > 0 && (
            <div className="space-y-3 pt-2 animate-in fade-in duration-300">
              
              <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-teal-200/60 dark:border-teal-900/60 pb-2">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" /> Right-Side Numbers Extracted
                  </span>
                  <span className="text-[10px] bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">
                    {items.length} entries
                  </span>
                </div>

                {/* Right-side items list breakdown */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-teal-100 dark:border-teal-900/40 last:border-0"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                        • {item.name}
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        ₱{item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Grand Total Display */}
                <div className="pt-2 border-t border-teal-300 dark:border-teal-800 flex items-center justify-between font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                  <span>Grand Total (Right Side):</span>
                  <span className="text-teal-600 dark:text-teal-400 text-lg">
                    ₱{totalSum.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Retake / Upload Another Photo Button */}
              <button
                onClick={handleReset}
                className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Upload / Scan Another Photo
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer Bar with Save as Screenshot Button */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-850 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleSaveScreenshot}
            disabled={isCapturingScreenshot}
            className="text-xs font-bold px-3 py-1.5 border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 dark:bg-teal-950 dark:border-teal-900 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download PNG screenshot of this calculation"
          >
            {isCapturingScreenshot ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-teal-600" />
                Save as Screenshot
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold px-4 py-1.5 border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer"
          >
            Close
          </Button>
        </div>

      </div>
    </div>
  );
}
