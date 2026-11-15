import { rapikanJudul } from "./format";
import { idSimpul, type Jenis } from "./graf";
import type { Ledger } from "./tipe";

export interface HasilCari {
  id: string;
  jenis: Jenis;
  judul: string;
  ket: string;
  skor: number;
}

/** Huruf kecil tanpa tanda baca, supaya "pt. panca" cocok dengan "PT Panca". */
export function ratakan(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Skor kecocokan: semua kata kueri harus ada; cocok di awal nama atau awal kata dinilai lebih tinggi. */
export function skor(nama: string, kata: string[]): number {
  let total = 0;
  for (const k of kata) {
    const pos = nama.indexOf(k);
    if (pos < 0) return 0;
    total += pos === 0 ? 30 : nama[pos - 1] === " " ? 18 : 8;
  }
  return total + Math.max(0, 12 - nama.length / 6);
}

export interface Indeks {
  vendor: string[];
  satker: string[];
  unit: string[];
}

/** Nama yang sudah diratakan, dihitung sekali supaya tiap ketukan tombol tidak mengulang 13 ribu toLowerCase. */
export function buatIndeks(l: Ledger): Indeks {
  return {
    vendor: l.vendor.map((v) => ratakan(`${v.nama} ${(v.alias ?? []).join(" ")}`)),
    satker: l.satker.map((s) => ratakan(s.nama)),
    unit: l.unit.map((u) => ratakan(u.nama)),
  };
}

/**
 * Cari di vendor, satker, unit, instansi, pemilik, lalu judul dan kode paket.
 * Vendor diurutkan dari indeks kecil (= nilai terbesar) kalau skornya seri, jadi pemain besar muncul duluan.
 */
export function cari(l: Ledger, indeks: Indeks, kueri: string, batas = 24): HasilCari[] {
  const q = ratakan(kueri);
  if (q.length < 2) return [];
  const kata = q.split(" ");
  const hasil: HasilCari[] = [];

  l.instansi.forEach((x, i) => {
    const s = skor(ratakan(`${x.singkat} ${x.nama}`), kata);
    if (s) hasil.push({ id: idSimpul("instansi", i), jenis: "instansi", judul: x.nama, ket: "Instansi", skor: s + 40 });
  });
  indeks.unit.forEach((nama, i) => {
    const s = skor(nama, kata);
    if (s) hasil.push({ id: idSimpul("unit", i), jenis: "unit", judul: l.unit[i].nama, ket: l.instansi[l.unit[i].instansi].singkat, skor: s + 25 });
  });
  l.pemilik.forEach((x) => {
    const s = skor(ratakan(x.nama), kata);
    if (s) hasil.push({ id: idSimpul("pemilik", x.id), jenis: "pemilik", judul: x.nama, ket: "Pemilik / afiliasi", skor: s + 10 });
  });
  indeks.vendor.forEach((nama, i) => {
    const s = skor(nama, kata);
    if (s) hasil.push({ id: idSimpul("vendor", i), jenis: "vendor", judul: l.vendor[i].nama, ket: `Vendor · peringkat ${i + 1}`, skor: s + Math.max(0, 10 - i / 300) });
  });
  indeks.satker.forEach((nama, i) => {
    const s = skor(nama, kata);
    if (s) hasil.push({ id: idSimpul("satker", i), jenis: "satker", judul: l.satker[i].nama, ket: `Satker · ${l.unit[l.satker[i].unit].nama}`, skor: s + 5 });
  });

  hasil.sort((a, b) => b.skor - a.skor);
  const atas = hasil.slice(0, batas);

  // paket: hanya kalau entitas belum memenuhi daftar, dan kueri cukup panjang untuk tidak cocok dengan semuanya
  if (atas.length < batas && q.length >= 3) {
    const paket: HasilCari[] = [];
    const kode = /^\d{4,}$/.test(q);
    for (let i = l.n - 1; i >= 0 && paket.length < 200; i--) {
      if (kode ? l.id[i].startsWith(q) : kata.every((k) => l.judul[i].toLowerCase().includes(k))) {
        paket.push({ id: idSimpul("tender", i), jenis: "tender", judul: rapikanJudul(l.judul[i]), ket: `Paket · ${l.vendor[l.vendorDari[i]].nama}`, skor: l.nilai[i] });
      }
    }
    paket.sort((a, b) => b.skor - a.skor);
    atas.push(...paket.slice(0, batas - atas.length));
  }
  return atas;
}
