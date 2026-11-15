"use client";

import type { ReactNode } from "react";
import { angka, rupiah } from "@/lib/format";
import type { Agregat } from "@/lib/hitung";
import type { Jenis } from "@/lib/graf";
import { polaDariBit } from "@/lib/pola";
import { LABEL_JENIS, WARNA_JENIS } from "@/lib/warna";

/** Kotak angka utama di kepala berkas. */
export function Kpi({ label, nilai, kecil }: { label: string; nilai: ReactNode; kecil?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-sm border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2">
      <div className="label-kecil truncate">{label}</div>
      <div className="angka mt-0.5 truncate text-[15px] font-semibold text-[var(--text)]">{nilai}</div>
      {kecil ? <div className="mt-0.5 truncate text-[10.5px] text-muted">{kecil}</div> : null}
    </div>
  );
}

export function JudulBagian({ children, kanan }: { children: ReactNode; kanan?: ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 flex items-center justify-between gap-2">
      <h3 className="label-kecil">{children}</h3>
      {kanan}
    </div>
  );
}

export function CipJenis({ jenis }: { jenis: Jenis }) {
  return (
    <span className="cip" style={{ color: WARNA_JENIS[jenis], borderColor: `${WARNA_JENIS[jenis]}55` }}>
      <span className="titik-jenis" style={{ background: WARNA_JENIS[jenis], width: 6, height: 6 }} />
      {LABEL_JENIS[jenis].toUpperCase()}
    </span>
  );
}

/** Cip pola milik satu paket. */
export function CipPola({ bit, maks = 3 }: { bit: number; maks?: number }) {
  const daftar = polaDariBit(bit);
  if (!daftar.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {daftar.slice(0, maks).map((p) => (
        <span key={p.kunci} className="cip cip-pola" title={p.ringkas}>
          {p.label}
        </span>
      ))}
      {daftar.length > maks ? <span className="cip">+{daftar.length - maks}</span> : null}
    </span>
  );
}

/** Diagram batang mini per tahun (nilai), dengan garis kecil untuk porsi paket berpola. */
export function BatangTahun({ data, rentang }: { data: Map<number, Agregat>; rentang: [number, number] }) {
  const tahun: number[] = [];
  for (let t = rentang[0]; t <= rentang[1]; t++) tahun.push(t);
  const maks = Math.max(1, ...tahun.map((t) => data.get(t)?.nilai ?? 0));
  return (
    <div className="flex h-[64px] items-end gap-[3px]" role="img" aria-label={`Nilai per tahun ${rentang[0]} sampai ${rentang[1]}`}>
      {tahun.map((t) => {
        const a = data.get(t);
        const tinggi = a ? Math.max(3, (a.nilai / maks) * 46) : 0;
        return (
          <div key={t} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={a ? `${t}: ${rupiah(a.nilai)} · ${angka(a.n)} paket` : `${t}: tidak ada paket`}>
            <div className="w-full rounded-[1px]" style={{ height: tinggi, background: a ? "var(--accent)" : "transparent", opacity: 0.85 }} />
            <div className="mt-0.5 h-px w-full bg-[var(--border-strong)]" />
            <div className="angka mt-0.5 text-[9px] text-dim">{String(t).slice(2)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Batang porsi tipis dengan penanda angka pembanding (baseline sektor). */
export function BatangPorsi({ porsi, dasar, warna = "var(--pola)" }: { porsi: number; dasar?: number; warna?: string }) {
  return (
    <div className="relative">
      <div className="batang-latar">
        <div className="batang-isi" style={{ width: `${Math.min(100, porsi * 100)}%`, background: warna }} />
      </div>
      {dasar !== undefined ? (
        <div className="absolute -top-[2px] h-[8px] w-px bg-[var(--text)] opacity-70" style={{ left: `${Math.min(100, dasar * 100)}%` }} title="Rata-rata sektor" />
      ) : null}
    </div>
  );
}

export function Kosong({ children }: { children: ReactNode }) {
  return <div className="rounded-sm border border-dashed border-[var(--border-strong)] px-3 py-4 text-center text-[12px] text-muted">{children}</div>;
}
