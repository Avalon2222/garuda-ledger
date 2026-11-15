import { tanggalDariHari } from "./format";
import { kunciDariBit } from "./pola";
import type { Ledger } from "./tipe";

/** Satu sel CSV: kutip kalau perlu, dan jinakkan awalan rumus supaya aman dibuka di spreadsheet. */
export function selCsv(nilai: string | number): string {
  let teks = String(nilai);
  if (/^[=+\-@\t\r]/.test(teks) && typeof nilai === "string") teks = `'${teks}`;
  return /[",\n\r]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

function iso(hari: number): string {
  const t = tanggalDariHari(hari);
  return t ? t.toISOString().slice(0, 10) : "";
}

export const KEPALA_CSV = ["kode_tender", "judul", "instansi", "unit", "satker", "vendor", "kategori", "hps", "nilai", "rasio_hps", "tgl_umum", "tgl_menang", "pola"];

/** Baris tender -> teks CSV. */
export function keCsv(l: Ledger, baris: ArrayLike<number>): string {
  const keluar = [KEPALA_CSV.join(",")];
  for (let k = 0; k < baris.length; k++) {
    const i = baris[k];
    const satker = l.satker[l.satkerDari[i]];
    const unit = l.unit[satker.unit];
    keluar.push(
      [
        l.id[i],
        l.judul[i],
        l.instansi[unit.instansi].singkat,
        unit.nama,
        satker.nama,
        l.vendor[l.vendorDari[i]].nama,
        l.kategori[l.kategoriDari[i]],
        l.hps[i],
        l.nilai[i],
        l.hps[i] > 0 ? (l.nilai[i] / l.hps[i]).toFixed(4) : "",
        iso(l.umum[i]),
        iso(l.menang[i]),
        kunciDariBit(l.pola[i]).join("|"),
      ]
        .map(selCsv)
        .join(","),
    );
  }
  return keluar.join("\n");
}

export function namaBerkasAman(nama: string): string {
  return (
    nama
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "paket"
  );
}

/** Unduh baris tender sebagai CSV (dibuat di browser, tidak ada permintaan ke server). */
export function unduhCsv(l: Ledger, baris: ArrayLike<number>, nama: string): void {
  // BOM supaya Excel membaca UTF-8 dengan benar
  const gumpal = new Blob(["﻿", keCsv(l, baris)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(gumpal);
  const a = document.createElement("a");
  a.href = url;
  a.download = `garuda-ledger-${namaBerkasAman(nama)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
