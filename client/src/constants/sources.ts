import type { SourceId } from "../types/kos";

export interface SourceOptionMeta {
  id: SourceId;
  label: string;
  note: string;
}

export const SOURCE_OPTIONS: SourceOptionMeta[] = [
  { id: "sewakost", label: "sewakost.com", note: "Kos murah & kontak WA langsung" },
  { id: "rukita", label: "rukita.co", note: "Coliving terkelola & JSON-LD" },
  { id: "mamikos", label: "mamikos.com", note: "Filter /cari & detail lengkap" },
  { id: "infokost", label: "infokost.id", note: "GPS presisi & peraturan kos" },
  { id: "cove", label: "cove.id", note: "Coliving eksklusif (~Rp 3jt+)" },
  { id: "djuragankamar", label: "djuragankamar.com", note: "Tarif bulanan & tata tertib" },
  { id: "rumah123", label: "rumah123.com", note: "Filter harga & GPS JSON-LD" },
  { id: "kostjakarta", label: "kostjakarta.com", note: "Jabodetabek & WA pemilik" },
];

export const DEFAULT_SOURCES: SourceId[] = SOURCE_OPTIONS.map((s) => s.id);
