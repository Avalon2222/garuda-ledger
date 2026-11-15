import type { Meta } from "./tipe";

/** Definisi pola statistik. Bit harus sama dengan BIT_POLA di pipeline/konfigurasi.py. */
export interface DefPola {
  kunci: string;
  bit: number;
  label: string;
  ringkas: string;
  /** penjelasan satu kalimat, diisi angka ambang dari meta */
  jelaskan: (m: Meta) => string;
  /** kenapa pola ini bisa muncul secara wajar */
  wajar: string;
}

const persen = (x: number) => `${(x * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

export const POLA: DefPola[] = [
  {
    kunci: "mepet",
    bit: 1,
    label: "Mepet HPS",
    ringkas: "Harga menang hampir sama dengan HPS",
    jelaskan: (m) => `Nilai pemenang ≥ ${persen(m.ambang.mepet)} dari HPS.`,
    wajar: "Barang dengan harga pasar baku (BBM, kendaraan, lisensi) memang nyaris tidak punya ruang tawar.",
  },
  {
    kunci: "persis",
    bit: 2,
    label: "Persis HPS",
    ringkas: "Harga menang sama persis dengan HPS",
    jelaskan: () => "Nilai pemenang sama dengan HPS sampai rupiah terakhir.",
    wajar: "Sering terjadi pada paket dengan harga satuan yang sudah ditetapkan (uang makan, tarif resmi).",
  },
  {
    kunci: "kilat",
    bit: 4,
    label: "Kilat",
    ringkas: "Jeda pengumuman ke pemenang sangat singkat",
    jelaskan: (m) =>
      `Jeda di 5% tercepat untuk jenisnya (barang ≤ ${m.ambang.kilat_hari.barang ?? "?"} hari, konstruksi ≤ ${m.ambang.kilat_hari.konstruksi ?? "?"} hari).`,
    wajar: "Tender cepat adalah metode resmi untuk paket sederhana, dan kebutuhan mendesak memang diproses kilat.",
  },
  {
    kunci: "beruntun",
    bit: 8,
    label: "Beruntun",
    ringkas: "Beberapa paket ke vendor yang sama dalam waktu berdekatan",
    jelaskan: (m) => `≥ ${m.ambang.beruntun[0]} paket dari satker yang sama ke vendor yang sama dalam ${m.ambang.beruntun[1]} hari.`,
    wajar: "Satker besar sering melelang banyak paket sejenis di awal tahun anggaran.",
  },
  {
    kunci: "langganan",
    bit: 16,
    label: "Langganan",
    ringkas: "Vendor yang sama menang bertahun-tahun di satker yang sama",
    jelaskan: (m) => `Menang di satker yang sama pada ≥ ${m.ambang.langganan_tahun} tahun berbeda.`,
    wajar: "Penyedia spesialis (suku cadang, katering markas) wajar jadi langganan karena pasarnya sempit.",
  },
  {
    kunci: "dominan",
    bit: 32,
    label: "Dominan",
    ringkas: "Satu vendor menguasai separuh lebih belanja satker",
    jelaskan: (m) => `≥ ${persen(m.ambang.dominan[0])} nilai tender satker jatuh ke satu vendor (satker dengan ≥ ${m.ambang.dominan[1]} paket).`,
    wajar: "Satu proyek besar (gedung, kapal) bisa mendominasi total satker tanpa ada yang janggal.",
  },
  {
    kunci: "debut",
    bit: 64,
    label: "Debut besar",
    ringkas: "Kemenangan pertama vendor langsung bernilai sangat besar",
    jelaskan: (m) => `Kemenangan pertama di data ini sudah masuk 10% nilai terbesar (≥ Rp ${(m.ambang.debut_nilai / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M).`,
    wajar: "Vendor bisa saja sudah lama menang di sektor lain; data ini hanya melihat pertahanan dan keamanan.",
  },
  {
    kunci: "lewat_hps",
    bit: 128,
    label: "Di atas HPS",
    ringkas: "Nilai pemenang tercatat lebih besar dari HPS",
    jelaskan: () => "Nilai pemenang > HPS. Hampir selalu salah catat di sumber, bukan kejadian nyata.",
    wajar: "Aturan pengadaan tidak mengizinkan menang di atas HPS, jadi ini penanda kualitas data.",
  },
  {
    kunci: "ulang",
    bit: 256,
    label: "Tender ulang",
    ringkas: "Paket pernah gagal atau dibatalkan sebelum ada pemenang",
    jelaskan: () => "Sumber mencatat alasan tender sebelumnya gagal atau dibatalkan.",
    wajar: "Tender gagal lalu diulang adalah prosedur normal ketika tidak ada penawaran yang lulus.",
  },
  {
    kunci: "tunggal",
    bit: 512,
    label: "Peserta tunggal",
    ringkas: "Catatan tender menyebut hanya satu peserta yang menawar",
    jelaskan: () => "Catatan tender ulang menyebut hanya satu peserta. Data peserta lengkap tidak tersedia, jadi hitungan ini batas bawah.",
    wajar: "Pasar barang khusus pertahanan memang sering hanya punya satu pemasok.",
  },
];

export const POLA_PER_KUNCI: Record<string, DefPola> = Object.fromEntries(POLA.map((p) => [p.kunci, p]));

/**
 * Pola yang dihitung untuk "pola ganda" (sama dengan BIT_GANDA di pipeline/pola.py): persis tidak ikut karena
 * selalu muncul bersama mepet; di atas HPS dan tender ulang tidak ikut karena soal kualitas data dan prosedur biasa.
 */
export const BIT_GANDA = 1 | 4 | 8 | 16 | 32 | 64 | 512;

/** Paket dengan dua pola atau lebih sekaligus. Satu pola saja terlalu umum (38% paket) untuk jadi sorotan. */
export function polaGanda(bit: number): boolean {
  let x = bit & BIT_GANDA;
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n >= 2;
}

export function polaDariBit(bit: number): DefPola[] {
  return POLA.filter((p) => bit & p.bit);
}

export function bitDariKunci(kunci: string[]): number {
  return kunci.reduce((b, k) => b | (POLA_PER_KUNCI[k]?.bit ?? 0), 0);
}

export function kunciDariBit(bit: number): string[] {
  return POLA.filter((p) => bit & p.bit).map((p) => p.kunci);
}
