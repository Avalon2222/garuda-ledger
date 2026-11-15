"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buatIndeks, cari } from "@/lib/cari";
import { idSimpul } from "@/lib/graf";
import type { Ledger } from "@/lib/tipe";
import { LABEL_JENIS, WARNA_JENIS } from "@/lib/warna";

interface Props {
  l: Ledger;
  onPilih: (id: string) => void;
  onTutup: () => void;
}

/** Palet pencarian (Ctrl+K atau /): vendor, satker, unit, instansi, pemilik, dan judul atau kode paket. */
export default function Pencarian({ l, onPilih, onTutup }: Props) {
  const [kueri, setKueri] = useState("");
  const [aktif, setAktif] = useState(0);
  const masukan = useRef<HTMLInputElement>(null);
  const daftar = useRef<HTMLUListElement>(null);
  const indeks = useMemo(() => buatIndeks(l), [l]);
  const hasil = useMemo(() => cari(l, indeks, kueri), [l, indeks, kueri]);
  // sebelum mengetik: tawarkan lima vendor terbesar sebagai titik berangkat
  const saran = useMemo(
    () => l.vendor.slice(0, 5).map((v, i) => ({ id: idSimpul("vendor", i), jenis: "vendor" as const, judul: v.nama, ket: `Vendor · peringkat ${i + 1}`, skor: 0 })),
    [l],
  );
  const tampil = kueri.trim().length >= 2 ? hasil : saran;

  useEffect(() => {
    masukan.current?.focus();
  }, []);

  useEffect(() => {
    daftar.current?.querySelector<HTMLElement>(`[data-urut="${aktif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktif]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[9vh]" onPointerDown={(e) => { if (e.target === e.currentTarget) onTutup(); }}>
      <div className="panel-kaca muncul flex max-h-[76vh] w-full max-w-[600px] flex-col rounded-md" role="dialog" aria-modal="true" aria-label="Pencarian">
        <div className="flex items-center gap-2 border-b border-[var(--border-strong)] px-3">
          <Search size={16} className="flex-none text-muted" />
          <input
            ref={masukan}
            value={kueri}
            onChange={(e) => { setKueri(e.target.value); setAktif(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setAktif((a) => Math.min(tampil.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && tampil[aktif]) { e.preventDefault(); onPilih(tampil[aktif].id); }
              else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onTutup(); }
            }}
            placeholder="Cari vendor, satker, judul paket, atau kode tender…"
            className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-dim"
            role="combobox"
            aria-expanded="true"
            aria-controls="hasil-cari"
            aria-activedescendant={tampil[aktif] ? `cari-${aktif}` : undefined}
            aria-label="Cari vendor, satker, atau paket"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cip flex-none">Esc</kbd>
        </div>
        <div className="label-kecil px-3 pb-1 pt-2.5">{kueri.trim().length >= 2 ? `${hasil.length} hasil` : "Mulai dari vendor terbesar"}</div>
        <ul ref={daftar} id="hasil-cari" role="listbox" aria-label="Hasil pencarian" className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1.5 pt-0">
          {tampil.map((h, i) => (
            <li key={h.id} id={`cari-${i}`} role="option" aria-selected={i === aktif} data-urut={i}>
              <button
                type="button"
                className="baris"
                aria-pressed={i === aktif}
                onPointerMove={() => setAktif(i)}
                onClick={() => onPilih(h.id)}
                tabIndex={-1}
              >
                <span className="titik-jenis" style={{ background: WARNA_JENIS[h.jenis] }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{h.judul}</span>
                  <span className="block truncate text-[11px] text-dim">{h.ket}</span>
                </span>
                <span className="cip flex-none" style={{ color: WARNA_JENIS[h.jenis] }}>{LABEL_JENIS[h.jenis]}</span>
              </button>
            </li>
          ))}
          {kueri.trim().length >= 2 && hasil.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12.5px] text-muted">Tidak ada yang cocok dengan “{kueri.trim()}”. Coba nama tanpa PT/CV, atau kode tender.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
