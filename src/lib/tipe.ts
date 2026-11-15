/** Bentuk ledger.json keluaran pipeline (lihat pipeline/graf.py). */

export interface Instansi {
  id: string;
  nama: string;
  singkat: string;
}

export interface Unit {
  nama: string;
  instansi: number;
  /** slug portal SPSE, kalau ada */
  spse?: string;
}

export interface Satker {
  nama: string;
  unit: number;
}

export interface Vendor {
  nama: string;
  bentuk: string;
  alias?: string[];
  /** aturan entity resolution yang menyatukan catatan vendor ini */
  bukti?: string[];
}

export interface Pemilik {
  id: string;
  nama: string;
  jenis: "negara" | "bumn" | "koperasi" | string;
  sumber: string;
}

/** [indeks vendor | "p:<id pemilik>", id pemilik tujuan, label hubungan] */
export type Kepemilikan = [number | string, string, string];

export interface Periksa {
  nama: string;
  lulus: boolean;
  nilai: number | string;
  batas: string;
  kritis: boolean;
}

export interface Meta {
  dibangun: string;
  sidik: string;
  sumber: { nama: string; url: string; lisensi: string; diubah: string; berkas: { tahun: number; ukuran: number; diubah: string }[] };
  rentang: [number, number];
  ambang: {
    mepet: number;
    persis: number;
    kilat_hari: Record<string, number>;
    beruntun: [number, number];
    langganan_tahun: number;
    dominan: [number, number];
    debut_nilai: number;
  };
  dasar: { median_rasio: number | null; median_jeda: number | null; porsi: Record<string, number>; porsi_ganda: number };
  tahap: {
    dibaca: number;
    lolos_prasaring: number;
    dalam_cakupan: number;
    perencanaan: number;
    dibuang: Record<string, number>;
    diperbaiki: Record<string, number>;
    gagal_tender: number;
    tender: number;
    detik: Record<string, number>;
  };
  resolusi: Record<string, number>;
  kualitas: Periksa[];
}

export interface FaktaMentah {
  id: string[];
  judul: string[];
  satker: number[];
  vendor: number[];
  nilai: number[];
  hps: number[];
  umum: number[];
  menang: number[];
  kategori: number[];
  pola: number[];
}

export interface LedgerMentah {
  versi: number;
  meta: Meta;
  kategori: string[];
  instansi: Instansi[];
  unit: Unit[];
  satker: Satker[];
  vendor: Vendor[];
  pemilik: Pemilik[];
  kepemilikan: Kepemilikan[];
  tender: FaktaMentah;
  ulang: Record<string, string>;
}

export interface Status {
  dicek: string;
  dibangun: string;
  sidik: string;
  sumber_diubah: string;
  tender: number;
  vendor: number;
  nilai: number;
  berubah: boolean;
}

/** Ledger siap pakai di browser: kolom angka jadi typed array, plus indeks balik. */
export interface Ledger {
  meta: Meta;
  kategori: string[];
  instansi: Instansi[];
  unit: Unit[];
  satker: Satker[];
  vendor: Vendor[];
  pemilik: Pemilik[];
  kepemilikan: Kepemilikan[];
  ulang: Record<string, string>;
  n: number;
  id: string[];
  judul: string[];
  satkerDari: Int32Array;
  vendorDari: Int32Array;
  nilai: Float64Array;
  hps: Float64Array;
  umum: Int32Array;
  menang: Int32Array;
  /** tahun kalender tanggal menang, dihitung sekali */
  tahun: Int16Array;
  kategoriDari: Uint8Array;
  pola: Uint16Array;
  /** indeks baris tender per vendor / per satker (urut tanggal) */
  barisVendor: Int32Array[];
  barisSatker: Int32Array[];
  /** satker -> instansi, biar filter instansi tidak perlu dua lompatan */
  instansiSatker: Int16Array;
}

export interface Saring {
  /** rentang tahun inklusif */
  tahun: [number, number];
  /** indeks instansi yang aktif; kosong = semua */
  instansi: number[];
  /** indeks kategori yang aktif; kosong = semua */
  kategori: number[];
  /** bitmask pola; 0 = tanpa filter pola. Baris lolos kalau punya salah satu bit. */
  pola: number;
}
