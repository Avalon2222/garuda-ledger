"use client";

import { ArrowLeft, CodeXml, Database, HelpCircle, LayoutGrid, Maximize2, Minus, Palette, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { muat, type HasilMuat } from "@/lib/data";
import { angka, lamaLalu, rupiah } from "@/lib/format";
import { grafFokus, grafIkhtisar, IKHTISAR_DESKTOP, IKHTISAR_PONSEL, labelSimpul, perluas, uraiId, type Graf } from "@/lib/graf";
import { hitungPola, perTahunPenuh, ringkas, saringAktif, saringAwal } from "@/lib/hitung";
import type { Tepi } from "@/lib/kamera";
import { useLayar } from "@/lib/layar";
import { SEMBOYAN, URL_REPO } from "@/lib/situs";
import type { Saring } from "@/lib/tipe";
import { dariHash, keHash } from "@/lib/url";
import { LABEL_JENIS } from "@/lib/warna";
import Berkas from "./Berkas";
import GrafKanvas, { type KendaliGraf } from "./GrafKanvas";
import Linimasa from "./Linimasa";
import Logo from "./Logo";
import PanelMetode from "./PanelMetode";
import PanelSaring from "./PanelSaring";
import Pencarian from "./Pencarian";

/** Pintu masuk: muat data, tampilkan layar muat atau galat, lalu serahkan ke Meja. */
export default function Konsol() {
  const [hasil, setHasil] = useState<HasilMuat | null>(null);
  const [galat, setGalat] = useState(false);
  const [coba, setCoba] = useState(0);

  useEffect(() => {
    let batal = false;
    muat()
      .then((h) => {
        if (!batal) setHasil(h);
      })
      .catch(() => {
        if (!batal) setGalat(true);
      });
    return () => {
      batal = true;
    };
  }, [coba]);

  if (hasil) return <Meja hasil={hasil} />;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center" data-uji="layar-muat">
      <Logo ukuran={56} />
      <div>
        <div className="text-[18px] font-semibold tracking-[0.22em]">GARUDA LEDGER</div>
        <div className="mt-1.5 text-[12.5px] text-muted">{SEMBOYAN}</div>
      </div>
      {galat ? (
        <div role="alert">
          <p className="m-0 mb-3 text-[13px] text-pola">Data gagal dimuat. Cek koneksi lalu coba lagi.</p>
          <button type="button" className="tombol tombol-utama" onClick={() => { setGalat(false); setCoba((c) => c + 1); }}>
            Coba lagi
          </button>
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <div className="relative h-[3px] w-[220px] overflow-hidden rounded bg-[var(--panel-3)]">
            <div className="absolute inset-y-0 w-[40%] rounded bg-[var(--accent)]" style={{ animation: "pindai 1.2s ease-in-out infinite" }} />
          </div>
          <div className="label-kecil mt-3">Menyusun 44 ribu paket jadi graf…</div>
        </div>
      )}
    </div>
  );
}

type Lembar = "intip" | "setengah" | "penuh";
const TINGGI_LEMBAR: Record<Lembar, string> = { intip: "74px", setengah: "52dvh", penuh: "calc(100dvh - 56px)" };

