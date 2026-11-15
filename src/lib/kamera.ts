/** Kamera 2D untuk kanvas graf: layar = dunia * k + (tx, ty). Semua fungsi murni supaya gampang dites. */

export interface Kamera {
  k: number;
  tx: number;
  ty: number;
}

export interface Kotak {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Tepi {
  atas: number;
  kanan: number;
  bawah: number;
  kiri: number;
}

export const K_MIN = 0.12;
export const K_MAKS = 4;

export function keLayar(c: Kamera, x: number, y: number): [number, number] {
  return [x * c.k + c.tx, y * c.k + c.ty];
}

export function keDunia(c: Kamera, sx: number, sy: number): [number, number] {
  return [(sx - c.tx) / c.k, (sy - c.ty) / c.k];
}

/** Zoom dengan titik layar (sx, sy) tetap menunjuk titik dunia yang sama. */
export function zumDiTitik(c: Kamera, faktor: number, sx: number, sy: number): Kamera {
  const k = Math.min(K_MAKS, Math.max(K_MIN, c.k * faktor));
  const nyata = k / c.k;
  return { k, tx: sx - (sx - c.tx) * nyata, ty: sy - (sy - c.ty) * nyata };
}

export function kotakDari(titik: { x?: number; y?: number; r: number }[]): Kotak | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of titik) {
    if (t.x === undefined || t.y === undefined) continue;
    x0 = Math.min(x0, t.x - t.r);
    y0 = Math.min(y0, t.y - t.r);
    x1 = Math.max(x1, t.x + t.r);
    y1 = Math.max(y1, t.y + t.r);
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

/** Kamera yang memuat seluruh kotak di dalam layar (lebar x tinggi) dikurangi tepi yang tertutup panel. */
export function paskan(kotak: Kotak, lebar: number, tinggi: number, tepi: Tepi, kMaks = 1.6): Kamera {
  const ruangL = Math.max(40, lebar - tepi.kiri - tepi.kanan);
  const ruangT = Math.max(40, tinggi - tepi.atas - tepi.bawah);
  const l = Math.max(1, kotak.x1 - kotak.x0);
  const t = Math.max(1, kotak.y1 - kotak.y0);
  const k = Math.min(kMaks, Math.max(K_MIN, Math.min(ruangL / l, ruangT / t)));
  const cx = (kotak.x0 + kotak.x1) / 2;
  const cy = (kotak.y0 + kotak.y1) / 2;
  return { k, tx: tepi.kiri + ruangL / 2 - cx * k, ty: tepi.atas + ruangT / 2 - cy * k };
}

/** Satu langkah animasi kamera menuju sasaran. Mengembalikan true kalau sudah sampai. */
export function dekati(c: Kamera, sasaran: Kamera, laju = 0.18): boolean {
  c.k += (sasaran.k - c.k) * laju;
  c.tx += (sasaran.tx - c.tx) * laju;
  c.ty += (sasaran.ty - c.ty) * laju;
  const sampai = Math.abs(sasaran.k - c.k) < 0.002 && Math.abs(sasaran.tx - c.tx) < 0.5 && Math.abs(sasaran.ty - c.ty) < 0.5;
  if (sampai) Object.assign(c, sasaran);
  return sampai;
}
