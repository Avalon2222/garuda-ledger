import { idSah } from "./graf";
import { saringAwal } from "./hitung";
import { bitDariKunci, kunciDariBit } from "./pola";
import type { Ledger, Saring } from "./tipe";

/** Keadaan yang ikut di tautan: apa yang dipilih, graf dipusatkan di mana, filter, dan lensa. */
export interface Keadaan {
  pilih: string | null;
  fokus: string | null;
  saring: Saring;
  lensaPola: boolean;
}

/**
 * Keadaan -> hash URL. Nilai bawaan tidak ditulis, jadi tautan tampilan awal tetap bersih.
 * Contoh: #sel=v:12&fokus=v:12&th=2019-2023&in=kemhan,polri&pola=mepet,langganan&lensa=1
 */
export function keHash(l: Ledger, k: Keadaan): string {
  const awal = saringAwal(l);
  const bagian: string[] = [];
  if (k.pilih) bagian.push(`sel=${encodeURIComponent(k.pilih)}`);
  if (k.fokus) bagian.push(`fokus=${encodeURIComponent(k.fokus)}`);
  if (k.saring.tahun[0] !== awal.tahun[0] || k.saring.tahun[1] !== awal.tahun[1]) bagian.push(`th=${k.saring.tahun[0]}-${k.saring.tahun[1]}`);
  if (k.saring.instansi.length) bagian.push(`in=${k.saring.instansi.map((i) => l.instansi[i].id).join(",")}`);
  if (k.saring.kategori.length) bagian.push(`kat=${k.saring.kategori.map((i) => l.kategori[i]).join(",")}`);
  if (k.saring.pola) bagian.push(`pola=${kunciDariBit(k.saring.pola).join(",")}`);
  if (k.lensaPola) bagian.push("lensa=1");
  return bagian.length ? `#${bagian.join("&")}` : "";
}

/** Hash URL -> keadaan. Apa pun yang tidak dikenal atau di luar rentang diabaikan, tidak pernah melempar galat. */
export function dariHash(l: Ledger, hash: string): Keadaan {
  const k: Keadaan = { pilih: null, fokus: null, saring: saringAwal(l), lensaPola: false };
  const isi = new URLSearchParams(hash.replace(/^#/, ""));
  const sel = isi.get("sel");
  if (sel && idSah(l, sel)) k.pilih = sel;
  const fokus = isi.get("fokus");
  if (fokus && idSah(l, fokus)) k.fokus = fokus;
  const th = /^(\d{4})-(\d{4})$/.exec(isi.get("th") ?? "");
  if (th) {
    const [dari, sampai] = [Number(th[1]), Number(th[2])];
    const [min, maks] = l.meta.rentang;
    if (dari <= sampai && dari >= min && sampai <= maks) k.saring.tahun = [dari, sampai];
  }
  const daftar = (kunci: string) => (isi.get(kunci) ?? "").split(",").filter(Boolean);
  k.saring.instansi = daftar("in").map((id) => l.instansi.findIndex((i) => i.id === id)).filter((i) => i >= 0);
  k.saring.kategori = daftar("kat").map((nama) => l.kategori.indexOf(nama)).filter((i) => i >= 0);
  k.saring.pola = bitDariKunci(daftar("pola"));
  k.lensaPola = isi.get("lensa") === "1";
  return k;
}
