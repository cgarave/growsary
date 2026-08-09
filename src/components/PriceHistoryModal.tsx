"use client";

import React, { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, History } from "lucide-react";
import { getPriceHistoryAction } from "@/app/actions";

interface PriceLogItem {
  id: string;
  type: "RETAIL" | "WHOLESALE";
  amount: number;
  effectiveFrom: string;
}

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  variantLabel: string;
  variantId: string;
  currentRetail: number;
  currentWholesale: number;
  isAdmin?: boolean;
}

export default function PriceHistoryModal({
  isOpen,
  onClose,
  productName,
  variantLabel,
  variantId,
  currentRetail,
  currentWholesale,
  isAdmin = false,
}: PriceHistoryModalProps) {
  const [history, setHistory] = useState<PriceLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !variantId) return;

    setLoading(true);
    getPriceHistoryAction(variantId)
      .then((data) => {
        setHistory(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, variantId]);

  if (!isOpen) return null;

  const profitAmt = currentRetail - currentWholesale;
  const marginPct =
    currentWholesale > 0
      ? ((profitAmt / currentWholesale) * 100).toFixed(1)
      : "0";

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: "460px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <History width="16" height="16" color="var(--teal)" />
              <h3 style={{ margin: 0 }}>Price History Log</h3>
            </div>
            <div className="sub" style={{ margin: "2px 0 0" }}>
              {productName} — <strong>{variantLabel}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
            }}
          >
            <X width="16" height="16" />
          </button>
        </div>

        {/* Current Margin & Profit Summary Box (Admin Only) */}
        {isAdmin && (
          <div
            style={{
              background: "var(--teal-soft)",
              border: "1px solid var(--teal)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Current Profit & Margin
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 600, marginTop: "3px" }}>
                Retail: ₱{currentRetail.toFixed(2)} | Wholesale: ₱{currentWholesale.toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--teal)", fontFamily: "'IBM Plex Mono', monospace" }}>
                +₱{profitAmt.toFixed(2)}
              </div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--teal)", opacity: 0.9 }}>
                ({marginPct}% margin)
              </div>
            </div>
          </div>
        )}

        {/* Timeline Log in Variant Cards */}
        {loading ? (
          <div className="text-center py-8 text-xs text-[var(--muted)]">Loading price logs…</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--muted)]">No price log history recorded yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "50vh", overflowY: "auto" }}>
            {history.map((item, idx) => {
              const prevItem = history[idx + 1];
              const isIncrease = prevItem ? item.amount > prevItem.amount : false;
              const isDecrease = prevItem ? item.amount < prevItem.amount : false;
              const diff = prevItem ? item.amount - prevItem.amount : 0;

              return (
                <div
                  key={item.id}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        background: item.type === "RETAIL" ? "var(--teal-soft)" : "var(--amber-soft)",
                        color: item.type === "RETAIL" ? "var(--teal)" : "var(--amber)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {item.type === "RETAIL" ? "R" : "W"}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{variantLabel}</span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: item.type === "RETAIL" ? "var(--teal-soft)" : "var(--amber-soft)",
                            color: item.type === "RETAIL" ? "var(--teal)" : "var(--amber)",
                          }}
                        >
                          {item.type}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                        {new Date(item.effectiveFrom).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: item.type === "RETAIL" ? "var(--teal)" : "var(--amber)",
                      }}
                    >
                      ₱{item.amount.toFixed(2)}
                    </div>
                    {prevItem && (
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: isIncrease ? "var(--teal)" : isDecrease ? "var(--red)" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "2px",
                          marginTop: "2px",
                        }}
                      >
                        {isIncrease && <TrendingUp width="12" height="12" />}
                        {isDecrease && <TrendingDown width="12" height="12" />}
                        {isIncrease ? "+" : ""}₱{diff.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: "14px" }}>
          <button type="button" className="cancel" onClick={onClose} style={{ width: "100%" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
