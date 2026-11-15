import { POLA, polaGanda } from "./pola";
import type { Ledger, Saring } from "./tipe";

/** Agregat satu entitas (vendor, satker, unit, instansi) di bawah filter aktif. */
export interface Agregat {
  n: number;
  nilai: number;
  /** jumlah paket berpola ganda (dua pola atau lebih sekaligus) */
  nPola: number;
}

export interface Ringkasan {
  n: number;
  nilai: number;
  /** baris yang lolos filter, urut tanggal menang */
  baris: Int32Array;
  vendor: Map<number, Agregat>;
  satker: Map<number, Agregat>;
  unit: Map<number, Agregat>;
  instansi: Map<number, Agregat>;
  /** nilai dan jumlah paket per pasangan vendor-satker; kunci = vendor * JARAK + satker */
  pasangan: Map<number, Agregat>;
  perTahun: Map<number, Agregat>;
  /** jumlah paket per pola (kunci pola) */
  perPola: Record<string, number>;
  medianRasio: number | null;
}

/** Pengali untuk menggabungkan (vendor, satker) jadi satu kunci angka. Harus > jumlah satker. */
export const JARAK = 100_000;

export function saringAwal(l: Ledger): Saring {
  return { tahun: [l.meta.rentang[0], l.meta.rentang[1]], instansi: [], kategori: [], pola: 0 };
}

export function saringAktif(l: Ledger, s: Saring): boolean {
  return s.tahun[0] > l.meta.rentang[0] || s.tahun[1] < l.meta.rentang[1] || s.instansi.length > 0 || s.kategori.length > 0 || s.pola !== 0;
}

/** Buat fungsi uji baris untuk sebuah filter. `tanpaPola` dipakai saat menghitung jumlah per pola. */
export function buatUji(l: Ledger, s: Saring, tanpaPola = false): (i: number) => boolean {
  const [dari, sampai] = s.tahun;
  const instansi = s.instansi.length ? new Set(s.instansi) : null;
  const kategori = s.kategori.length ? new Set(s.kategori) : null;
  const pola = tanpaPola ? 0 : s.pola;
  return (i) =>
    l.tahun[i] >= dari &&
    l.tahun[i] <= sampai &&
    (!instansi || instansi.has(l.instansiSatker[l.satkerDari[i]])) &&
    (!kategori || kategori.has(l.kategoriDari[i])) &&
    (!pola || (l.pola[i] & pola) !== 0);
}

function tambah(peta: Map<number, Agregat>, kunci: number, nilai: number, berpola: boolean): void {
  const a = peta.get(kunci);
  if (a) {
    a.n++;
    a.nilai += nilai;
    if (berpola) a.nPola++;
  } else {
    peta.set(kunci, { n: 1, nilai, nPola: berpola ? 1 : 0 });
  }
}

export function median(nilai: number[]): number | null {
  if (!nilai.length) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengah = urut.length >> 1;
  return urut.length % 2 ? urut[tengah] : (urut[tengah - 1] + urut[tengah]) / 2;
}

/** Satu lintasan di atas tabel fakta: semua agregat yang dipakai graf dan panel. */
export function ringkas(l: Ledger, s: Saring): Ringkasan {
  const uji = buatUji(l, s);
  const lolos: number[] = [];
  const r: Ringkasan = {
    n: 0,
    nilai: 0,
    baris: new Int32Array(0),
    vendor: new Map(),
    satker: new Map(),
    unit: new Map(),
    instansi: new Map(),
    pasangan: new Map(),
    perTahun: new Map(),
    perPola: Object.fromEntries(POLA.map((p) => [p.kunci, 0])),
    medianRasio: null,
  };
  const rasio: number[] = [];
  for (let i = 0; i < l.n; i++) {
    if (!uji(i)) continue;
    lolos.push(i);
    const nilai = l.nilai[i];
    const sat = l.satkerDari[i];
    const ven = l.vendorDari[i];
    const un = l.satker[sat].unit;
    const berpola = polaGanda(l.pola[i]);
    r.n++;
    r.nilai += nilai;
    tambah(r.vendor, ven, nilai, berpola);
    tambah(r.satker, sat, nilai, berpola);
    tambah(r.unit, un, nilai, berpola);
    tambah(r.instansi, l.unit[un].instansi, nilai, berpola);
    tambah(r.pasangan, ven * JARAK + sat, nilai, berpola);
    tambah(r.perTahun, l.tahun[i], nilai, berpola);
    if (l.hps[i] > 0) rasio.push(nilai / l.hps[i]);
    if (l.pola[i]) for (const p of POLA) if (l.pola[i] & p.bit) r.perPola[p.kunci]++;
  }
  r.baris = Int32Array.from(lolos);
  r.medianRasio = median(rasio);
  return r;
}

/** Jumlah paket per pola dengan filter lain tetap berlaku (dipakai daftar pola di panel kiri). */
export function hitungPola(l: Ledger, s: Saring): Record<string, number> {
  const uji = buatUji(l, s, true);
  const hasil: Record<string, number> = Object.fromEntries(POLA.map((p) => [p.kunci, 0]));
  for (let i = 0; i < l.n; i++) {
    if (!l.pola[i] || !uji(i)) continue;
    for (const p of POLA) if (l.pola[i] & p.bit) hasil[p.kunci]++;
  }
  return hasil;
}

