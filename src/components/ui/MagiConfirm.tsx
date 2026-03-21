"use client";

import MagiModal from "./MagiModal";

interface MagiConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export default function MagiConfirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "CONFIRM",
  danger = false,
}: MagiConfirmProps) {
  return (
    <MagiModal open={open} onClose={onClose} title={title}>
      <div className="text-[10px] text-text leading-relaxed mb-6">
        {message}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors"
        >
          CANCEL
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-3 py-1.5 text-[8px] font-bold tracking-wider transition-colors ${
            danger
              ? "text-danger border border-danger/40 hover:bg-danger/10"
              : "text-eva border border-eva/40 hover:bg-eva/10"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </MagiModal>
  );
}
