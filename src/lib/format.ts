/** Format angka, rupiah, dan tanggal gaya Indonesia. */

const EPOK_MS = Date.UTC(2000, 0, 1);
const HARI_MS = 86_400_000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function desimal(x: number, digit: number): string {
  return x.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: digit });
}

/** Rp ringkas: 1,2 T / 345 M / 12,5 jt / 950 rb. */
export function rupiah(x: number): string {
  if (!Number.isFinite(x)) return "–";
  const a = Math.abs(x);
  if (a >= 1e12) return `Rp ${desimal(x / 1e12, a >= 1e13 ? 1 : 2)} T`;
  if (a >= 1e9) return `Rp ${desimal(x / 1e9, a >= 1e10 ? 0 : 1)} M`;
  if (a >= 1e6) return `Rp ${desimal(x / 1e6, a >= 1e7 ? 0 : 1)} jt`;
  if (a >= 1e3) return `Rp ${desimal(x / 1e3, 0)} rb`;
  return `Rp ${desimal(x, 0)}`;
}

/** Rp lengkap dengan pemisah ribuan. */
export function rupiahPenuh(x: number): string {
  return Number.isFinite(x) ? `Rp ${Math.round(x).toLocaleString("id-ID")}` : "–";
}

export function angka(x: number): string {
  return Number.isFinite(x) ? Math.round(x).toLocaleString("id-ID") : "–";
}

export function persen(x: number, digit = 1): string {
  return Number.isFinite(x) ? `${desimal(x * 100, digit)}%` : "–";
}

/** Hari sejak 2000-01-01 (format pipeline) -> Date UTC; -1 -> null. */
export function tanggalDariHari(hari: number): Date | null {
  return hari < 0 ? null : new Date(EPOK_MS + hari * HARI_MS);
}

export function tahunDariHari(hari: number): number {
  return hari < 0 ? 0 : new Date(EPOK_MS + hari * HARI_MS).getUTCFullYear();
}

export function tanggal(hari: number): string {
  const t = tanggalDariHari(hari);
  return t ? `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}` : "–";
}

/** ISO UTC -> "15 Nov 2026, 08.09 WIB". */
export function waktuWib(iso: string | undefined): string {
  if (!iso) return "–";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "–";
  const w = new Date(t.getTime() + 7 * 3_600_000);
  const jam = String(w.getUTCHours()).padStart(2, "0");
  const menit = String(w.getUTCMinutes()).padStart(2, "0");
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${jam}.${menit} WIB`;
}

/** "3 jam lalu", "2 hari lalu"; untuk cap "dicek terakhir". */
export function lamaLalu(iso: string | undefined, kini: number = Date.now()): string {
  if (!iso) return "–";
  const selisih = kini - new Date(iso).getTime();
  if (!Number.isFinite(selisih)) return "–";
  const menit = Math.max(0, Math.round(selisih / 60_000));
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}

/** Potong teks panjang dengan elipsis di tengah kata terakhir yang utuh. */
export function potong(teks: string, maks: number): string {
  if (teks.length <= maks) return teks;
  const potongan = teks.slice(0, maks - 1);
  const spasi = potongan.lastIndexOf(" ");
  return `${(spasi > maks * 0.6 ? potongan.slice(0, spasi) : potongan).trimEnd()}…`;
}

/** Judul paket di sumber sering HURUF BESAR semua; rapikan jadi huruf kalimat tanpa merusak singkatan pendek. */
export function rapikanJudul(teks: string): string {
  const huruf = teks.replace(/[^A-Za-z]/g, "");
  if (huruf.length < 8) return teks;
  const besar = huruf.replace(/[^A-Z]/g, "").length / huruf.length;
  if (besar < 0.85) return teks;
  return teks
    .split(/(\s+)/)
    .map((kata, i) => {
      if (/^\s+$/.test(kata)) return kata;
      const inti = kata.replace(/[^A-Za-z0-9]/g, "");
      // singkatan (TNI, AD, POLRI, T.A., R4) dan kata berangka dibiarkan
      if (inti.length <= 3 || /\d/.test(inti) || SINGKATAN.has(inti)) return kata;
      const kecil = kata.toLowerCase();
      return i === 0 ? kecil.charAt(0).toUpperCase() + kecil.slice(1) : kecil;
    })
    .join("");
}

const SINGKATAN = new Set([
  "POLRI", "POLDA", "POLRES", "POLSEK", "MABES", "KODAM", "KOREM", "KODIM", "LANAL", "LANUD", "KOSTRAD", "KOPASSUS", "BRIMOB", "KORBRIMOB",
  "KORLANTAS", "BARESKRIM", "DENSUS", "BAKAMLA", "BSSN", "BNPT", "APBN", "APBNP", "SBSN", "TNKB", "STNK", "BPKB", "DIPA", "KRI", "ALUTSISTA",
  "ALKES", "RUMKIT", "SLOG", "SPERS", "PUSDIK", "RSPAD", "LEMHANNAS", "KEMHAN", "PUSKES", "BEKANG", "DITLANTAS", "SATBRIMOB", "PNBP",
]);
