"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, X, RefreshCw } from "lucide-react";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      return;
    }

    setErrorMsg(null);
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    async function startScanning() {
      try {
        if (!videoRef.current) return;

        const controls = await codeReader.decodeFromVideoDevice(
          undefined, // auto pick device or environment camera
          videoRef.current,
          (result, error) => {
            if (result) {
              const text = result.getText();
              onScanSuccess(text);
              if (controlsRef.current) {
                controlsRef.current.stop();
                controlsRef.current = null;
              }
              onClose();
            }
          }
        );

        controlsRef.current = controls;
      } catch (err) {
        console.error("Camera access error:", err);
        setErrorMsg("Unable to access camera. Please ensure camera permissions are granted.");
      }
    }

    startScanning();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [isOpen, facingMode, onClose, onScanSuccess]);

  if (!isOpen) return null;

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal" style={{ maxWidth: "420px", padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px font-bold" }}>Scan Barcode</h3>
            <div className="sub" style={{ margin: 0, fontSize: "12px" }}>
              Point your camera at a product barcode
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

        {errorMsg ? (
          <div
            style={{
              background: "var(--red-soft)",
              color: "var(--red)",
              padding: "14px",
              borderRadius: "9px",
              fontSize: "12.5px",
              textAlign: "center",
              margin: "12px 0",
            }}
          >
            {errorMsg}
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/3",
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Viewfinder Bounding Overlay */}
            <div
              style={{
                position: "absolute",
                width: "75%",
                height: "50%",
                border: "2px dashed #215A4C",
                borderRadius: "10px",
                boxShadow: "0 0 0 4000px rgba(0,0,0,0.45)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
          <button
            type="button"
            className="cancel"
            onClick={toggleCamera}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: "9px",
              fontSize: "12.5px",
              fontWeight: 700,
              border: "1px solid var(--line)",
              background: "var(--paper)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <RefreshCw width="14" height="14" />
            Switch Camera
          </button>
          <button
            type="button"
            className="cancel"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: "9px",
              fontSize: "12.5px",
              fontWeight: 700,
              border: "1px solid var(--line)",
              background: "var(--card)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
