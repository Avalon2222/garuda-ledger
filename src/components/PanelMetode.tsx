"use client";

import { Check, ExternalLink, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { angka, lamaLalu, persen, waktuWib } from "@/lib/format";
import { POLA } from "@/lib/pola";
import { URL_REPO } from "@/lib/situs";
import type { Ledger, Status } from "@/lib/tipe";

interface Props {
  l: Ledger;
  status: Status | null;
  asal: "cabang-data" | "bawaan";
  onTutup: () => void;
}

const NAMA_CEK: Record<string, string> = {
  jumlah_tender: "Jumlah tender masuk akal",
  kode_tender_unik: "Kode tender unik",
  nilai_positif: "Semua nilai positif",
  tanggal_menang_terisi: "Tanggal menang terisi",
  vendor_terisi: "Tiap paket punya vendor",
  hps_terisi: "HPS terisi",
  baris_dibuang: "Baris dibuang",
  resolusi_tidak_memecah: "Resolusi tidak memecah vendor",
  rasio_wajar: "Paket di atas HPS",
  tidak_menyusut: "Data tidak menyusut dari run sebelumnya",
};

/** pemeriksaan yang nilainya porsi (0..1), bukan hitungan baris */
const BERUPA_PORSI = new Set(["hps_terisi", "baris_dibuang"]);

function Tahap({ judul, angkaUtama, ket, akhir }: { judul: string; angkaUtama: string; ket: string; akhir?: boolean }) {
  return (
    <li className="relative flex-1 rounded-sm border border-[var(--border-strong)] bg-[var(--panel-2)] px-3 py-2.5 md:min-w-0">
      <div className="label-kecil">{judul}</div>
      <div className="angka mt-0.5 text-[16px] font-semibold text-[var(--text)]">{angkaUtama}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted">{ket}</div>
      {akhir ? null : <span aria-hidden className="absolute -bottom-[13px] left-1/2 z-10 -translate-x-1/2 text-dim md:-right-[11px] md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0">▸</span>}
    </li>
  );
}

/** Dialog "Data & metode": alur pipeline dengan angka tiap tahap, gerbang kualitas, definisi pola, dan batasan. */
export default function PanelMetode({ l, status, asal, onTutup }: Props) {
  const m = l.meta;
  const t = m.tahap;
  const r = m.resolusi;
  const kotak = useRef<HTMLDivElement>(null);

  useEffect(() => {
    kotak.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-3 py-[4vh]" onPointerDown={(e) => { if (e.target === e.currentTarget) onTutup(); }}>
      <div ref={kotak} tabIndex={-1} className="panel-kaca muncul w-full max-w-[860px] rounded-md outline-none" role="dialog" aria-modal="true" aria-labelledby="judul-metode" data-uji="panel-metode">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-strong)] px-5 py-4">
          <div>
            <div className="label-kecil">Data &amp; metode</div>
            <h2 id="judul-metode" className="m-0 mt-1 text-[18px] font-semibold">Dari 1,3 juta baris ke satu graf</h2>
          </div>
          <button type="button" className="tombol-ikon" onClick={onTutup} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>

        <div className="px-5 pb-6 pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="denyut inline-block h-2 w-2 rounded-full bg-[var(--ok)]" />
              Sumber dicek <strong className="font-semibold text-[var(--text)]">{lamaLalu(status?.dicek)}</strong>
            </span>
            <span>Data dibangun {waktuWib(status?.dibangun ?? m.dibangun)}</span>
            <span>Sumber terakhir berubah {waktuWib(m.sumber.diubah)}</span>
            <span className="cip">{asal === "cabang-data" ? "data harian" : "data bawaan build"}</span>
          </div>

          <h3 className="label-kecil mb-2 mt-5">Alur pipeline (ETL)</h3>
          <ol className="m-0 flex list-none flex-col gap-4 p-0 md:flex-row md:gap-4">
            <Tahap judul="1 · Extract" angkaUtama={angka(t.dibaca)} ket={`baris OCDS dari ${m.sumber.berkas.length} berkas tahunan, unduhan inkremental pakai ETag`} />
            <Tahap judul="2 · Saring" angkaUtama={angka(t.dalam_cakupan)} ket={`catatan pertahanan & keamanan; ${angka(t.perencanaan)} masih tahap perencanaan`} />
            <Tahap judul="3 · Bersihkan" angkaUtama={angka(t.tender)} ket={`paket berpemenang; ${angka(Object.values(t.diperbaiki).reduce((a, b) => a + b, 0))} sel diperbaiki, ${angka(Object.values(t.dibuang).reduce((a, b) => a + b, 0))} baris dibuang`} />
            <Tahap judul="4 · Resolusi" angkaUtama={angka(r.vendor)} ket={`vendor dari ${angka(r.catatan_unik)} catatan penyedia; ${angka(r.digabung)} catatan disatukan`} />
            <Tahap judul="5 · Pola" angkaUtama={String(POLA.length)} ket="pola statistik per paket, ambangnya dihitung dari data" akhir />
          </ol>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <section>
              <h3 className="label-kecil mb-2">Gerbang kualitas</h3>
              <ul className="m-0 list-none space-y-1 p-0">
                {m.kualitas.map((c) => (
                  <li key={c.nama} className="flex items-center gap-2 text-[12px]">
                    {c.lulus ? <Check size={14} className="flex-none text-[var(--ok)]" /> : <TriangleAlert size={14} className="flex-none text-pola" />}
                    <span className="min-w-0 flex-1 truncate">{NAMA_CEK[c.nama] ?? c.nama}</span>
                    <span className="angka flex-none text-[11px] text-muted">{typeof c.nilai !== "number" ? c.nilai : BERUPA_PORSI.has(c.nama) ? persen(c.nilai) : angka(c.nilai)}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-2 text-[11px] leading-relaxed text-dim">
                Kalau satu pemeriksaan kritis gagal, run harian berhenti dan aplikasi tetap memakai data kemarin.
              </p>
            </section>

            <section>
              <h3 className="label-kecil mb-2">Entity resolution vendor</h3>
              <ul className="m-0 list-none space-y-1 p-0 text-[12px]">
                <li className="flex justify-between gap-2"><span>ID penyedia sama</span><span className="angka text-muted">{angka(r.gabung_id)} gabungan</span></li>
                <li className="flex justify-between gap-2"><span>Nama PT sama (unik nasional)</span><span className="angka text-muted">{angka(r.gabung_nama_pt)} gabungan</span></li>
                <li className="flex justify-between gap-2"><span>Nama sama di LPSE yang sama</span><span className="angka text-muted">{angka(r.gabung_nama_lpse)} gabungan</span></li>
                <li className="flex justify-between gap-2"><span>Mirip tapi tidak digabung</span><span className="angka text-muted">{angka(r.kandidat_mirip)} pasangan</span></li>
              </ul>
              <p className="m-0 mt-2 text-[11px] leading-relaxed text-dim">
                Aturannya sengaja hati-hati: nama CV tidak unik secara nasional, jadi “CV Karya Baru” di dua daerah
                tetap dua vendor. Ejaan yang cuma mirip tidak pernah digabung otomatis.
              </p>
            </section>
          </div>

          <h3 className="label-kecil mb-2 mt-5">Definisi pola</h3>
          <div className="overflow-x-auto">
            <table className="tabel-paket">
              <thead>
                <tr>
                  <th>Pola</th>
                  <th>Definisi</th>
                  <th className="text-right">Porsi</th>
                </tr>
              </thead>
              <tbody>
                {POLA.map((p) => (
                  <tr key={p.kunci}>
                    <td className="whitespace-nowrap font-medium">{p.label}</td>
                    <td className="text-muted">
                      {p.jelaskan(m)} <span className="text-dim">{p.wajar}</span>
                    </td>
                    <td className="angka text-right text-pola">{persen(m.dasar.porsi[p.kunci] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="label-kecil mb-2 mt-5">Batasan yang perlu diketahui</h3>
          <ul className="m-0 space-y-1.5 pl-4 text-[12px] leading-relaxed text-muted">
            <li>Data hanya memuat tender lewat LPSE. Pengadaan alutsista besar, penunjukan langsung, dan kontrak rahasia tidak tercatat, jadi semua angka adalah batas bawah.</li>
            <li>Sumbernya berhenti di {m.rentang[1]}. Pipeline mengecek registri tiap hari dan langsung membangun ulang begitu ada rilis baru.</li>
            <li>Daftar peserta tender tidak tersedia, jadi “peserta tunggal” hanya terlihat dari catatan tender ulang.</li>
            <li>Pemilik perusahaan swasta bukan data terbuka di Indonesia. Lapisan pemilik hanya memuat BUMN, anak usahanya, dan koperasi di lingkungan TNI/Polri yang dikenali dari nama.</li>
            <li>Pola adalah statistik deskriptif. Tidak ada pola di sini yang berarti pelanggaran, dan tidak ada nama yang dituduh apa pun.</li>
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <a className="tombol" href={m.sumber.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Sumber: Opentender (ICW) di OCP Data Registry
            </a>
            <a className="tombol" href={`${URL_REPO}/tree/main/pipeline`} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Kode pipeline
            </a>
            <span className="cip self-center">Lisensi data {m.sumber.lisensi}</span>
            <span className="cip angka self-center">sidik {m.sidik}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
