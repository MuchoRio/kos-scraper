import { Filter, HardDrive } from "lucide-react";
import type {
  ResourceAvailability,
  ResourceGender,
  ResourcePetFilter,
  ResourcePriceCategory,
  ResourceQuality,
  StorageMode,
} from "../types/kos";

export interface ResourceSettingsValues {
  resourcePriceCategory: ResourcePriceCategory;
  resourceAvailability: ResourceAvailability;
  resourceQuality: ResourceQuality;
  resourceGender: ResourceGender;
  resourcePet: ResourcePetFilter;
  resourceDeduplicate: boolean;
  resourceIncludeUnpriced: boolean;
}

interface ResourceSettingsSectionProps {
  values: ResourceSettingsValues;
  onChange: (patch: Partial<ResourceSettingsValues>) => void;
}

export function ResourceSettingsSection({ values, onChange }: ResourceSettingsSectionProps) {
  return (
    <section className="space-y-4 text-xs">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--accent)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Filter Kategori Google Sheet &amp; Doc (Kostpedia / Direktori)
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-[var(--text-muted)]">Kategori Harga (di Sheet)</span>
          <select
            value={values.resourcePriceCategory}
            onChange={(e) => onChange({ resourcePriceCategory: e.target.value as ResourcePriceCategory })}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2"
          >
            <option value="all">Semua Kategori Harga</option>
            <option value="murah">Kost Murah (≤ 1,5 Jt / Label Murah)</option>
            <option value="middle">Middle (Standar / Worth It)</option>
            <option value="premium">Kost Premium / Eksklusif</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[var(--text-muted)]">Status Ketersediaan</span>
          <select
            value={values.resourceAvailability}
            onChange={(e) => onChange({ resourceAvailability: e.target.value as ResourceAvailability })}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2"
          >
            <option value="available_or_unknown">Tersedia &amp; Belum Diisi (Default)</option>
            <option value="strict_available">Hanya Kost Tersedia (Ketat)</option>
            <option value="all">Semua Status (termasuk Penuh)</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[var(--text-muted)]">Kualitas Kost (Kurasi Sheet)</span>
          <select
            value={values.resourceQuality}
            onChange={(e) => onChange({ resourceQuality: e.target.value as ResourceQuality })}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2"
          >
            <option value="all">Semua Kualitas (termasuk Belum Diisi)</option>
            <option value="curated">Hanya Sudah Dikurasi</option>
            <option value="top">Top Recommendation</option>
            <option value="worth_it">Worth It</option>
            <option value="best_deal">Best Deal (Murah tapi Bagus)</option>
            <option value="standar">Standar</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[var(--text-muted)]">Gender Penghuni</span>
          <select
            value={values.resourceGender}
            onChange={(e) => onChange({ resourceGender: e.target.value as ResourceGender })}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2"
          >
            <option value="all">Semua Gender</option>
            <option value="campur">Kost Campur</option>
            <option value="wanita">Kost Wanita / Putri</option>
            <option value="pria">Kost Pria / Putra</option>
            <option value="bebas">Kost Bebas (Texas)</option>
          </select>
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="block text-[var(--text-muted)]">Status Pet Friendly</span>
          <select
            value={values.resourcePet}
            onChange={(e) => onChange({ resourcePet: e.target.value as ResourcePetFilter })}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2"
          >
            <option value="all">Semua Status Hewan</option>
            <option value="pet_friendly">Boleh Hewan (Cat / Dog / Pet Friendly)</option>
            <option value="no_pet">Tidak Pet Friendly</option>
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={values.resourceDeduplicate}
            onChange={(e) => onChange({ resourceDeduplicate: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>Hapus baris duplikat otomatis (nama &amp; kecamatan/WA sama)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={values.resourceIncludeUnpriced}
            onChange={(e) => onChange({ resourceIncludeUnpriced: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>Sertakan baris yang belum punya angka harga nominal</span>
        </label>
        <p className="text-[11px] text-[var(--text-muted)] pt-0.5">
          Catatan Kostpedia: ~5.578 baris belum mencantumkan harga nominal &amp; ~8.111 baris berstatus
          &ldquo;Belum diisi&rdquo;. Mode default menjaga baris tanpa label Penuh agar kandidat relevan tetap
          terjaring sebelum di-enrich.
        </p>
      </div>
    </section>
  );
}

export function StorageModeSection({
  storageMode,
  onChange,
}: {
  storageMode: StorageMode;
  onChange: (next: StorageMode) => void;
}) {
  return (
    <section className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
        <HardDrive className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>Mode Simpan File hasil/ (CRUD Data)</span>
      </div>
      <select
        value={storageMode}
        onChange={(e) => onChange(e.target.value as StorageMode)}
        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
      >
        <option value="replace">Timpa file terbaru — detail_latest.json (1 file bersih, Default)</option>
        <option value="merge">Update &amp; Gabung ke file yang ada (CRUD Upsert tanpa duplikat)</option>
        <option value="archive">Buat file arsip timestamp baru setiap proses</option>
      </select>
      <p className="text-[11px] text-[var(--text-muted)]">
        Mode <strong>Timpa</strong> / <strong>Upsert</strong> menjaga folder <code>hasil/</code> tetap berisi
        1 file utama. File lama bisa dihapus kapan saja lewat menu <strong>Riwayat</strong>.
      </p>
    </section>
  );
}
