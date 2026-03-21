"use client";

interface Action {
  label: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "ghost";
}

export default function MagiActionBar({ actions }: { actions: Action[] }) {
  return (
    <div className="flex items-center gap-2 pt-4 border-t border-border/30">
      {actions.map((a) => {
        const base =
          "px-3 py-1.5 text-[8px] font-bold tracking-wider transition-colors";
        const variants: Record<string, string> = {
          primary: "text-eva border border-eva/40 hover:bg-eva/10",
          danger: "text-danger border border-danger/40 hover:bg-danger/10",
          ghost: "text-text-dim hover:text-text border border-border/40 hover:border-border",
        };
        return (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`${base} ${variants[a.variant || "ghost"]}`}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
