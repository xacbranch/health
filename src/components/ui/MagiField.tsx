"use client";

import { useId } from "react";

/* ─── Shared label ─── */
function FieldLabel({ label, htmlFor }: { label: string; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[7px] tracking-[0.2em] text-text-dim mb-1"
    >
      {label}
    </label>
  );
}

const fieldBase =
  "w-full bg-surface-2 border border-border/40 text-text text-[10px] px-2 py-1.5 focus:outline-none focus:border-eva/50 transition-colors placeholder:text-text-dim/30 font-mono";

/* ─── Text / generic input ─── */
export function MagiInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={fieldBase}
      />
    </div>
  );
}

/* ─── Number ─── */
export function MagiNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  required,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} />
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        required={required}
        className={fieldBase}
      />
    </div>
  );
}

/* ─── Select ─── */
export function MagiSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldBase} appearance-none cursor-pointer`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Toggle ─── */
export function MagiToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between py-1">
      <label
        htmlFor={id}
        className="text-[7px] tracking-[0.2em] text-text-dim cursor-pointer"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors ${
          checked ? "bg-eva/30 border-eva/50" : "bg-surface-2 border-border/40"
        } border`}
      >
        <div
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${
            checked ? "left-[14px] bg-eva" : "left-[2px] bg-text-dim/50"
          }`}
        />
      </button>
    </div>
  );
}

/* ─── Textarea ─── */
export function MagiTextarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} />
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${fieldBase} resize-none`}
      />
    </div>
  );
}
