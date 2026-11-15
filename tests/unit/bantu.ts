import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siapkan } from "@/lib/data";
import type { Ledger, LedgerMentah, Meta } from "@/lib/tipe";

export const DIR_DATA = fileURLToPath(new URL("../../public/data", import.meta.url));

let asli: Ledger | null = null;

/** Ledger sungguhan keluaran pipeline (public/data/ledger.json), dimuat sekali untuk semua tes. */
export function ledgerAsli(): Ledger {
  if (!asli) asli = siapkan(JSON.parse(readFileSync(path.join(DIR_DATA, "ledger.json"), "utf8")) as LedgerMentah);
  return asli;
}

export function metaMini(): Meta {
  return {
    dibangun: "2026-11-15T01:00:00Z",
    sidik: "abc123",
    sumber: { nama: "uji", url: "https://contoh.test", lisensi: "ODbL 1.0", diubah: "2026-08-03T02:51:39Z", berkas: [] },
    rentang: [2020, 2022],
    ambang: { mepet: 0.999, persis: 0.99999, kilat_hari: { barang: 6, konstruksi: 7, jasa: 7, konsultansi: 10 }, beruntun: [3, 30], langganan_tahun: 5, dominan: [0.5, 5], debut_nilai: 9e9 },
    dasar: { median_rasio: 0.99, median_jeda: 13, porsi: { mepet: 0.15, langganan: 0.13 }, porsi_ganda: 0.11 },
    tahap: { dibaca: 100, lolos_prasaring: 20, dalam_cakupan: 15, perencanaan: 3, dibuang: {}, diperbaiki: {}, gagal_tender: 0, tender: 10, detik: {} },
    resolusi: { catatan_unik: 6, vendor: 5, digabung: 1, gabung_id: 1, gabung_nama_pt: 0, gabung_nama_lpse: 0, kandidat_mirip: 0 },
    kualitas: [],
  };
}

const HARI_2020 = 7305; // 2020-01-01 dihitung dari 2000-01-01

/**
 * Ledger kecil dengan angka yang gampang dihitung tangan.
 *
 *   instansi 0 Kemhan/TNI: unit 0 "TNI AD" -> satker 0 "Pusbekang", satker 1 "Denma"
 *                          unit 1 "TNI AL" -> satker 2 "Mabesal"
 *   instansi 1 Polri:      unit 2 "Mabes Polri" -> satker 3 "Korlantas"
 *
 *   vendor 0 "PT Alfa" (induk: BUMN "induk" -> negara), 1 "PT Beta", 2 "CV Gama", 3 "Primkopad Kartika" (kop-ad), 4 "PT Delta"
 */
export function mentahMini(): LedgerMentah {
  //            satker vendor nilai hps  tahun kategori pola
  const baris: [number, number, number, number, number, number, number][] = [
    [0, 0, 100, 100, 2020, 0, 1 | 2 | 16], // mepet+persis+langganan -> pola ganda
    [0, 0, 200, 220, 2021, 0, 16],
    [0, 1, 50, 60, 2021, 1, 0],
    [1, 1, 300, 300.2, 2022, 1, 1 | 4], // mepet+kilat -> pola ganda
    [1, 2, 20, 25, 2020, 2, 256],
    [2, 0, 400, 500, 2022, 0, 0],
    [2, 3, 10, 10, 2022, 2, 1 | 2], // mepet+persis saja -> bukan pola ganda
    [3, 4, 1000, 1100, 2021, 0, 64],
    [3, 4, 500, 520, 2022, 3, 0],
    [3, 0, 80, 90, 2022, 0, 8 | 512], // beruntun+tunggal -> pola ganda
  ];
  return {
    versi: 1,
    meta: metaMini(),
    kategori: ["barang", "konstruksi", "jasa", "konsultansi"],
    instansi: [
      { id: "kemhan", nama: "Kementerian Pertahanan & TNI", singkat: "Kemhan/TNI" },
      { id: "polri", nama: "Kepolisian Negara Republik Indonesia", singkat: "Polri" },
    ],
    unit: [
      { nama: "TNI Angkatan Darat", instansi: 0, spse: "tniad" },
      { nama: "TNI Angkatan Laut", instansi: 0 },
      { nama: "Mabes Polri", instansi: 1, spse: "polri" },
    ],
    satker: [
      { nama: "Pusbekangad TNI AD", unit: 0 },
      { nama: "Denmabesad TNI AD", unit: 0 },
      { nama: "MABES TNI AL", unit: 1 },
      { nama: "KORLANTAS POLRI", unit: 2 },
    ],
    vendor: [
      { nama: "PT Alfa Sentosa", bentuk: "PT", alias: ["PT. ALFA SENTOSA", "ALFA SENTOSA, PT"], bukti: ["id"] },
      { nama: "PT Beta Raya", bentuk: "PT" },
      { nama: "CV Gama", bentuk: "CV" },
      { nama: "Primkopad Kartika Jaya", bentuk: "Koperasi" },
      { nama: "PT Delta Mandiri", bentuk: "PT" },
    ],
    pemilik: [
      { id: "negara", nama: "Negara Republik Indonesia", jenis: "negara", sumber: "https://contoh.test/negara" },
      { id: "induk", nama: "PT Induk (Persero)", jenis: "bumn", sumber: "https://contoh.test/induk" },
      { id: "kop-ad", nama: "Koperasi di lingkungan TNI AD", jenis: "koperasi", sumber: "https://contoh.test/kop" },
    ],
    kepemilikan: [
      [0, "induk", "anak usaha"],
      ["p:induk", "negara", "BUMN"],
      [3, "kop-ad", "afiliasi (dari nama)"],
    ],
    tender: {
      id: baris.map((_, i) => String(9000 + i)),
      judul: baris.map((_, i) => `PENGADAAN BARANG UJI NOMOR ${i}`),
      satker: baris.map((b) => b[0]),
      vendor: baris.map((b) => b[1]),
      nilai: baris.map((b) => b[2]),
      hps: baris.map((b) => b[3]),
      umum: baris.map((b, i) => HARI_2020 + (b[4] - 2020) * 366 + i),
      menang: baris.map((b, i) => HARI_2020 + (b[4] - 2020) * 366 + i + 10),
      kategori: baris.map((b) => b[5]),
      pola: baris.map((b) => b[6]),
    },
    ulang: { "4": "Tidak ada peserta yang lulus evaluasi" },
  };
}

export function ledgerMini(): Ledger {
  return siapkan(mentahMini());
}
