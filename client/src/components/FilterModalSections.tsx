import { ShieldCheck, TrainFront } from "lucide-react";
import { SOURCE_OPTIONS } from "../constants/sources";
import type { FilterState } from "../types/kos";
import { BUILDING_FACILITY_FILTERS, ROOM_FACILITY_FILTERS, type FacilityFilterOption } from "../utils/facilityCatalog";
import { FacilityIcon } from "./FacilityPillList";

interface FilterModalSectionsProps {
  draft: FilterState;
  kecamatanOptions: string[];
  onChange: (next: FilterState) => void;
}

function PillGroup<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onSelect: (val: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-[var(--text-muted)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FacilityCheckGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: FacilityFilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onToggle(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              <FacilityIcon name={opt.icon} className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterModalSections({ draft, kecamatanOptions, onChange }: FilterModalSectionsProps) {
  const toggleFacility = (fac: string) => {
    const exists = draft.facilities.includes(fac);
    onChange({
      ...draft,
      facilities: exists ? draft.facilities.filter((f) => f !== fac) : [...draft.facilities, fac],
    });
  };

  return (
    <>
      <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Area &amp; Transportasi Umum Terdekat</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-[var(--text-muted)]">Kecamatan / Area</span>
            <select
              value={draft.kecamatan}
              onChange={(e) => onChange({ ...draft, kecamatan: e.target.value })}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
            >
              <option value="all">Semua Kecamatan</option>
              {kecamatanOptions.map((kec) => (
                <option key={kec} value={kec}>{kec}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-[var(--text-muted)]">Alamat Lengkap / Jalan / Patokan</span>
            <input
              type="text"
              value={draft.alamatQuery}
              onChange={(e) => onChange({ ...draft, alamatQuery: e.target.value })}
              placeholder="Contoh: Kemang Timur, Jl. Cipete..."
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...draft, transumOnly: !draft.transumOnly })}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left cursor-pointer transition-colors ${
            draft.transumOnly
              ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 text-[var(--accent-text)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          }`}
        >
          <span className="flex items-center gap-2.5 text-xs font-semibold">
            <TrainFront className="h-4 w-4 text-[var(--accent)] shrink-0" />
            <span>Transum Friendly (Dekat MRT / Busway TJ / KRL / LRT)</span>
          </span>
          <span className="text-xs font-semibold">{draft.transumOnly ? "Aktif" : "Opsional"}</span>
        </button>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PillGroup
            label="Moda Transportasi Terdekat"
            value={draft.transitMode}
            onSelect={(transitMode) => onChange({ ...draft, transitMode })}
            options={[
              { id: "all", label: "Semua Moda" },
              { id: "busway", label: "Halte Busway" },
              { id: "mrt", label: "MRT" },
              { id: "krl", label: "KRL" },
              { id: "lrt", label: "LRT" },
            ]}
          />
          <PillGroup
            label="Jarak Maks dari Halte/Stasiun"
            value={draft.transitMaxKm}
            onSelect={(transitMaxKm) => onChange({ ...draft, transitMaxKm })}
            options={[
              { id: "", label: "Bebas" },
              { id: "1", label: "≤ 1 km" },
              { id: "2", label: "≤ 2 km" },
              { id: "3.5", label: "≤ 3.5 km" },
            ]}
          />
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Aturan Kos &amp; Gaya Hidup</h3>
        <PillGroup
          label="Kebebasan Penghuni"
          value={draft.freedom}
          onSelect={(freedom) => onChange({ ...draft, freedom })}
          options={[
            { id: "all", label: "Semua" },
            { id: "texas", label: "Texas (Bebas / 24 Jam)" },
            { id: "non_texas", label: "Non-Texas (Bebas Sopan)" },
          ]}
        />
        <PillGroup
          label="Hewan Peliharaan (Pet Friendly)"
          value={draft.pet}
          onSelect={(pet) => onChange({ ...draft, pet })}
          options={[
            { id: "all", label: "Semua" },
            { id: "any_pet", label: "Pet Friendly (Semua)" },
            { id: "cat_only", label: "Cat Only" },
            { id: "all_pets", label: "Cat & Dog / All Pets" },
            { id: "no_pet", label: "No Pet (Dilarang)" },
          ]}
        />
        <PillGroup
          label="Status Pasutri"
          value={draft.pasutri}
          onSelect={(pasutri) => onChange({ ...draft, pasutri })}
          options={[
            { id: "all", label: "Semua" },
            { id: "pasutri", label: "Boleh Pasutri" },
            { id: "non_pasutri", label: "Non-Pasutri (Lajang)" },
          ]}
        />
      </section>

      <section className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PillGroup
            label="Kamar Mandi"
            value={draft.bathroom}
            onSelect={(bathroom) => onChange({ ...draft, bathroom })}
            options={[
              { id: "all", label: "Semua" },
              { id: "dalam", label: "KM Dalam" },
              { id: "luar", label: "KM Luar" },
            ]}
          />
          <PillGroup
            label="Dapur"
            value={draft.kitchen}
            onSelect={(kitchen) => onChange({ ...draft, kitchen })}
            options={[
              { id: "all", label: "Semua" },
              { id: "yes", label: "Dapur Bersama / Ada" },
              { id: "no", label: "Tanpa Dapur" },
            ]}
          />
        </div>
        <FacilityCheckGroup title="Fasilitas Kamar" items={ROOM_FACILITY_FILTERS} selected={draft.facilities} onToggle={toggleFacility} />
        <FacilityCheckGroup title="Fasilitas & Layanan Gedung" items={BUILDING_FACILITY_FILTERS} selected={draft.facilities} onToggle={toggleFacility} />
        <PillGroup
          label="Sumber Platform"
          value={draft.source}
          onSelect={(source) => onChange({ ...draft, source })}
          options={[
            { id: "all", label: "Semua Sumber" },
            ...SOURCE_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label })),
          ]}
        />
      </section>

      <section className="space-y-2.5 border-t border-[var(--border-subtle)] pt-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
          <span>Validasi Harga &amp; Anti-Penipuan</span>
        </h3>
        <div className="flex flex-col gap-2 text-xs">
          <label className="inline-flex items-center gap-2 text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={draft.hideSuspectPrice}
              onChange={(e) => onChange({ ...draft, hideSuspectPrice: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Sembunyikan harga tidak wajar / perlu cek (Rp 1 / hubungi)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={draft.hideScamSuspects}
              onChange={(e) => onChange({ ...draft, hideScamSuspects: e.target.checked })}
              className="h-4 w-4 accent-rose-600"
            />
            <span>Sembunyikan listing dengan sinyal indikasi penipuan tinggi</span>
          </label>
        </div>
      </section>
    </>
  );
}
