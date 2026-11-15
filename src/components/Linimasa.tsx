"use client";

import { useRef, useState } from "react";
import { angka, rupiah } from "@/lib/format";
import type { Agregat } from "@/lib/hitung";

interface Props {
  rentang: [number, number];
  pilih: [number, number];
  data: Map<number, Agregat>;
  onPilih: (rentang: [number, number]) => void;
}

/**
 * Linimasa nilai tender per tahun. Klik satu batang untuk satu tahun, seret melintasi beberapa batang untuk
 * rentang, klik tahun yang sedang jadi satu-satunya pilihan untuk kembali ke semua tahun.
 */
export default function Linimasa({ rentang, pilih, data, onPilih }: Props) {
  const tahun: number[] = [];
  for (let t = rentang[0]; t <= rentang[1]; t++) tahun.push(t);
  const maks = Math.max(1, ...tahun.map((t) => data.get(t)?.nilai ?? 0));
  const jangkar = useRef<number | null>(null);
  const [seret, setSeret] = useState<[number, number] | null>(null);
  const tampil = seret ?? pilih;
  const semua = pilih[0] === rentang[0] && pilih[1] === rentang[1];

  const tahunDi = (e: React.PointerEvent<HTMLDivElement>): number => {
    const k = e.currentTarget.getBoundingClientRect();
    const posisi = Math.min(0.9999, Math.max(0, (e.clientX - k.left) / k.width));
    return tahun[Math.floor(posisi * tahun.length)];
  };

  return (
    <div className="flex h-full items-stretch gap-3 px-3 py-2" data-uji="linimasa">
      <div className="flex w-[104px] flex-none flex-col justify-between">
        <div>
          <div className="label-kecil">Linimasa</div>
          <div className="angka mt-0.5 text-[13px] font-semibold" data-uji="rentang-tahun">
            {pilih[0] === pilih[1] ? pilih[0] : `${pilih[0]}–${pilih[1]}`}
          </div>
        </div>
        <button type="button" className="tombol !min-h-[24px] !px-2 !text-[11px]" disabled={semua} onClick={() => onPilih([rentang[0], rentang[1]])}>
          Semua tahun
        </button>
      </div>
      <div
        className="relative flex min-w-0 flex-1 cursor-crosshair touch-none select-none items-end gap-[3px]"
        role="group"
        aria-label="Pilih rentang tahun"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const t = tahunDi(e);
          jangkar.current = t;
          setSeret([t, t]);
        }}
        onPointerMove={(e) => {
          if (jangkar.current === null) return;
          const t = tahunDi(e);
          setSeret([Math.min(jangkar.current, t), Math.max(jangkar.current, t)]);
        }}
        onPointerUp={() => {
          if (jangkar.current === null || !seret) return;
          jangkar.current = null;
          // klik pada tahun yang sudah jadi satu-satunya pilihan = kembali ke semua tahun
          const sama = seret[0] === seret[1] && pilih[0] === seret[0] && pilih[1] === seret[1];
          onPilih(sama ? [rentang[0], rentang[1]] : seret);
          setSeret(null);
        }}
        onPointerCancel={() => {
          jangkar.current = null;
          setSeret(null);
        }}
      >
        {tahun.map((t) => {
          const a = data.get(t);
          const dalam = t >= tampil[0] && t <= tampil[1];
          const tinggi = a ? Math.max(4, (a.nilai / maks) * 100) : 0;
          return (
            <button
              key={t}
              type="button"
              className="group flex h-full min-w-0 flex-1 flex-col items-stretch justify-end border-0 bg-transparent p-0"
              aria-pressed={dalam && !semua}
              aria-label={`${t}: ${a ? `${rupiah(a.nilai)}, ${angka(a.n)} paket` : "tidak ada paket"}`}
              title={a ? `${t}: ${rupiah(a.nilai)} · ${angka(a.n)} paket` : `${t}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPilih(pilih[0] === t && pilih[1] === t ? [rentang[0], rentang[1]] : [t, t]);
                }
              }}
            >
              <span className="relative block min-h-0 flex-1">
                <span
                  className="absolute inset-x-0 bottom-0 rounded-[1px] transition-colors"
                  style={{ height: `${tinggi}%`, background: dalam ? "var(--accent)" : "var(--border-strong)", opacity: dalam ? 0.9 : 0.7 }}
                />
                {a && a.nPola > 0 ? (
                  <span className="absolute inset-x-0 bottom-0 rounded-[1px]" style={{ height: `${tinggi * (a.nPola / a.n)}%`, background: "var(--pola)", opacity: dalam ? 0.85 : 0.35 }} />
                ) : null}
              </span>
              <span className={`angka mt-1 block text-center text-[10px] ${dalam ? "text-[var(--text)]" : "text-dim"}`}>{String(t).slice(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
