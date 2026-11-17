import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import type { ScrapeJob } from "../types/kos";

interface TelemetryCardProps {
  job: ScrapeJob | null;
}

export function TelemetryCard({ job }: TelemetryCardProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (job?.status === "running" || job?.status === "queued") {
      setOpen(true);
    }
  }, [job?.id, job?.status]);

  if (!job || (job.logs.length === 0 && !job.error)) return null;

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[var(--accent)]" />
          <span>Log Eksekusi Pipeline ({job.logs.length} baris)</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 font-mono-tabular text-xs space-y-1">
          {job.logs.map((entry, idx) => (
            <div key={`${entry.ts}-${idx}`} className="text-[var(--text-muted)]">
              <span className="opacity-60 mr-2">{entry.ts.slice(11, 19)}</span>
              <span className="text-[var(--text-primary)]">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

