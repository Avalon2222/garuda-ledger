import { rapikanJudul } from "./format";
import { JARAK, peringkat, profil, vendorMilik, type Agregat, type Ringkasan } from "./hitung";
import { polaGanda } from "./pola";
import type { Ledger, Saring } from "./tipe";

export type Jenis = "vendor" | "satker" | "unit" | "instansi" | "tender" | "pemilik";
export type JenisSisi = "menang" | "hierarki" | "milik" | "paket";

export interface Simpul {
  /** "v:12", "s:40", "u:3", "i:0", "t:20000" (baris tender), "p:negara" */
  id: string;
  jenis: Jenis;
  label: string;
  nilai: number;
  n: number;
  /** porsi paket berpola ganda, 0..1 */
  porsiPola: number;
  /** jari-jari gambar, diisi aturUkuran */
  r: number;
  /** simpul pusat tampilan fokus */
  utama?: boolean;
  /** vendor "tetangga": menang di satker yang sama, digambar lebih redup */
  redup?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Sisi {
  id: string;
  source: string;
  target: string;
  jenis: JenisSisi;
  nilai: number;
  n: number;
}

export interface Graf {
  simpul: Simpul[];
  sisi: Sisi[];
}

export interface IdTerurai {
  jenis: Jenis;
  /** indeks angka, atau id teks untuk pemilik */
  indeks: number;
  kunci: string;
}

const AWALAN: Record<string, Jenis> = { v: "vendor", s: "satker", u: "unit", i: "instansi", t: "tender", p: "pemilik" };
const KODE: Record<Jenis, string> = { vendor: "v", satker: "s", unit: "u", instansi: "i", tender: "t", pemilik: "p" };

export function idSimpul(jenis: Jenis, indeks: number | string): string {
  return `${KODE[jenis]}:${indeks}`;
}

export function uraiId(id: string): IdTerurai | null {
  const m = /^([vsuitp]):(.+)$/.exec(id);
  if (!m) return null;
  const jenis = AWALAN[m[1]];
  if (jenis === "pemilik") return { jenis, indeks: -1, kunci: m[2] };
  const indeks = Number(m[2]);
  return Number.isInteger(indeks) && indeks >= 0 ? { jenis, indeks, kunci: m[2] } : null;
}

/** Apakah id menunjuk entitas yang benar-benar ada di ledger (untuk tautan yang dibagikan). */
export function idSah(l: Ledger, id: string): boolean {
  const u = uraiId(id);
  if (!u) return false;
  switch (u.jenis) {
    case "vendor": return u.indeks < l.vendor.length;
    case "satker": return u.indeks < l.satker.length;
    case "unit": return u.indeks < l.unit.length;
    case "instansi": return u.indeks < l.instansi.length;
    case "tender": return u.indeks < l.n;
    case "pemilik": return l.pemilik.some((p) => p.id === u.kunci);
  }
}

export function labelSimpul(l: Ledger, id: string): string {
  const u = uraiId(id);
  if (!u) return id;
  switch (u.jenis) {
    case "vendor": return l.vendor[u.indeks]?.nama ?? id;
    case "satker": return l.satker[u.indeks]?.nama ?? id;
    case "unit": return l.unit[u.indeks]?.nama ?? id;
    case "instansi": return l.instansi[u.indeks]?.singkat ?? id;
    case "tender": return rapikanJudul(l.judul[u.indeks] ?? id);
    case "pemilik": return l.pemilik.find((p) => p.id === u.kunci)?.nama ?? id;
  }
}

const KOSONG: Agregat = { n: 0, nilai: 0, nPola: 0 };

/** Pembangun graf: mengumpulkan simpul dan sisi tanpa duplikat. */
class Rakit {
  simpul = new Map<string, Simpul>();
  sisi = new Map<string, Sisi>();

  constructor(private l: Ledger, private r: Ringkasan) {}

