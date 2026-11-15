"use client";

import { Check, RotateCcw } from "lucide-react";
import { angka, persen, rupiah } from "@/lib/format";
import type { Jenis } from "@/lib/graf";
import type { Ringkasan } from "@/lib/hitung";
import { POLA } from "@/lib/pola";
import type { Ledger, Saring } from "@/lib/tipe";
import { LABEL_JENIS, WARNA_JENIS } from "@/lib/warna";
import { JudulBagian } from "./Kecil";

interface Props {
  l: Ledger;
  saring: Saring;
  r: Ringkasan;
  /** jumlah paket per pola dengan filter lain tetap berlaku */
  hitunganPola: Record<string, number>;
  aktif: boolean;
  lensaPola: boolean;
  onSaring: (s: Saring) => void;
  onLensa: (nyala: boolean) => void;
  onAturUlang: () => void;
}

function alih<T>(daftar: T[], x: T): T[] {
  return daftar.includes(x) ? daftar.filter((y) => y !== x) : [...daftar, x];
}

const GLIF: Record<Jenis, string> = { instansi: "★", unit: "◆", satker: "⛊", vendor: "■", tender: "●", pemilik: "▲" };

/** Panel kiri: filter instansi, jenis pengadaan, pola, lensa warna, dan legenda graf. */
export default function PanelSaring({ l, saring, r, hitunganPola, aktif, lensaPola, onSaring, onLensa, onAturUlang }: Props) {
  const totalInstansi = new Map<number, { n: number; nilai: number }>();
  for (const [i, a] of r.instansi) totalInstansi.set(i, a);
  return (
    <div className="px-3 pb-6 pt-1" data-uji="panel-saring">
      <JudulBagian
        kanan={
          aktif ? (
            <button type="button" className="flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] text-accent hover:underline" onClick={onAturUlang}>
              <RotateCcw size={11} /> Atur ulang
            </button>
          ) : null
        }
      >
        Instansi
      </JudulBagian>
      <div role="group" aria-label="Filter instansi">
        {l.instansi.map((ins, i) => {
          const nyala = saring.instansi.includes(i);
          const a = totalInstansi.get(i);
          return (
            <button key={ins.id} type="button" role="checkbox" aria-checked={nyala} className="baris" onClick={() => onSaring({ ...saring, instansi: alih(saring.instansi, i) })} title={ins.nama}>
              <span className="kotak-centang">{nyala ? <Check size={11} strokeWidth={3} /> : null}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{ins.singkat}</span>
              <span className="angka flex-none text-[11px] text-muted">{a ? rupiah(a.nilai) : "–"}</span>
            </button>
          );
        })}
      </div>

      <JudulBagian>Jenis pengadaan</JudulBagian>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter jenis pengadaan">
        {l.kategori.map((nama, i) => (
          <button key={nama} type="button" className="tombol capitalize" aria-pressed={saring.kategori.includes(i)} onClick={() => onSaring({ ...saring, kategori: alih(saring.kategori, i) })}>
            {nama}
          </button>
        ))}
      </div>

      <JudulBagian kanan={<span className="text-[10.5px] text-dim">klik untuk menyaring</span>}>Pola statistik</JudulBagian>
      <div role="group" aria-label="Filter pola statistik">
        {POLA.map((p) => {
          const nyala = (saring.pola & p.bit) !== 0;
          const n = hitunganPola[p.kunci] ?? 0;
          return (
            <button
              key={p.kunci}
              type="button"
              role="checkbox"
              aria-checked={nyala}
              className="baris"
              onClick={() => onSaring({ ...saring, pola: saring.pola ^ p.bit })}
              title={`${p.jelaskan(l.meta)} ${p.wajar}`}
            >
              <span className="kotak-centang">{nyala ? <Check size={11} strokeWidth={3} /> : null}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{p.label}</span>
              <span className="angka flex-none text-[11px] text-pola">{angka(n)}</span>
              <span className="angka w-[38px] flex-none text-right text-[10.5px] text-dim">{persen(l.meta.dasar.porsi[p.kunci] ?? 0, 0)}</span>
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-1.5 text-[10.5px] leading-snug text-dim">
        Angka kanan = porsi di seluruh data. Pola adalah hitungan, bukan tuduhan; arahkan kursor untuk definisi dan penjelasan wajarnya.
      </p>

      <JudulBagian>Lensa warna</JudulBagian>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className="tombol" aria-pressed={!lensaPola} onClick={() => onLensa(false)}>
          Jenis simpul
        </button>
        <button type="button" className="tombol" aria-pressed={lensaPola} onClick={() => onLensa(true)}>
          Pola ganda
        </button>
      </div>

      <JudulBagian>Legenda</JudulBagian>
      {lensaPola ? (
        <div>
          <div className="h-2 rounded-sm" style={{ background: "linear-gradient(90deg, #4a78b8, #ff8f3f 50%, #ff5d5d)" }} />
          <div className="mt-1 flex justify-between text-[10.5px] text-dim">
            <span>0% paket berpola ganda</span>
            <span>100%</span>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {(Object.keys(LABEL_JENIS) as Jenis[]).map((j) => (
            <li key={j} className="flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[8px]" style={{ borderColor: WARNA_JENIS[j], color: WARNA_JENIS[j], background: `${WARNA_JENIS[j]}22` }}>
                {GLIF[j]}
              </span>
              {LABEL_JENIS[j]}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-2.5 space-y-1 text-[11px] leading-snug text-dim">
        <li>Ukuran simpul = nilai tender.</li>
        <li><span className="text-pola">Busur jingga</span> = porsi paket dengan dua pola atau lebih.</li>
        <li>Garis putus-putus = hierarki atau kepemilikan.</li>
      </ul>
    </div>
  );
}
