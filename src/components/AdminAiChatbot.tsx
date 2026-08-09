"use client";

import React, { useState, useRef } from "react";
import { Bot, Send, Image as ImageIcon, X, Loader2, Sparkles } from "lucide-react";
import { processAiProductMessageAction, ParsedProductAI } from "@/app/ai-actions";
import { toast } from "sonner";

interface MessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  imagePreview?: string;
  pendingCategoryClarification?: {
    product: ParsedProductAI["product"];
    suggestedCategory: string;
  };
}

interface AdminAiChatbotProps {
  existingCategories: string[];
}

export default function AdminAiChatbot({ existingCategories }: AdminAiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "👋 Hi Admin! I can help you add products instantly. Describe the product (name, brand, prices, size/variant) or upload a photo/receipt of the item!",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(",")[1];
      setSelectedImage({
        base64: base64Data,
        mimeType: file.type,
        previewUrl: resultStr,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (customMessage?: string, categoryChoice?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : inputText;
    if (!textToSend.trim() && !selectedImage && !categoryChoice) return;

    const userMsgId = `usr-${Date.now()}`;
    if (!customMessage?.startsWith("CONFIRM_PRODUCT_CREATE:")) {
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
        categoryChoice,
      });

      const aiMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: result.reply,
      };

      if (result.action === "clarify_category" && result.product && result.categoryName) {
        aiMsg.pendingCategoryClarification = {
          product: result.product,
          suggestedCategory: result.categoryName,
        };
      }

      setMessages((prev) => [...prev, aiMsg]);
      if (result.action === "create_product") {
        toast.success("Product added by AI!");
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

  const handleConfirmCategoryChoice = (categoryName: string, product: ParsedProductAI["product"]) => {
    if (!product) return;
    const confirmMessage = `CONFIRM_PRODUCT_CREATE:${JSON.stringify(product)}`;
    handleSendMessage(confirmMessage, categoryName);
  };

  return (
    <>
      {/* AI Floating Action Button next to Add Item */}
      <button
        type="button"
        className="fab-ai"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "135px",
          height: "48px",
          padding: "0 18px",
          borderRadius: "24px",
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          color: "#ffffff",
          border: "none",
          boxShadow: "0 6px 20px rgba(168, 85, 247, 0.35)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "14px",
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 90,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <Sparkles width="18" height="18" />
        AI Assistant
      </button>

      {/* AI Chat Drawer / Modal */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "84px",
            right: "24px",
            width: "360px",
            maxHeight: "520px",
            height: "100%",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
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

                  {/* Category Clarification Options */}
                  {msg.pendingCategoryClarification && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>
                        Select a category to save:
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmCategoryChoice(
                            msg.pendingCategoryClarification!.suggestedCategory,
                            msg.pendingCategoryClarification!.product
                          )
                        }
                        style={{
                          background: "var(--teal-soft)",
                          color: "var(--teal)",
                          border: "1px solid var(--teal-soft)",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        ✨ Create new: &quot;{msg.pendingCategoryClarification.suggestedCategory}&quot;
                      </button>

                      {existingCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            handleConfirmCategoryChoice(cat, msg.pendingCategoryClarification!.product)
                          }
                          style={{
                            background: "var(--paper)",
                            color: "var(--ink)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          Use existing: &quot;{cat}&quot;
                        </button>
                      ))}
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
      )}
    </>
  );
}
