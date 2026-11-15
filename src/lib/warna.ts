import type { Jenis } from "./graf";

/** Warna tiap jenis simpul. Dipakai kanvas dan panel, jadi legenda selalu cocok dengan graf. */
export const WARNA_JENIS: Record<Jenis, string> = {
  vendor: "#5aa2ff",
  satker: "#31d0c0",
  unit: "#a990ff",
  instansi: "#f3b941",
  tender: "#b6c0cf",
  pemilik: "#74d680",
};

export const LABEL_JENIS: Record<Jenis, string> = {
  vendor: "Vendor",
  satker: "Satker",
  unit: "Unit",
  instansi: "Instansi",
  tender: "Paket",
  pemilik: "Pemilik",
};

export const WARNA = {
  latar: "#080b10",
  kisi: "rgba(120, 140, 170, 0.055)",
  teks: "#d6dce6",
  teksRedup: "#7d8899",
  pilih: "#ffd66b",
  pola: "#ff8f3f",
  polaKuat: "#ff5d5d",
  sisi: "rgba(140, 158, 186, 0.15)",
  sisiHierarki: "rgba(169, 144, 255, 0.26)",
  sisiMilik: "rgba(116, 214, 128, 0.5)",
  sisiSorot: "rgba(214, 228, 255, 0.75)",
};

/** "#rrggbb" -> "rgba(r, g, b, a)". */
export function alfa(heks: string, a: number): string {
  const n = parseInt(heks.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Campur dua warna heks, t = 0 -> a, t = 1 -> b. */
export function campur(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const u = Math.min(1, Math.max(0, t));
  const kanal = (geser: number) => Math.round(((x >> geser) & 255) + (((y >> geser) & 255) - ((x >> geser) & 255)) * u);
  return `#${((1 << 24) | (kanal(16) << 16) | (kanal(8) << 8) | kanal(0)).toString(16).slice(1)}`;
}

/** Warna lensa pola: biru (tanpa pola) -> jingga -> merah (semua paket berpola). */
export function warnaPola(porsi: number): string {
  return porsi <= 0.5 ? campur("#4a78b8", "#ff8f3f", porsi * 2) : campur("#ff8f3f", "#ff5d5d", (porsi - 0.5) * 2);
}