  private pasang(id: string, jenis: Jenis, label: string, a: Agregat, tambahan: Partial<Simpul> = {}): string {
    const lama = this.simpul.get(id);
    if (lama) {
      // simpul yang awalnya masuk sebagai tetangga redup bisa "naik pangkat" kalau diminta lagi sebagai simpul biasa
      if (lama.redup && !tambahan.redup) lama.redup = false;
      if (tambahan.utama) lama.utama = true;
      return id;
    }
    this.simpul.set(id, { id, jenis, label, nilai: a.nilai, n: a.n, porsiPola: a.n ? a.nPola / a.n : 0, r: 8, ...tambahan });
    return id;
  }

  hubung(a: string, b: string, jenis: JenisSisi, nilai = 0, n = 0): void {
    const id = `${a}>${b}`;
    if (!this.sisi.has(id)) this.sisi.set(id, { id, source: a, target: b, jenis, nilai, n });
  }

  instansi(i: number, tambahan?: Partial<Simpul>): string {
    return this.pasang(idSimpul("instansi", i), "instansi", this.l.instansi[i].singkat, this.r.instansi.get(i) ?? KOSONG, tambahan);
  }

  unit(u: number, tambahan?: Partial<Simpul>): string {
    // instansi dengan satu unit bernama sama (BIN, BSSN, Bakamla, ...) cukup digambar sebagai instansi
    const ins = this.l.unit[u].instansi;
    if (this.l.unit[u].nama === this.l.instansi[ins].singkat) return this.instansi(ins, tambahan);
    const id = this.pasang(idSimpul("unit", u), "unit", this.l.unit[u].nama, this.r.unit.get(u) ?? KOSONG, tambahan);
    this.hubung(this.instansi(this.l.unit[u].instansi), id, "hierarki");
    return id;
  }

  satker(s: number, tambahan?: Partial<Simpul>): string {
    const id = this.pasang(idSimpul("satker", s), "satker", this.l.satker[s].nama, this.r.satker.get(s) ?? KOSONG, tambahan);
    this.hubung(this.unit(this.l.satker[s].unit), id, "hierarki");
    return id;
  }

  vendor(v: number, tambahan?: Partial<Simpul>): string {
    const id = this.pasang(idSimpul("vendor", v), "vendor", this.l.vendor[v].nama, this.r.vendor.get(v) ?? KOSONG, tambahan);
    this.pemilikDari(v, id);
    return id;
  }

  /** Sisi vendor -> satker memakai agregat pasangan di bawah filter. */
  menang(v: number, s: number, tambahanVendor?: Partial<Simpul>): void {
    const a = this.r.pasangan.get(v * JARAK + s);
    if (!a) return;
    this.hubung(this.vendor(v, tambahanVendor), this.satker(s), "menang", a.nilai, a.n);
  }

  pemilik(kunci: string, tambahan?: Partial<Simpul>): string | null {
    const p = this.l.pemilik.find((x) => x.id === kunci);
    if (!p) return null;
    const id = this.pasang(idSimpul("pemilik", kunci), "pemilik", p.nama, KOSONG, tambahan);
    for (const [dari, ke] of this.l.kepemilikan) {
      if (dari === `p:${kunci}`) {
        const induk = this.pemilik(ke);
        if (induk) this.hubung(id, induk, "milik");
      }
    }
    return id;
  }

  private pemilikDari(v: number, idVendor: string): void {
    for (const [dari, ke] of this.l.kepemilikan) {
      if (dari === v) {
        const induk = this.pemilik(ke);
        if (induk) this.hubung(idVendor, induk, "milik");
      }
    }
  }

  /** Simpul paket, digantung di antara vendor dan satkernya. */
  tender(baris: number, tambahan?: Partial<Simpul>): string {
    const l = this.l;
    const berpola = polaGanda(l.pola[baris]);
    const id = this.pasang(idSimpul("tender", baris), "tender", rapikanJudul(l.judul[baris]), { n: 1, nilai: l.nilai[baris], nPola: berpola ? 1 : 0 }, tambahan);
    this.hubung(this.vendor(l.vendorDari[baris]), id, "paket", l.nilai[baris], 1);
    this.hubung(id, this.satker(l.satkerDari[baris]), "paket", l.nilai[baris], 1);
    return id;
  }

