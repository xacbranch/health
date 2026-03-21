"use client";

import { useEffect, useRef } from "react";

interface MagiModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional width override */
  wide?: boolean;
}

export default function MagiModal({ open, onClose, title, children, wide }: MagiModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-start md:items-center justify-center p-0 md:p-6"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={`relative w-full h-full md:h-auto md:max-h-[85vh] ${wide ? "md:max-w-2xl" : "md:max-w-lg"} bg-void border border-eva/20 md:rounded-none overflow-y-auto`}
        style={{
          boxShadow: "0 0 40px #FF6A0010, 0 0 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-void/95 backdrop-blur-sm border-b border-eva/15">
          <div className="eva-label text-[8px]">▎ {title}</div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-text-dim hover:text-danger transition-colors text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
