interface TargetLimitFieldProps {
  label: string;
  value: string;
  max?: number;
  presets?: string[];
  allowAll?: boolean;
  className?: string;
  onChange: (next: string) => void;
}

function formatCapLabel(max: number): string {
  return max >= 1000 ? `${Math.round(max / 1000)}rb` : String(max);
}

export function TargetLimitField({
  label,
  value,
  max = 25000,
  presets = ["20", "50", "100"],
  allowAll = false,
  className = "",
  onChange,
}: TargetLimitFieldProps) {
  const isAll = allowAll && (value === "all" || value === "0");
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="block text-xs font-medium text-[var(--text-muted)] truncate">{label}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular shrink-0">
          {allowAll ? `1–${formatCapLabel(max)} / Semua` : `maks ${formatCapLabel(max)}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={max}
          value={isAll ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isAll ? "Semua" : "20"}
          aria-label={label}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
        />
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`rounded-xl border px-2 py-2 text-[11px] font-semibold font-mono-tabular cursor-pointer shrink-0 transition-colors ${
              value === preset
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {preset}
          </button>
        ))}
        {allowAll && (
          <button
            type="button"
            onClick={() => onChange("all")}
            className={`rounded-xl border px-2.5 py-2 text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
              isAll
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            Semua
          </button>
        )}
      </div>
    </div>
  );
}
