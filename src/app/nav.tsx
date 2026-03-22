"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "COMMAND", code: "01", icon: "◈" },
  { href: "/workouts", label: "TRAINING", code: "02", icon: "⬡" },
  { href: "/body", label: "BIOMETRICS", code: "03", icon: "◉" },
  { href: "/supplements", label: "PROTOCOLS", code: "04", icon: "⬢" },
  { href: "/bloodwork", label: "BLOODWORK", code: "05", icon: "◎" },
  { href: "/goals", label: "OBJECTIVES", code: "06", icon: "△" },
  { href: "/trends", label: "TRENDS", code: "07", icon: "▽" },
  { href: "/sleep", label: "SLEEP", code: "08", icon: "◆" },
  { href: "/nutrition", label: "NUTRITION", code: "09", icon: "⬡" },
  { href: "/log", label: "LOG", code: "10", icon: "▣" },
];

export function Nav() {
  const pathname = usePathname();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const time = new Date();
  const ts = time.toLocaleTimeString("en-US", { hour12: false });
  const uptime = `${String(Math.floor(tick / 3600)).padStart(2, "0")}:${String(Math.floor((tick % 3600) / 60)).padStart(2, "0")}:${String(tick % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-52 flex-col bg-void/95 border-r border-eva/15">
        {/* System header */}
        <div className="px-4 pt-5 pb-2">
          <div className="text-[8px] font-bold tracking-[0.3em] text-text-dim mb-0.5">
            MAGI SYSTEM v3.02
          </div>
          <div className="text-lg font-black tracking-tight eva-text">
            XACH<span className="text-text-dim font-normal text-[10px] mx-1">&gt;&gt;</span>
            <span className="neon-text text-sm font-bold">HEALTH</span>
          </div>
          <div className="h-px bg-gradient-to-r from-eva/40 via-eva/10 to-transparent mt-3" />
        </div>

        {/* Clock + uptime strip */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div>
            <div className="text-[7px] tracking-[0.2em] text-text-dim">SYS.TIME</div>
            <div className="text-[11px] font-bold text-eva tabular-nums" style={{ textShadow: "0 0 8px #FF6A0040" }}>
              {ts}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[7px] tracking-[0.2em] text-text-dim">UPTIME</div>
            <div className="text-[11px] font-bold text-neon/60 tabular-nums">
              {uptime}
            </div>
          </div>
        </div>

        <div className="h-px bg-border mx-4" />

        {/* Module label */}
        <div className="eva-label px-4 mt-3 mb-2 text-[8px]">▎ MODULES</div>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-0.5">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-2.5 py-2 text-[10px] font-bold tracking-[0.1em] transition-all duration-100 relative
                  ${active
                    ? "bg-eva/10 text-eva border-l-2 border-eva"
                    : "text-text-dim hover:text-eva/80 hover:bg-eva/5 border-l-2 border-transparent"
                  }
                `}
              >
                <span className={`text-[8px] tabular-nums ${active ? "text-eva" : "text-text-dim"}`}>
                  {item.code}
                </span>
                <span className="text-xs">{item.icon}</span>
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-eva status-dot" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* System status block */}
        <div className="p-3 border-t border-border">
          <div className="text-[7px] tracking-[0.2em] text-text-dim mb-2">SYSTEM STATUS</div>
          <div className="space-y-1.5">
            <StatusLine label="MAGI-01" status="NOMINAL" color="neon" />
            <StatusLine label="MAGI-02" status="NOMINAL" color="neon" />
            <StatusLine label="MAGI-03" status="STANDBY" color="eva" />
          </div>
          <div className="h-px bg-border mt-3 mb-2" />
          <div className="text-[7px] tracking-[0.15em] text-text-dim">
            CASPER · MELCHIOR · BALTHASAR
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden flex items-center justify-around h-14 bg-void/95 backdrop-blur-xl border-t border-eva/15 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
                active ? "text-eva" : "text-text-dim"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-[7px] font-bold tracking-[0.15em]">
                {item.label.slice(0, 5)}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function StatusLine({ label, status, color }: { label: string; status: string; color: "neon" | "eva" | "danger" }) {
  const dotColor = color === "neon" ? "bg-neon" : color === "eva" ? "bg-eva" : "bg-danger";
  const textColor = color === "neon" ? "text-neon/70" : color === "eva" ? "text-eva/70" : "text-danger/70";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <div className={`status-dot ${dotColor}`} />
        <span className="text-[8px] font-bold tracking-wider text-text-dim">{label}</span>
      </div>
      <span className={`text-[8px] font-bold tracking-wider ${textColor}`}>{status}</span>
    </div>
  );
}