  selesai(): Graf {
    const graf = { simpul: [...this.simpul.values()], sisi: [...this.sisi.values()] };
    aturUkuran(graf);
    return graf;
  }
}

const RENTANG_R: Record<Jenis, [number, number]> = {
  instansi: [20, 30],
  unit: [12, 22],
  satker: [6, 16],
  vendor: [6, 20],
  tender: [4, 9],
  pemilik: [12, 14],
};

/** Jari-jari simpul dari akar nilai, relatif terhadap simpul sejenis terbesar di graf ini. */
export function aturUkuran(graf: Graf): void {
  const maks: Partial<Record<Jenis, number>> = {};
  for (const s of graf.simpul) maks[s.jenis] = Math.max(maks[s.jenis] ?? 0, s.nilai);
  for (const s of graf.simpul) {
    const [kecil, besar] = RENTANG_R[s.jenis];
    const m = maks[s.jenis] ?? 0;
    s.r = m > 0 ? kecil + (besar - kecil) * Math.sqrt(s.nilai / m) : kecil;
  }
}

export interface OpsiIkhtisar {
  /** vendor terbesar di seluruh sektor */
  umum: number;
  /** tambahan vendor terbesar di tiap instansi, supaya instansi kecil tidak tenggelam di bawah Polri */
  perInstansi: number;
  satkerPerVendor: number;
}

export const IKHTISAR_DESKTOP: OpsiIkhtisar = { umum: 22, perInstansi: 6, satkerPerVendor: 2 };
export const IKHTISAR_PONSEL: OpsiIkhtisar = { umum: 10, perInstansi: 3, satkerPerVendor: 2 };

/**
 * Tampilan awal: vendor terbesar sektor ditambah vendor terbesar tiap instansi, masing-masing dengan satker
 * utamanya, lalu unit dan instansi di atasnya. Hasilnya beberapa gugus (satu per instansi) yang dijembatani
 * vendor yang menang di lebih dari satu instansi.
 */
export function grafIkhtisar(l: Ledger, r: Ringkasan, opsi: OpsiIkhtisar = IKHTISAR_DESKTOP): Graf {
  const rakit = new Rakit(l, r);
  // satu lintasan di atas pasangan: nilai vendor per instansi dan daftar satker tiap vendor
  const perInstansi = new Map<number, Map<number, number>>();
  const satkerVendor = new Map<number, { satker: number; nilai: number }[]>();
  for (const [kunci, a] of r.pasangan) {
    const v = Math.floor(kunci / JARAK);
    const s = kunci % JARAK;
    const ins = l.instansiSatker[s];
    const peta = perInstansi.get(ins) ?? perInstansi.set(ins, new Map()).get(ins)!;
    peta.set(v, (peta.get(v) ?? 0) + a.nilai);
    (satkerVendor.get(v) ?? satkerVendor.set(v, []).get(v)!).push({ satker: s, nilai: a.nilai });
  }
  const pilih = new Set(peringkat(r.vendor, opsi.umum).map((v) => v.indeks));
  for (const peta of perInstansi.values()) {
    const urut = [...peta.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    for (const [v] of urut.slice(0, opsi.perInstansi)) pilih.add(v);
  }
  for (const v of pilih) {
    const daftar = (satkerVendor.get(v) ?? []).sort((a, b) => b.nilai - a.nilai || a.satker - b.satker).slice(0, opsi.satkerPerVendor);
    for (const d of daftar) rakit.menang(v, d.satker);
  }
  // sisi tambahan antar simpul yang sudah tampil, supaya vendor yang berbagi satker terlihat terhubung
  for (const v of pilih) {
    for (const d of satkerVendor.get(v) ?? []) if (rakit.simpul.has(idSimpul("satker", d.satker))) rakit.menang(v, d.satker);
  }
  for (const i of r.instansi.keys()) rakit.instansi(i);
  return rakit.selesai();
}

export interface OpsiFokus {
  mitra: number;
  tetangga: number;
  paket: number;
}

const OPSI_FOKUS: OpsiFokus = { mitra: 24, tetangga: 2, paket: 8 };

/** Tampilan fokus: satu entitas di tengah dengan lingkungan terdekatnya. */
export function grafFokus(l: Ledger, r: Ringkasan, s: Saring, id: string, opsi: OpsiFokus = OPSI_FOKUS): Graf | null {
  const u = uraiId(id);
  if (!u || !idSah(l, id)) return null;
  const rakit = new Rakit(l, r);

  const tetanggaSatker = (sat: number, kecuali: number, banyak: number) => {
    const p = profil(l, s, l.barisSatker[sat], "vendor");
    let dipasang = 0;
    for (const m of p.mitra) {
      if (dipasang >= banyak) break;
      if (m.indeks === kecuali) continue;
      rakit.menang(m.indeks, sat, { redup: true });
      dipasang++;
    }
  };

  const fokusVendor = (v: number, utama: boolean, paketWajib?: number) => {
    rakit.vendor(v, { utama });
    const p = profil(l, s, l.barisVendor[v], "satker");
    for (const m of p.mitra.slice(0, opsi.mitra)) {
      rakit.menang(v, m.indeks);
      if (utama) tetanggaSatker(m.indeks, v, opsi.tetangga);
    }
    if (utama) {
      const terbesar = [...p.baris].sort((a, b) => l.nilai[b] - l.nilai[a]).slice(0, opsi.paket);
      for (const b of terbesar) rakit.tender(b);
    }
    if (paketWajib !== undefined) rakit.tender(paketWajib, { utama: true });
  };

  switch (u.jenis) {
    case "vendor":
      fokusVendor(u.indeks, true);
      break;
    case "tender": {
      rakit.satker(l.satkerDari[u.indeks]);
      fokusVendor(l.vendorDari[u.indeks], false, u.indeks);
      tetanggaSatker(l.satkerDari[u.indeks], l.vendorDari[u.indeks], 6);
      break;
    }
    case "satker": {
      rakit.satker(u.indeks, { utama: true });
      const p = profil(l, s, l.barisSatker[u.indeks], "vendor");
      for (const m of p.mitra.slice(0, 36)) rakit.menang(m.indeks, u.indeks);
      const terbesar = [...p.baris].sort((a, b) => l.nilai[b] - l.nilai[a]).slice(0, opsi.paket);
      for (const b of terbesar) rakit.tender(b);
      break;
    }
    case "unit": {
      rakit.unit(u.indeks, { utama: true });
      const satker = peringkat(r.satker).filter((x) => l.satker[x.indeks].unit === u.indeks).slice(0, 18);
      const milik = new Set(satker.map((x) => x.indeks));
      for (const x of satker) rakit.satker(x.indeks);
      const pasangan: { v: number; s: number; nilai: number }[] = [];
      for (const [kunci, a] of r.pasangan) if (milik.has(kunci % JARAK)) pasangan.push({ v: Math.floor(kunci / JARAK), s: kunci % JARAK, nilai: a.nilai });
      pasangan.sort((a, b) => b.nilai - a.nilai);
      for (const p of pasangan.slice(0, 40)) rakit.menang(p.v, p.s);
      break;
    }
    case "instansi": {
      rakit.instansi(u.indeks, { utama: true });
      for (const [un] of r.unit) if (l.unit[un].instansi === u.indeks) rakit.unit(un);
      const satker = peringkat(r.satker).filter((x) => l.instansiSatker[x.indeks] === u.indeks).slice(0, 22);
      const milik = new Set(satker.map((x) => x.indeks));
      for (const x of satker) rakit.satker(x.indeks);
      const pasangan: { v: number; s: number; nilai: number }[] = [];
      for (const [kunci, a] of r.pasangan) if (milik.has(kunci % JARAK)) pasangan.push({ v: Math.floor(kunci / JARAK), s: kunci % JARAK, nilai: a.nilai });
      pasangan.sort((a, b) => b.nilai - a.nilai);
      for (const p of pasangan.slice(0, 40)) rakit.menang(p.v, p.s);
      break;
    }
    case "pemilik": {
      rakit.pemilik(u.kunci, { utama: true });
      // pemilik di bawahnya (anak rantai) ikut tampil
      for (const [dari, ke] of l.kepemilikan) if (typeof dari === "string" && ke === u.kunci) rakit.pemilik(dari.slice(2));
      const vendor = vendorMilik(l, u.kunci)
        .map((v) => ({ v, nilai: r.vendor.get(v)?.nilai ?? 0 }))
        .sort((a, b) => b.nilai - a.nilai)
        .slice(0, 30);
      for (const { v } of vendor) {
        rakit.vendor(v);
        const p = profil(l, s, l.barisVendor[v], "satker");
        for (const m of p.mitra.slice(0, 3)) rakit.menang(v, m.indeks);
      }
      break;
    }
  }
  return rakit.selesai();
}

/** Tambahkan lingkungan sebuah simpul ke graf yang sedang tampil (klik dua kali / tombol Perluas). */
export function perluas(l: Ledger, r: Ringkasan, s: Saring, graf: Graf, id: string, banyak = 12): Graf {
  const u = uraiId(id);
  if (!u) return graf;
  const rakit = new Rakit(l, r);
  for (const x of graf.simpul) rakit.simpul.set(x.id, x);
  for (const x of graf.sisi) rakit.sisi.set(x.id, { ...x, source: idUjung(x.source), target: idUjung(x.target) });
  const sebelum = rakit.simpul.size;
  const batas = () => rakit.simpul.size - sebelum >= banyak;

  if (u.jenis === "vendor") {
    for (const m of profil(l, s, l.barisVendor[u.indeks], "satker").mitra) {
      if (batas()) break;
      rakit.menang(u.indeks, m.indeks);
    }
  } else if (u.jenis === "satker") {
    for (const m of profil(l, s, l.barisSatker[u.indeks], "vendor").mitra) {
      if (batas()) break;
      rakit.menang(m.indeks, u.indeks);
    }
  } else if (u.jenis === "unit") {
    for (const x of peringkat(r.satker)) {
      if (batas()) break;
      if (l.satker[x.indeks].unit === u.indeks) rakit.satker(x.indeks);
    }
  } else if (u.jenis === "instansi") {
    for (const [un] of r.unit) if (l.unit[un].instansi === u.indeks) rakit.unit(un);
  } else if (u.jenis === "pemilik") {
    for (const v of vendorMilik(l, u.kunci)) {
      if (batas()) break;
      rakit.vendor(v);
    }
  } else if (u.jenis === "tender") {
    rakit.tender(u.indeks);
  }
  return rakit.selesai();
}

/** d3-force mengganti source/target dari id menjadi objek simpul; fungsi ini menerima dua-duanya. */
export function idUjung(ujung: string | { id: string }): string {
  return typeof ujung === "string" ? ujung : ujung.id;
}

/** Tetangga langsung tiap simpul, untuk sorotan saat hover/pilih. */
export function tetangga(graf: Graf): Map<string, Set<string>> {
  const peta = new Map<string, Set<string>>();
  for (const s of graf.simpul) peta.set(s.id, new Set());
  for (const e of graf.sisi) {
    const a = idUjung(e.source);
    const b = idUjung(e.target);
    peta.get(a)?.add(b);
    peta.get(b)?.add(a);
  }
  return peta;
}
