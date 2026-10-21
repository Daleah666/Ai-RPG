import { useId, type ReactNode } from "react";
import { estimateTokens } from "../lib/tokens";

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
  showTokens?: boolean;
};

export function TextField({ label, value, onChange, hint, placeholder, rows = 4, multiline = false, showTokens = multiline }: TextProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        {showTokens && <span className="muted small">~{estimateTokens(value)} tok</span>}
      </div>
      {multiline ? (
        <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

type NumberProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: ReactNode;
};

export function NumberField({ label, value, onChange, min, max, hint }: NumberProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
