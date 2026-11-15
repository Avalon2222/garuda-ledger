import { tahunDariHari } from "./format";
import type { Ledger, LedgerMentah, Status } from "./tipe";

/** Cabang `data` di repo: ditulis GitHub Actions tiap hari, dibaca browser tanpa perlu deploy ulang. */
export const URL_CABANG_DATA = "https://raw.githubusercontent.com/Avalon2222/garuda-ledger/data";

function kelompokkan(kunci: Int32Array, banyak: number): Int32Array[] {
  const hitung = new Int32Array(banyak);
  for (let i = 0; i < kunci.length; i++) hitung[kunci[i]]++;
  const hasil = Array.from(hitung, (n) => new Int32Array(n));
  const isi = new Int32Array(banyak);
  for (let i = 0; i < kunci.length; i++) hasil[kunci[i]][isi[kunci[i]]++] = i;
  return hasil;
}

/** JSON mentah -> struktur siap hitung: typed array per kolom dan indeks balik vendor/satker -> baris. */
export function siapkan(m: LedgerMentah): Ledger {
  const t = m.tender;
  const n = t.id.length;
  for (const [nama, kolom] of Object.entries(t)) {
    if (kolom.length !== n) throw new Error(`Kolom ${nama} panjangnya ${kolom.length}, seharusnya ${n}`);
  }
  const satkerDari = Int32Array.from(t.satker);
  const vendorDari = Int32Array.from(t.vendor);
  const menang = Int32Array.from(t.menang);
  const tahun = new Int16Array(n);
  for (let i = 0; i < n; i++) tahun[i] = tahunDariHari(menang[i]);
  const instansiSatker = Int16Array.from(m.satker, (s) => m.unit[s.unit].instansi);
  return {
    meta: m.meta,
    kategori: m.kategori,
    instansi: m.instansi,
    unit: m.unit,
    satker: m.satker,
    vendor: m.vendor,
    pemilik: m.pemilik ?? [],
    kepemilikan: m.kepemilikan ?? [],
    ulang: m.ulang ?? {},
    n,
    id: t.id,
    judul: t.judul,
    satkerDari,
    vendorDari,
    nilai: Float64Array.from(t.nilai),
    hps: Float64Array.from(t.hps),
    umum: Int32Array.from(t.umum),
    menang,
    tahun,
    kategoriDari: Uint8Array.from(t.kategori),
    pola: Uint16Array.from(t.pola),
    barisVendor: kelompokkan(vendorDari, m.vendor.length),
    barisSatker: kelompokkan(satkerDari, m.satker.length),
    instansiSatker,
  };
}

async function ambilJson<T>(url: string, batasMs: number): Promise<T | null> {
  const pemutus = new AbortController();
  const waktu = setTimeout(() => pemutus.abort(), batasMs);
  try {
    const r = await fetch(url, { signal: pemutus.signal, cache: "no-cache" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(waktu);
  }
}

export interface HasilMuat {
  ledger: Ledger;
  status: Status | null;
  /** dari mana ledger dimuat */
  asal: "cabang-data" | "bawaan";
}

/**
 * Muat data. Urutannya: baca status.json di cabang `data` (kecil), bandingkan sidiknya dengan salinan bawaan
 * build ini; kalau pipeline harian sudah menghasilkan data yang lebih baru, ambil ledger dari cabang itu.
 * Kalau GitHub tidak terjangkau, salinan bawaan tetap dipakai.
 */
export async function muat(dasar = "/data"): Promise<HasilMuat> {
  const [status, statusBawaan] = await Promise.all([
    ambilJson<Status>(`${URL_CABANG_DATA}/status.json`, 4000),
    ambilJson<Status>(`${dasar}/status.json`, 8000),
  ]);
  if (status && statusBawaan && status.sidik && status.sidik !== statusBawaan.sidik) {
    const baru = await ambilJson<LedgerMentah>(`${URL_CABANG_DATA}/ledger.json`, 30000);
    if (baru && baru.meta?.sidik === status.sidik) {
      return { ledger: siapkan(baru), status, asal: "cabang-data" };
    }
  }
  const bawaan = await ambilJson<LedgerMentah>(`${dasar}/ledger.json`, 60000);
  if (!bawaan) throw new Error("Data tidak bisa dimuat");
  return { ledger: siapkan(bawaan), status: status ?? statusBawaan, asal: "bawaan" };
}
