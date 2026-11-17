import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { ScamRisk } from "../types/kos";

interface ScamAlertBannerProps {
  scamRisk?: ScamRisk | null;
}

export function ScamAlertBanner({ scamRisk }: ScamAlertBannerProps) {
  if (!scamRisk || scamRisk.level === "low" || scamRisk.signals.length === 0) {
    return null;
  }

  const isHigh = scamRisk.level === "high";
  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        isHigh
          ? "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        {isHigh ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>
          {isHigh ? "Peringatan Risiko Penipuan Tinggi" : "Perlu Kewaspadaan / Survei Langsung"}
        </span>
      </div>

      <ul className="list-disc pl-5 text-xs space-y-1">
        {scamRisk.signals.map((sig) => (
          <li key={sig}>{sig}</li>
        ))}
      </ul>

      {scamRisk.warning_quotes.length > 0 && (
        <div className="space-y-1 pt-1">
          {scamRisk.warning_quotes.map((q, idx) => (
            <p key={idx} className="rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-xs italic">
              &ldquo;{q}&rdquo;
            </p>
          ))}
        </div>
      )}

      <p className="text-xs font-medium opacity-90 pt-0.5">
        Saran aman: Jangan pernah transfer DP sebelum survei fisik lokasi dan bertemu pengelola resmi.
      </p>
    </div>
  );
}

