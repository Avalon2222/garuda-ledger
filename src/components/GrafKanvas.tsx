"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { rupiah } from "@/lib/format";
import type { Graf, Simpul } from "@/lib/graf";
import type { Tepi } from "@/lib/kamera";
import { Pelukis } from "@/lib/pelukis";
import { Tata } from "@/lib/tata";
import { LABEL_JENIS, WARNA_JENIS } from "@/lib/warna";

export interface KendaliGraf {
  paskan: () => void;
  zum: (faktor: number) => void;
  pusatkan: (id: string) => void;
}

interface Props {
  graf: Graf;
  /** berubah tiap kali tampilan diganti (ikhtisar, fokus X); dipakai untuk memutuskan kapan kamera di-paskan ulang */
  kunciTampilan: string;
  pilih: string | null;
  lensaPola: boolean;
  tepi: Tepi;
  onPilih: (id: string | null) => void;
  onFokus: (id: string) => void;
}

interface Petunjuk {
  simpul: Simpul;
  x: number;
  y: number;
}

const GESER_MIN = 5;
const JEDA_KLIK_GANDA = 340;

type KanvasUji = HTMLCanvasElement & { __layar?: (id: string) => [number, number] | null };

/** Kanvas graf: simulasi gaya + pelukis + semua interaksi penunjuk (geser, cubit, seret simpul, klik, klik ganda). */
const GrafKanvas = forwardRef<KendaliGraf, Props>(function GrafKanvas({ graf, kunciTampilan, pilih, lensaPola, tepi, onPilih, onFokus }, ref) {
  const bungkus = useRef<HTMLDivElement>(null);
  const kanvas = useRef<KanvasUji>(null);
  const pelukis = useRef<Pelukis | null>(null);
  const tata = useRef<Tata | null>(null);
  const kunciLama = useRef("");
  const grafLama = useRef<Graf>({ simpul: [], sisi: [] });
  /** true setelah pengguna menggeser/zoom di tampilan ini; kamera otomatis berhenti ikut campur */
  const disentuh = useRef(false);
  const aksi = useRef({ onPilih, onFokus });
  const [petunjuk, setPetunjuk] = useState<Petunjuk | null>(null);

  useEffect(() => {
    aksi.current = { onPilih, onFokus };
  }, [onPilih, onFokus]);

  useImperativeHandle(ref, () => ({
    paskan: () => {
      disentuh.current = false;
      pelukis.current?.paskan();
    },
    zum: (f) => {
      disentuh.current = true;
      pelukis.current?.zum(f, undefined, undefined, true);
    },
    pusatkan: (id) => pelukis.current?.pusatkan(id),
  }));

  // siapkan pelukis, simulasi, dan pengamat ukuran sekali saja
  useEffect(() => {
    const el = kanvas.current;
    const wadah = bungkus.current;
    if (!el || !wadah) return;
    const p = new Pelukis(el);
    const t = new Tata(() => p.minta());
    p.masihGerak = () => t.aktif;
    // begitu graf selesai merapikan diri, bingkai ulang, kecuali pengguna sudah menggeser atau zoom sendiri
    t.saatDiam = () => {
      if (!disentuh.current) p.paskan();
    };
    p.opsi.tenang = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pelukis.current = p;
    tata.current = t;
    el.__layar = (id) => p.layar(id);

    // ukuran awal diambil langsung (bukan menunggu ResizeObserver) supaya simulasi pertama sudah tahu bentuk layar
    const ukur = () => {
      const k = wadah.getBoundingClientRect();
      if (k.width < 2 || k.height < 2) return;
      p.ukuran(k.width, k.height, Math.min(2, window.devicePixelRatio || 1));
      t.bentuk(k.width / k.height);
    };
    ukur();
    const amati = new ResizeObserver(ukur);
    amati.observe(wadah);
    return () => {
      amati.disconnect();
      t.hentikan();
      p.hancurkan();
      pelukis.current = null;
      tata.current = null;
    };
  }, []);

  // graf baru: pasang ke simulasi; kamera di-paskan hanya kalau tampilannya memang berganti
  useEffect(() => {
    const p = pelukis.current;
    const t = tata.current;
    if (!p || !t) return;
    const pertama = kunciLama.current === "";
    const ganti = kunciLama.current !== kunciTampilan;
    kunciLama.current = kunciTampilan;
    // simpul yang sudah tampil di graf sebelumnya mewarisi posisinya, jadi pergantian tampilan terasa bersambung
    const posisi = new Map(grafLama.current.simpul.map((s) => [s.id, s]));
    for (const s of graf.simpul) {
      const lama = posisi.get(s.id);
      if (lama && lama !== s && s.x === undefined && lama.x !== undefined) {
        s.x = lama.x;
        s.y = lama.y;
      }
    }
    grafLama.current = graf;
    t.pasang(graf, ganti ? 220 : 40);
    p.atur(graf);
    if (ganti) {
      disentuh.current = false;
      p.paskan(pertama);
    }
    queueMicrotask(() => setPetunjuk(null));
  }, [graf, kunciTampilan]);

  useEffect(() => {
    const p = pelukis.current;
    if (!p) return;
    p.pilih = pilih;
    p.opsi.lensaPola = lensaPola;
    p.tepi = tepi;
    p.minta();
  }, [pilih, lensaPola, tepi]);

  // interaksi penunjuk
  useEffect(() => {
    const el = kanvas.current;
    if (!el) return;
    const jari = new Map<number, { x: number; y: number }>();
    let mulai: { x: number; y: number; simpul: Simpul | null; geser: boolean } | null = null;
    let cubit: { jarak: number } | null = null;
    let klikTerakhir = { id: "", waktu: 0 };

    const posisi = (e: PointerEvent | WheelEvent | MouseEvent): [number, number] => {
      const k = el.getBoundingClientRect();
      return [e.clientX - k.left, e.clientY - k.top];
    };

    const turun = (e: PointerEvent) => {
      const p = pelukis.current;
      if (!p) return;
      el.setPointerCapture(e.pointerId);
      const [x, y] = posisi(e);
      jari.set(e.pointerId, { x, y });
      if (jari.size === 2) {
        const [a, b] = [...jari.values()];
        cubit = { jarak: Math.hypot(a.x - b.x, a.y - b.y) };
        mulai = null;
        return;
      }
      mulai = { x, y, simpul: p.cari(x, y), geser: false };
      setPetunjuk(null);
    };

    const gerak = (e: PointerEvent) => {
      const p = pelukis.current;
      const t = tata.current;
      if (!p || !t) return;
      const [x, y] = posisi(e);
      const lama = jari.get(e.pointerId);
      if (lama) jari.set(e.pointerId, { x, y });

      if (cubit && jari.size === 2) {
        const [a, b] = [...jari.values()];
        const jarak = Math.hypot(a.x - b.x, a.y - b.y);
        disentuh.current = true;
        if (cubit.jarak > 0) p.zum(jarak / cubit.jarak, (a.x + b.x) / 2, (a.y + b.y) / 2);
        cubit.jarak = jarak;
        return;
      }

      if (mulai && lama) {
        if (!mulai.geser && Math.hypot(x - mulai.x, y - mulai.y) < GESER_MIN) return;
        if (!mulai.geser) {
          mulai.geser = true;
          if (mulai.simpul) t.panaskan(0.3);
        }
        if (mulai.simpul) {
          disentuh.current = true;
          const [wx, wy] = p.dunia(x, y);
          mulai.simpul.fx = wx;
          mulai.simpul.fy = wy;
          p.minta();
        } else {
          disentuh.current = true;
          p.geser(x - lama.x, y - lama.y);
        }
        return;
      }

      // hover (mouse saja; di layar sentuh tidak ada hover)
      if (e.pointerType === "mouse") {
        const s = p.cari(x, y);
        const id = s?.id ?? null;
        if (id !== p.hover) {
          p.hover = id;
          p.minta();
          el.style.cursor = id ? "pointer" : "grab";
          setPetunjuk(s ? { simpul: s, x, y } : null);
        } else if (s) {
          setPetunjuk({ simpul: s, x, y });
        }
      }
    };

    const naik = (e: PointerEvent) => {
      const p = pelukis.current;
      const t = tata.current;
      jari.delete(e.pointerId);
      if (jari.size < 2) cubit = null;
      if (!p || !t || !mulai) return;
      const { simpul, geser } = mulai;
      mulai = null;
      if (geser) {
        if (simpul) {
          // simpul yang diseret dilepas lagi supaya graf tetap bisa merapikan diri
          simpul.fx = null;
          simpul.fy = null;
          t.dinginkan();
        }
        return;
      }
      const kini = performance.now();
      if (simpul && klikTerakhir.id === simpul.id && kini - klikTerakhir.waktu < JEDA_KLIK_GANDA) {
        klikTerakhir = { id: "", waktu: 0 };
        aksi.current.onFokus(simpul.id);
        return;
      }
      klikTerakhir = { id: simpul?.id ?? "", waktu: kini };
      aksi.current.onPilih(simpul?.id ?? null);
    };

    const batal = (e: PointerEvent) => {
      jari.delete(e.pointerId);
      cubit = null;
      if (mulai?.simpul) {
        mulai.simpul.fx = null;
        mulai.simpul.fy = null;
      }
      mulai = null;
    };

    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = posisi(e);
      // trackpad mengirim delta kecil dan sering; roda mouse mengirim langkah besar
      disentuh.current = true;
      const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016));
      pelukis.current?.zum(faktor, x, y);
    };

    const keluar = () => {
      const p = pelukis.current;
      if (p && p.hover) {
        p.hover = null;
        p.minta();
      }
      setPetunjuk(null);
    };

    const tombol = (e: KeyboardEvent) => {
      const p = pelukis.current;
      if (!p) return;
      const langkah = 60;
      if (e.key === "ArrowLeft") p.geser(langkah, 0);
      else if (e.key === "ArrowRight") p.geser(-langkah, 0);
      else if (e.key === "ArrowUp") p.geser(0, langkah);
      else if (e.key === "ArrowDown") p.geser(0, -langkah);
      else if (e.key === "+" || e.key === "=") p.zum(1.25, undefined, undefined, true);
      else if (e.key === "-") p.zum(0.8, undefined, undefined, true);
      else if (e.key === "0") p.paskan();
      else return;
      e.preventDefault();
    };

    el.addEventListener("pointerdown", turun);
    el.addEventListener("pointermove", gerak);
    el.addEventListener("pointerup", naik);
    el.addEventListener("pointercancel", batal);
    el.addEventListener("pointerleave", keluar);
    el.addEventListener("wheel", roda, { passive: false });
    el.addEventListener("keydown", tombol);
    return () => {
      el.removeEventListener("pointerdown", turun);
      el.removeEventListener("pointermove", gerak);
      el.removeEventListener("pointerup", naik);
      el.removeEventListener("pointercancel", batal);
      el.removeEventListener("pointerleave", keluar);
      el.removeEventListener("wheel", roda);
      el.removeEventListener("keydown", tombol);
    };
  }, []);

  // daftar simpul untuk pembaca layar dan navigasi keyboard: graf di kanvas tidak terbaca tanpa ini
  const daftar = [...graf.simpul].sort((a, b) => b.nilai - a.nilai).slice(0, 60);

  return (
    <div ref={bungkus} className="absolute inset-0 overflow-hidden" data-uji="graf" data-simpul={graf.simpul.length} data-sisi={graf.sisi.length}>
      <canvas
        ref={kanvas}
        tabIndex={0}
        role="img"
        aria-label={`Graf keterkaitan: ${graf.simpul.length} simpul, ${graf.sisi.length} hubungan. Panah untuk menggeser, plus dan minus untuk zoom, nol untuk menampilkan semua.`}
        className="block h-full w-full touch-none select-none outline-none"
        style={{ cursor: "grab" }}
      />
      {petunjuk ? (
        <div
          className="panel-kaca pointer-events-none absolute z-10 max-w-[260px] rounded-sm px-2.5 py-2"
          style={{ left: Math.min(petunjuk.x + 14, (bungkus.current?.clientWidth ?? 600) - 270), top: petunjuk.y + 16 }}
        >
          <div className="flex items-center gap-1.5">
            <span className="titik-jenis" style={{ background: WARNA_JENIS[petunjuk.simpul.jenis] }} />
            <span className="label-kecil">{LABEL_JENIS[petunjuk.simpul.jenis]}</span>
          </div>
          <div className="mt-1 text-[12.5px] font-semibold leading-snug">{petunjuk.simpul.label}</div>
          {petunjuk.simpul.n > 0 ? (
            <div className="angka mt-1 text-[11.5px] text-muted">
              {rupiah(petunjuk.simpul.nilai)} · {petunjuk.simpul.n.toLocaleString("id-ID")} paket
              {petunjuk.simpul.porsiPola > 0 && petunjuk.simpul.jenis !== "tender" ? (
                <span className="text-pola"> · {Math.round(petunjuk.simpul.porsiPola * 100)}% pola ganda</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <nav aria-label="Simpul di graf" className="sr-only">
        <ul>
          {daftar.map((s) => (
            <li key={s.id}>
              <button type="button" data-id={s.id} onClick={() => onPilih(s.id)}>
                {LABEL_JENIS[s.jenis]}: {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
});

export default GrafKanvas;
