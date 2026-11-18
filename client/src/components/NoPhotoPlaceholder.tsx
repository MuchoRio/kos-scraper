import { ImageOff } from "lucide-react";

interface NoPhotoPlaceholderProps {
  title?: string;
  subtitle?: string;
}

export function NoPhotoPlaceholder({
  title = "Belum ada foto asli",
  subtitle = "Sumber iklan belum menyediakan foto kamar",
}: NoPhotoPlaceholderProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--bg-subtle)] via-[var(--bg-canvas)] to-[var(--bg-subtle)] px-4 pt-8 pb-3 text-center select-none">
      <svg
        viewBox="0 0 180 96"
        fill="none"
        aria-hidden="true"
        className="mb-2 h-20 w-40 opacity-85"
      >
        <rect
          x="18"
          y="12"
          width="144"
          height="74"
          rx="12"
          className="fill-[var(--bg-card)] stroke-[var(--border-subtle)]"
          strokeWidth="1.5"
        />
        <rect
          x="32"
          y="24"
          width="36"
          height="24"
          rx="4"
          className="fill-[var(--accent-soft)] stroke-[var(--border-subtle)]"
          strokeWidth="1.2"
        />
        <path
          d="M50 24v24M32 36h36"
          className="stroke-[var(--border-subtle)]"
          strokeWidth="1.2"
        />
        <rect
          x="30"
          y="56"
          width="84"
          height="18"
          rx="5"
          className="fill-[var(--bg-subtle)] stroke-[var(--border-subtle)]"
          strokeWidth="1.4"
        />
        <rect
          x="36"
          y="48"
          width="24"
          height="10"
          rx="4"
          className="fill-[var(--accent)]"
          fillOpacity="0.25"
        />
        <rect
          x="122"
          y="48"
          width="24"
          height="26"
          rx="4"
          className="fill-[var(--bg-subtle)] stroke-[var(--border-subtle)]"
          strokeWidth="1.2"
        />
        <circle cx="134" cy="40" r="6" className="fill-[var(--accent)]" fillOpacity="0.3" />
      </svg>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 px-3 py-1 text-xs font-semibold text-[var(--text-primary)] shadow-2xs">
        <ImageOff className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-1">{subtitle}</p>
    </div>
  );
}