function sedangMengetik(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

function Meja({ hasil }: { hasil: HasilMuat }) {
  const l = hasil.ledger;
  const layar = useLayar();
  const awal = useMemo(() => dariHash(l, typeof window === "undefined" ? "" : window.location.hash), [l]);

  const [saring, setSaring] = useState<Saring>(awal.saring);
  const [pilih, setPilih] = useState<string | null>(awal.pilih);
  const [fokus, setFokus] = useState<string | null>(awal.fokus ?? (awal.pilih && uraiId(awal.pilih)?.jenis !== "tender" ? awal.pilih : null));
  const [riwayat, setRiwayat] = useState<(string | null)[]>([]);
  const [perluasan, setPerluasan] = useState<string[]>(awal.pilih && uraiId(awal.pilih)?.jenis === "tender" && !awal.fokus ? [awal.pilih] : []);
  const [lensaPola, setLensaPola] = useState(awal.lensaPola);
  const [dialog, setDialog] = useState<"cari" | "metode" | "bantuan" | null>(null);
  const [laci, setLaci] = useState(false);
  const [lembar, setLembar] = useState<Lembar>(awal.pilih ? "setengah" : "intip");
  const [roti, setRoti] = useState<string | null>(null);
  const kendali = useRef<KendaliGraf>(null);
  const gulungBerkas = useRef<HTMLDivElement>(null);

  const r = useMemo(() => ringkas(l, saring), [l, saring]);
  const hitunganPola = useMemo(() => hitungPola(l, saring), [l, saring]);
  const tahunan = useMemo(() => perTahunPenuh(l, saring), [l, saring]);
  const aktif = saringAktif(l, saring);
  const ponsel = layar === "ponsel";

  const graf: Graf = useMemo(() => {
    const opsi = ponsel ? IKHTISAR_PONSEL : IKHTISAR_DESKTOP;
    let g = (fokus ? grafFokus(l, r, saring, fokus) : null) ?? grafIkhtisar(l, r, opsi);
    for (const id of perluasan) g = perluas(l, r, saring, g, id);
    return g;
  }, [l, r, saring, fokus, perluasan, ponsel]);
  const adaDiGraf = useMemo(() => new Set(graf.simpul.map((s) => s.id)), [graf]);
  const kunciTampilan = `${fokus ?? "ikhtisar"}|${saring.tahun.join("-")}|${saring.instansi.join(".")}|${saring.kategori.join(".")}|${saring.pola}`;

  const tampilkanRoti = useCallback((teks: string) => {
    setRoti(teks);
    window.setTimeout(() => setRoti((kini) => (kini === teks ? null : kini)), 2200);
  }, []);

  const pilihSimpul = useCallback(
    (id: string | null) => {
      setPilih(id);
      if (!id) return;
      // entitas yang belum ada di graf ditambahkan beserta lingkungannya, bukan mengganti seluruh tampilan
      if (!adaDiGraf.has(id)) setPerluasan((p) => (p.includes(id) ? p : [...p, id]));
      setLembar((x) => (x === "intip" ? "setengah" : x));
      gulungBerkas.current?.scrollTo({ top: 0 });
    },
    [adaDiGraf],
  );

  const fokusPada = useCallback(
    (id: string | null) => {
      setRiwayat((h) => [...h.slice(-19), fokus]);
      setFokus(id);
      setPerluasan([]);
      if (id) {
        setPilih(id);
        setLembar((x) => (x === "intip" ? "setengah" : x));
      }
      gulungBerkas.current?.scrollTo({ top: 0 });
    },
    [fokus],
  );

  const kembali = useCallback(() => {
    if (!riwayat.length) return;
    const sebelum = riwayat[riwayat.length - 1];
    setRiwayat(riwayat.slice(0, -1));
    setFokus(sebelum);
    setPerluasan([]);
    setPilih(sebelum);
  }, [riwayat]);

  const perluasSimpul = useCallback((id: string) => {
    setPerluasan((p) => [...p.filter((x) => x !== id), id]);
  }, []);

  const salinTautan = useCallback(
    (id: string) => {
      const hash = keHash(l, { pilih: id, fokus: fokus ?? (uraiId(id)?.jenis === "tender" ? null : id), saring, lensaPola });
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      const selesai = () => tampilkanRoti("Tautan disalin");
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(selesai, () => tampilkanRoti("Gagal menyalin tautan"));
      else tampilkanRoti("Browser ini tidak mengizinkan salin otomatis");
    },
    [l, fokus, saring, lensaPola, tampilkanRoti],
  );

  // keadaan -> hash URL, supaya tampilan apa pun bisa dibagikan
  useEffect(() => {
    const hash = keHash(l, { pilih, fokus, saring, lensaPola });
    const tujuan = `${window.location.pathname}${window.location.search}${hash}`;
    if (tujuan !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", tujuan);
  }, [l, pilih, fokus, saring, lensaPola]);

  // pintasan papan ketik
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog((d) => (d === "cari" ? null : "cari"));
        return;
      }
      if (e.key === "Escape") {
        if (dialog) setDialog(null);
        else if (laci) setLaci(false);
        else if (pilih) setPilih(null);
        return;
      }
      if (dialog || sedangMengetik(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "/") { e.preventDefault(); setDialog("cari"); }
      else if (k === "f") kendali.current?.paskan();
      else if (k === "l") setLensaPola((x) => !x);
      else if (k === "i") fokusPada(null);
      else if (k === "m") setDialog("metode");
      else if (k === "?") setDialog("bantuan");
      else if (k === "backspace") kembali();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [dialog, laci, pilih, fokusPada, kembali]);

  const tepi: Tepi = useMemo(
    () => (ponsel ? { atas: 60, kanan: 44, bawah: lembar === "intip" ? 104 : Math.round(window.innerHeight * 0.52) + 20, kiri: 44 } : { atas: 64, kanan: 70, bawah: 40, kiri: 60 }),
    [ponsel, lembar],
  );

  const panelSaring = (
    <PanelSaring
      l={l}
      saring={saring}
      r={r}
      hitunganPola={hitunganPola}
      aktif={aktif}
      lensaPola={lensaPola}
      onSaring={setSaring}
      onLensa={setLensaPola}
      onAturUlang={() => setSaring(saringAwal(l))}
    />
  );
  const linimasa = <Linimasa rentang={l.meta.rentang} pilih={saring.tahun} data={tahunan} onPilih={(tahun) => setSaring({ ...saring, tahun })} />;
  const berkas = (
    <Berkas
      l={l}
      saring={saring}
      r={r}
      id={pilih}
      onPilih={pilihSimpul}
      onFokus={fokusPada}
      onPerluas={perluasSimpul}
      onSalin={salinTautan}
      onKembali={riwayat.length ? kembali : undefined}
    />
  );
  const labelFokus = fokus ? labelSimpul(l, fokus) : null;
  const jenisFokus = fokus ? uraiId(fokus)?.jenis : null;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      {/* ---------- bilah atas */}
      <header className="panel relative z-30 flex h-12 flex-none items-center gap-2 border-x-0 border-t-0 px-2.5 md:px-3" role="banner">
        {layar !== "desktop" ? (
          <button type="button" className="tombol-ikon" aria-pressed={laci} aria-label="Filter dan legenda" title="Filter" onClick={() => setLaci((x) => !x)}>
            <SlidersHorizontal size={17} />
            {aktif ? <span className="absolute ml-5 mt-[-14px] h-1.5 w-1.5 rounded-full bg-[var(--pola)]" /> : null}
          </button>
        ) : null}
        <button type="button" className="flex flex-none items-center gap-2 border-0 bg-transparent p-0 text-[var(--text)]" onClick={() => { fokusPada(null); setPilih(null); }} title="Kembali ke ikhtisar" aria-label="Garuda Ledger, kembali ke ikhtisar">
          <Logo />
          <span className="hidden text-[13px] font-semibold tracking-[0.2em] min-[400px]:inline">GARUDA LEDGER</span>
        </button>
        <button
          type="button"
          className="ml-1 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--panel-2)] px-2.5 text-left text-muted hover:border-[#3a4759] md:ml-4 md:max-w-[420px]"
          onClick={() => setDialog("cari")}
          aria-label="Cari vendor, satker, atau paket"
          data-uji="tombol-cari"
        >
          <Search size={15} className="flex-none" />
          <span className="min-w-0 flex-1 truncate text-[12.5px]">Cari vendor, satker, paket…</span>
          <kbd className="cip hidden flex-none md:inline-flex">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex flex-none items-center gap-1">
          <span className="angka mr-2 hidden text-[11.5px] text-muted xl:inline" data-uji="angka-kepala">
            {angka(r.n)} paket · {rupiah(r.nilai)}
          </span>
          <button type="button" className="tombol hidden lg:inline-flex" onClick={() => setDialog("metode")} title="Sumber data, pipeline, dan definisi pola (M)">
            <Database size={14} /> Data &amp; metode
            <span className="text-dim">· dicek {lamaLalu(hasil.status?.dicek)}</span>
          </button>
          <button type="button" className="tombol-ikon lg:hidden" onClick={() => setDialog("metode")} aria-label="Data dan metode" title="Data & metode">
            <Database size={17} />
          </button>
          <button type="button" className="tombol-ikon" onClick={() => setDialog("bantuan")} aria-label="Bantuan dan pintasan" title="Bantuan (?)">
            <HelpCircle size={17} />
          </button>
          <a className="tombol-ikon hidden sm:inline-flex" href={URL_REPO} target="_blank" rel="noreferrer" aria-label="Kode sumber di GitHub" title="Kode sumber">
            <CodeXml size={17} />
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- panel kiri (desktop) */}
        {layar === "desktop" ? (
          <aside className="panel w-[264px] flex-none overflow-y-auto border-y-0 border-l-0" aria-label="Filter dan legenda">
            {panelSaring}
          </aside>
        ) : null}

        {/* ---------- graf */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <GrafKanvas ref={kendali} graf={graf} kunciTampilan={kunciTampilan} pilih={pilih} lensaPola={lensaPola} tepi={tepi} onPilih={pilihSimpul} onFokus={fokusPada} />

            <div className="pointer-events-none absolute left-2.5 right-14 top-2.5 flex items-start gap-1.5 md:left-3">
              {riwayat.length ? (
                <button type="button" className="tombol panel-kaca pointer-events-auto !px-2" onClick={kembali} aria-label="Kembali ke tampilan sebelumnya" title="Kembali (Backspace)">
                  <ArrowLeft size={14} />
                </button>
              ) : null}
              <div className="panel-kaca pointer-events-auto flex min-w-0 items-center gap-2 rounded-[3px] px-2.5 py-1.5" data-uji="cip-tampilan">
                <span className="label-kecil flex-none">{fokus ? `Fokus · ${jenisFokus ? LABEL_JENIS[jenisFokus] : ""}` : "Ikhtisar"}</span>
                <span className="min-w-0 truncate text-[12px]">{labelFokus ?? "Vendor terbesar tiap instansi dan pembelinya"}</span>
                {fokus ? (
                  <button type="button" className="flex flex-none items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] text-accent hover:underline" onClick={() => fokusPada(null)}>
                    <LayoutGrid size={12} /> Ikhtisar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="absolute right-2.5 top-2.5 flex flex-col gap-1 md:bottom-3 md:right-3 md:top-auto">
              <button type="button" className="tombol-ikon panel-kaca" onClick={() => kendali.current?.zum(1.3)} aria-label="Perbesar" title="Perbesar (+)">
                <Plus size={16} />
              </button>
              <button type="button" className="tombol-ikon panel-kaca" onClick={() => kendali.current?.zum(1 / 1.3)} aria-label="Perkecil" title="Perkecil (-)">
                <Minus size={16} />
              </button>
              <button type="button" className="tombol-ikon panel-kaca" onClick={() => kendali.current?.paskan()} aria-label="Tampilkan semua simpul" title="Tampilkan semua (F)">
                <Maximize2 size={15} />
              </button>
              <button type="button" className="tombol-ikon panel-kaca" aria-pressed={lensaPola} onClick={() => setLensaPola((x) => !x)} aria-label="Lensa pola ganda" title="Warnai simpul menurut porsi paket berpola ganda (L)">
                <Palette size={15} />
              </button>
            </div>

            {graf.simpul.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <p className="m-0 text-[13px] text-muted">Tidak ada paket yang cocok dengan filter ini.</p>
                  <button type="button" className="tombol mt-3" onClick={() => setSaring(saringAwal(l))}>
                    Atur ulang filter
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {ponsel ? null : <div className="panel h-[96px] flex-none border-x-0 border-b-0">{linimasa}</div>}
        </main>

        {/* ---------- panel kanan (tablet & desktop) */}
        {ponsel ? null : (
          <aside ref={gulungBerkas} className="panel w-[340px] flex-none overflow-y-auto border-y-0 border-r-0 xl:w-[392px]" aria-label="Berkas">
            {berkas}
          </aside>
        )}
      </div>

      {/* ---------- lembar bawah (ponsel) */}
      {ponsel ? (
        <section className="lembar panel-kaca fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl border-x-0 border-b-0" style={{ height: TINGGI_LEMBAR[lembar] }} aria-label="Berkas" data-uji="lembar" data-posisi={lembar}>
          <PegangLembar lembar={lembar} onUbah={setLembar} judul={pilih ? labelSimpul(l, pilih) : `${angka(r.n)} paket · ${rupiah(r.nilai)}`} sub={pilih ? LABEL_JENIS[uraiId(pilih)?.jenis ?? "vendor"] : "Ringkasan sektor"} />
          <div ref={gulungBerkas} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" hidden={lembar === "intip"}>
            {berkas}
          </div>
        </section>
      ) : null}

      {/* ---------- laci filter (ponsel & tablet) */}
      {layar !== "desktop" && laci ? (
        <div className="fixed inset-0 z-40 flex bg-black/55" onPointerDown={(e) => { if (e.target === e.currentTarget) setLaci(false); }}>
          <aside className="panel muncul flex h-full w-[min(320px,88vw)] flex-col border-y-0 border-l-0" role="dialog" aria-modal="true" aria-label="Filter dan legenda">
            <div className="flex h-12 flex-none items-center justify-between border-b border-[var(--border)] px-3">
              <span className="label-kecil">Filter &amp; legenda</span>
              <button type="button" className="tombol-ikon" onClick={() => setLaci(false)} aria-label="Tutup filter">
                <X size={17} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {ponsel ? <div className="h-[104px] border-b border-[var(--border)]">{linimasa}</div> : null}
              {panelSaring}
            </div>
          </aside>
        </div>
      ) : null}

      {dialog === "cari" ? <Pencarian l={l} onTutup={() => setDialog(null)} onPilih={(id) => { setDialog(null); if (uraiId(id)?.jenis === "tender") pilihSimpul(id); else fokusPada(id); }} /> : null}
      {dialog === "metode" ? <PanelMetode l={l} status={hasil.status} asal={hasil.asal} onTutup={() => setDialog(null)} /> : null}
      {dialog === "bantuan" ? <Bantuan onTutup={() => setDialog(null)} /> : null}

      {roti ? (
        <div className="panel-kaca muncul fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-[3px] px-3 py-2 text-[12.5px] md:bottom-28" role="status">
          {roti}
        </div>
      ) : null}
    </div>
  );
}

/** Pegangan lembar bawah: ketuk untuk berganti posisi, atau seret naik/turun. */
function PegangLembar({ lembar, onUbah, judul, sub }: { lembar: Lembar; onUbah: (l: Lembar) => void; judul: string; sub: string }) {
  const mulai = useRef<number | null>(null);
  const urutan: Lembar[] = ["intip", "setengah", "penuh"];
  const geser = (arah: 1 | -1) => onUbah(urutan[Math.min(2, Math.max(0, urutan.indexOf(lembar) + arah))]);
  return (
    <button
      type="button"
      className="flex-none touch-none border-0 bg-transparent px-4 pb-2.5 pt-2 text-left text-[var(--text)]"
      aria-label={`${judul}. ${lembar === "penuh" ? "Kecilkan" : "Buka"} berkas`}
      aria-expanded={lembar !== "intip"}
      data-uji="pegang-lembar"
      onPointerDown={(e) => { mulai.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={(e) => {
        const dy = mulai.current === null ? 0 : e.clientY - mulai.current;
        mulai.current = null;
        if (dy < -24) geser(1);
        else if (dy > 24) geser(-1);
        else onUbah(lembar === "intip" ? "setengah" : lembar === "setengah" ? "penuh" : "intip");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onUbah(lembar === "intip" ? "setengah" : lembar === "setengah" ? "penuh" : "intip");
        }
      }}
    >
      <span className="mx-auto block h-1 w-10 rounded-full bg-[var(--border-strong)]" />
      {/* judul hanya saat lembar mengintip; kalau terbuka, kepala berkas di bawahnya sudah memuat judul yang sama */}
      {lembar === "intip" ? (
        <>
          <span className="label-kecil mt-2 block">{sub}</span>
          <span className="mt-0.5 block truncate text-[14px] font-semibold">{judul}</span>
        </>
      ) : null}
    </button>
  );
}

const PINTASAN: [string, string][] = [
  ["Ctrl K  atau  /", "Cari vendor, satker, atau paket"],
  ["Klik simpul", "Buka berkasnya"],
  ["Klik dua kali", "Pusatkan graf di simpul itu"],
  ["Seret simpul", "Pindahkan simpul"],
  ["Seret latar · gulir", "Geser dan zoom (cubit di layar sentuh)"],
  ["F", "Tampilkan semua simpul"],
  ["L", "Lensa warna: jenis simpul ↔ porsi pola ganda"],
  ["I", "Kembali ke ikhtisar"],
  ["Backspace", "Tampilan sebelumnya"],
  ["M", "Data & metode"],
  ["Esc", "Tutup dialog / lepas pilihan"],
];

function Bantuan({ onTutup }: { onTutup: () => void }) {
  const kotak = useRef<HTMLDivElement>(null);
  useEffect(() => {
    kotak.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-3 py-[6vh]" onPointerDown={(e) => { if (e.target === e.currentTarget) onTutup(); }}>
      <div ref={kotak} tabIndex={-1} className="panel-kaca muncul w-full max-w-[520px] rounded-md outline-none" role="dialog" aria-modal="true" aria-labelledby="judul-bantuan" data-uji="bantuan">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-strong)] px-5 py-4">
          <div>
            <div className="label-kecil">Bantuan</div>
            <h2 id="judul-bantuan" className="m-0 mt-1 text-[17px] font-semibold">Cara membaca graf ini</h2>
          </div>
          <button type="button" className="tombol-ikon" onClick={onTutup} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 pb-5 pt-4 text-[12.5px] leading-relaxed">
          <p className="m-0 text-muted">
            Tiap simpul adalah instansi, unit, satker, vendor, paket, atau pemilik. Garis antara satker dan vendor berarti
            vendor itu pernah menang tender di sana; makin tebal garisnya, makin besar nilainya. Busur jingga di tepi simpul
            menunjukkan porsi paket yang punya dua pola statistik atau lebih sekaligus.
          </p>
          <table className="tabel-paket mt-4">
            <tbody>
              {PINTASAN.map(([tombol, arti]) => (
                <tr key={tombol}>
                  <td className="whitespace-nowrap"><kbd className="cip angka">{tombol}</kbd></td>
                  <td className="text-muted">{arti}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-4 text-[11.5px] text-dim">
            Pola adalah hitungan dari data pengadaan terbuka, bukan temuan audit dan bukan tuduhan terhadap siapa pun.
            Proyek pribadi, tidak berafiliasi dengan instansi mana pun.
          </p>
        </div>
      </div>
    </div>
  );
}