/** Jumlah dan nilai per tahun tanpa filter tahun (dipakai linimasa supaya batangnya tidak ikut hilang). */
export function perTahunPenuh(l: Ledger, s: Saring): Map<number, Agregat> {
  const uji = buatUji(l, { ...s, tahun: [l.meta.rentang[0], l.meta.rentang[1]] });
  const hasil = new Map<number, Agregat>();
  for (let i = 0; i < l.n; i++) if (uji(i)) tambah(hasil, l.tahun[i], l.nilai[i], polaGanda(l.pola[i]));
  return hasil;
}

export interface Peringkat {
  indeks: number;
  n: number;
  nilai: number;
  nPola: number;
}

export function peringkat(peta: Map<number, Agregat>, batas = Infinity, menurut: "nilai" | "n" | "nPola" = "nilai"): Peringkat[] {
  const semua: Peringkat[] = [];
  for (const [indeks, a] of peta) semua.push({ indeks, ...a });
  semua.sort((a, b) => b[menurut] - a[menurut] || b.nilai - a.nilai || a.indeks - b.indeks);
  return batas < semua.length ? semua.slice(0, batas) : semua;
}

/** Indeks Herfindahl-Hirschman dari porsi nilai: 0 (tersebar) sampai 1 (satu pemain). */
export function hhi(nilai: number[]): number {
  const total = nilai.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return nilai.reduce((a, b) => a + (b / total) ** 2, 0);
}

export function labelHhi(x: number): "tersebar" | "sedang" | "terpusat" {
  return x < 0.15 ? "tersebar" : x < 0.25 ? "sedang" : "terpusat";
}

export interface Profil {
  n: number;
  nilai: number;
  baris: number[];
  tahunAwal: number;
  tahunAkhir: number;
  perTahun: Map<number, Agregat>;
  /** jumlah paket per kunci pola */
  perPola: Record<string, number>;
  nPola: number;
  medianRasio: number | null;
  medianJeda: number | null;
  /** lawan main: satker (untuk vendor) atau vendor (untuk satker), urut nilai */
  mitra: Peringkat[];
}

/** Profil rinci sekumpulan baris (tender milik satu vendor, satu satker, dst.) di bawah filter aktif. */
export function profil(l: Ledger, s: Saring, kandidat: ArrayLike<number>, mitraDari: "satker" | "vendor"): Profil {
  const uji = buatUji(l, s);
  const baris: number[] = [];
  const perTahun = new Map<number, Agregat>();
  const mitra = new Map<number, Agregat>();
  const perPola: Record<string, number> = Object.fromEntries(POLA.map((p) => [p.kunci, 0]));
  const rasio: number[] = [];
  const jeda: number[] = [];
  let nilai = 0;
  let nPola = 0;
  for (let k = 0; k < kandidat.length; k++) {
    const i = kandidat[k];
    if (!uji(i)) continue;
    baris.push(i);
    nilai += l.nilai[i];
    const berpola = polaGanda(l.pola[i]);
    if (berpola) nPola++;
    tambah(perTahun, l.tahun[i], l.nilai[i], berpola);
    tambah(mitra, mitraDari === "satker" ? l.satkerDari[i] : l.vendorDari[i], l.nilai[i], berpola);
    if (l.hps[i] > 0) rasio.push(l.nilai[i] / l.hps[i]);
    if (l.umum[i] >= 0) jeda.push(l.menang[i] - l.umum[i]);
    if (l.pola[i]) for (const p of POLA) if (l.pola[i] & p.bit) perPola[p.kunci]++;
  }
  const tahun = [...perTahun.keys()];
  return {
    n: baris.length,
    nilai,
    baris,
    tahunAwal: tahun.length ? Math.min(...tahun) : 0,
    tahunAkhir: tahun.length ? Math.max(...tahun) : 0,
    perTahun,
    perPola,
    nPola,
    medianRasio: median(rasio),
    medianJeda: median(jeda),
    mitra: peringkat(mitra),
  };
}

/** Baris tender milik sebuah unit atau instansi (tidak ada indeks baliknya, jadi dipindai). */
export function barisUnit(l: Ledger, unit: number): number[] {
  const hasil: number[] = [];
  for (let i = 0; i < l.n; i++) if (l.satker[l.satkerDari[i]].unit === unit) hasil.push(i);
  return hasil;
}

export function barisInstansi(l: Ledger, instansi: number): number[] {
  const hasil: number[] = [];
  for (let i = 0; i < l.n; i++) if (l.instansiSatker[l.satkerDari[i]] === instansi) hasil.push(i);
  return hasil;
}

/** Vendor yang terhubung ke seorang pemilik, langsung atau lewat rantai pemilik di bawahnya. */
export function vendorMilik(l: Ledger, idPemilik: string): number[] {
  const tujuan = new Set([idPemilik]);
  let berubah = true;
  while (berubah) {
    berubah = false;
    for (const [dari, ke] of l.kepemilikan) {
      if (typeof dari === "string" && tujuan.has(ke) && !tujuan.has(dari.slice(2))) {
        tujuan.add(dari.slice(2));
        berubah = true;
      }
    }
  }
  const hasil = new Set<number>();
  for (const [dari, ke] of l.kepemilikan) if (typeof dari === "number" && tujuan.has(ke)) hasil.add(dari);
  return [...hasil];
}
