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
      {/* AI Assistant Button Component */}
      <button
        type="button"
        className="ai-assistant-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          padding: "8px 14px",
          borderRadius: "9px",
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          color: "#ffffff",
          border: "none",
          boxShadow: "0 2px 8px rgba(168, 85, 247, 0.25)",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12.5px",
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "transform 0.15s ease, opacity 0.15s ease",
        }}
      >
        <Sparkles width="15" height="15" />
        AI Assistant
      </button>

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
      </div>
      )}
    </>
  );
}
