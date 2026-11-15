"use client";

import { ArrowLeft, Crosshair, Download, ExternalLink, Link2, Network, X } from "lucide-react";
import { useMemo, useState } from "react";
import { angka, persen, rapikanJudul, rupiah, rupiahPenuh, tanggal } from "@/lib/format";
import { idSimpul, uraiId, type Jenis } from "@/lib/graf";
import { barisInstansi, barisUnit, hhi, labelHhi, peringkat, profil, vendorMilik, JARAK, type Profil, type Ringkasan } from "@/lib/hitung";
import { POLA, polaDariBit } from "@/lib/pola";
import type { Ledger, Saring } from "@/lib/tipe";
import { unduhCsv } from "@/lib/unduh";
import { BatangPorsi, BatangTahun, CipJenis, CipPola, JudulBagian, Kosong, Kpi } from "./Kecil";

export interface AksiBerkas {
  onPilih: (id: string | null) => void;
  onFokus: (id: string) => void;
  onPerluas: (id: string) => void;
  onSalin: (id: string) => void;
  onKembali?: () => void;
}

interface Props extends AksiBerkas {
  l: Ledger;
  saring: Saring;
  r: Ringkasan;
  id: string | null;
}

const BUKTI: Record<string, string> = {
  id: "ID penyedia sama",
  nama_pt: "nama PT sama (unik nasional)",
  nama_lpse: "nama sama di LPSE yang sama",
};

/** Panel kanan: berkas (dossier) entitas terpilih, atau ringkasan sektor kalau belum ada yang dipilih. */
export default function Berkas(p: Props) {
  const u = p.id ? uraiId(p.id) : null;
  if (!p.id || !u) return <RingkasanSektor {...p} />;
  switch (u.jenis) {
    case "vendor": return <BerkasVendor {...p} id={p.id} v={u.indeks} />;
    case "satker": return <BerkasSatker {...p} id={p.id} s={u.indeks} />;
    case "unit": return <BerkasKelompok {...p} id={p.id} jenis="unit" indeks={u.indeks} />;
    case "instansi": return <BerkasKelompok {...p} id={p.id} jenis="instansi" indeks={u.indeks} />;
    case "tender": return <BerkasTender {...p} id={p.id} baris={u.indeks} />;
    case "pemilik": return <BerkasPemilik {...p} id={p.id} kunci={u.kunci} />;
  }
}

// ---------------------------------------------------------------- bagian bersama

function Kepala({ jenis, judul, sub, id, aksi, tanpaGraf }: { jenis: Jenis; judul: string; sub?: React.ReactNode; id: string; aksi: AksiBerkas; tanpaGraf?: boolean }) {
  return (
    <header className="border-b border-[var(--border)] px-4 pb-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {aksi.onKembali ? (
            <button type="button" className="tombol-ikon -ml-1.5" onClick={aksi.onKembali} aria-label="Kembali ke tampilan sebelumnya" title="Kembali">
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <CipJenis jenis={jenis} />
        </div>
        <button type="button" className="tombol-ikon -mr-1.5" onClick={() => aksi.onPilih(null)} aria-label="Tutup berkas" title="Tutup (Esc)">
          <X size={16} />
        </button>
      </div>
      <h2 className="mt-2 break-words text-[16px] font-semibold leading-snug" data-uji="judul-berkas">{judul}</h2>
      {sub ? <div className="mt-1 text-[12px] text-muted">{sub}</div> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tanpaGraf ? null : (
          <>
            <button type="button" className="tombol tombol-utama" onClick={() => aksi.onFokus(id)}>
              <Crosshair size={14} /> Fokus
            </button>
            <button type="button" className="tombol" onClick={() => aksi.onPerluas(id)} title="Tambahkan tetangga simpul ini ke graf">
              <Network size={14} /> Perluas
            </button>
          </>
        )}
        <button type="button" className="tombol" onClick={() => aksi.onSalin(id)} title="Salin tautan ke tampilan ini">
          <Link2 size={14} /> Salin tautan
        </button>
      </div>
    </header>
  );
}

function Catatan() {
  return (
    <p className="mt-5 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-dim">
      Pola di sini adalah hitungan statistik dari data pengadaan terbuka, bukan temuan audit dan bukan tuduhan. Banyak
      pola punya penjelasan yang wajar; anggap sebagai petunjuk paket mana yang layak dibaca lebih teliti.
    </p>
  );
}

function DaftarPola({ l, pf }: { l: Ledger; pf: Profil }) {
  const ada = POLA.filter((x) => pf.perPola[x.kunci] > 0);
  const dasar = l.meta.dasar;
  return (
    <>
      <JudulBagian kanan={<span className="angka text-[11px] text-muted">{angka(pf.nPola)} paket berpola ganda</span>}>Pola statistik</JudulBagian>
      {pf.medianRasio !== null ? (
        <div className="mb-2 rounded-sm border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[12px]">
          Median harga menang <span className="angka font-semibold text-[var(--text)]">{persen(pf.medianRasio)}</span> dari HPS
          {dasar.median_rasio !== null ? <span className="text-muted"> · sektor {persen(dasar.median_rasio)}</span> : null}
          {pf.medianJeda !== null ? <span className="text-muted"> · jeda median {angka(pf.medianJeda)} hari</span> : null}
        </div>
      ) : null}
      {ada.length === 0 ? (
        <Kosong>Tidak ada pola yang muncul di paket yang tersaring.</Kosong>
      ) : (
        <ul className="space-y-2">
          {ada.map((x) => {
            const porsi = pf.perPola[x.kunci] / Math.max(1, pf.n);
            const sektor = dasar.porsi[x.kunci] ?? 0;
            return (
              <li key={x.kunci} title={`${x.jelaskan(l.meta)} ${x.wajar}`}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="font-medium">{x.label}</span>
                  <span className="angka text-muted">
                    <span className="text-pola">{angka(pf.perPola[x.kunci])}</span> paket · {persen(porsi, 0)} <span className="text-dim">(sektor {persen(sektor, 0)})</span>
                  </span>
                </div>
                <div className="mt-1">
                  <BatangPorsi porsi={porsi} dasar={sektor} />
                </div>
                <div className="mt-1 text-[11px] leading-snug text-dim">{x.ringkas}.</div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type Urut = "nilai" | "baru" | "pola";

function TabelPaket({ l, baris, onPilih, kolom, namaBerkas }: { l: Ledger; baris: number[]; onPilih: (id: string) => void; kolom: "satker" | "vendor"; namaBerkas: string }) {
  const [urut, setUrut] = useState<Urut>("nilai");
  const [tampil, setTampil] = useState(20);
  const terurut = useMemo(() => {
    const salin = [...baris];
    if (urut === "nilai") salin.sort((a, b) => l.nilai[b] - l.nilai[a]);
    else if (urut === "baru") salin.sort((a, b) => l.menang[b] - l.menang[a]);
    else salin.sort((a, b) => polaDariBit(l.pola[b]).length - polaDariBit(l.pola[a]).length || l.nilai[b] - l.nilai[a]);
    return salin;
  }, [baris, urut, l]);
  return (
    <>
      <JudulBagian
        kanan={
          <div className="flex items-center gap-1">
            {(["nilai", "baru", "pola"] as Urut[]).map((x) => (
              <button key={x} type="button" className="tombol !min-h-[24px] !px-2 !text-[11px]" aria-pressed={urut === x} onClick={() => setUrut(x)}>
                {x === "nilai" ? "Terbesar" : x === "baru" ? "Terbaru" : "Berpola"}
              </button>
            ))}
            <button type="button" className="tombol-ikon !h-6 !w-6" onClick={() => unduhCsv(l, terurut, namaBerkas)} aria-label="Unduh paket ini sebagai CSV" title="Unduh CSV">
              <Download size={13} />
            </button>
          </div>
        }
      >
        Paket ({angka(baris.length)})
      </JudulBagian>
      <div className="-mx-1 overflow-x-auto">
        <table className="tabel-paket" data-uji="tabel-paket">
          <thead>
            <tr>
              <th>Paket</th>
              <th className="text-right">Nilai</th>
              <th className="text-right">% HPS</th>
            </tr>
          </thead>
          <tbody>
            {terurut.slice(0, tampil).map((i) => (
              <tr key={i} className="bisa-klik" onClick={() => onPilih(idSimpul("tender", i))}>
                <td>
                  <button type="button" className="block w-full border-0 bg-transparent p-0 text-left text-[12px] leading-snug text-[var(--text)]" onClick={(e) => { e.stopPropagation(); onPilih(idSimpul("tender", i)); }}>
                    <span className="line-clamp-2">{rapikanJudul(l.judul[i])}</span>
                  </button>
                  <div className="mt-0.5 text-[10.5px] text-dim">
                    <span className="angka">{tanggal(l.menang[i])}</span> · {kolom === "satker" ? l.satker[l.satkerDari[i]].nama : l.vendor[l.vendorDari[i]].nama}
                  </div>
                  {l.pola[i] ? <div className="mt-1"><CipPola bit={l.pola[i]} /></div> : null}
                </td>
                <td className="angka whitespace-nowrap text-right">{rupiah(l.nilai[i])}</td>
                <td className={`angka whitespace-nowrap text-right ${l.pola[i] & 3 ? "text-pola" : "text-muted"}`}>{l.hps[i] > 0 ? persen(l.nilai[i] / l.hps[i]) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tampil < terurut.length ? (
        <button type="button" className="tombol mt-2 w-full" onClick={() => setTampil((x) => x + 40)}>
          Tampilkan {Math.min(40, terurut.length - tampil)} lagi
        </button>
      ) : null}
    </>
  );
}

function BarisMitra({ jenis, nama, nilai, n, porsi, keterangan, onClick }: { jenis: Jenis; nama: string; nilai: number; n: number; porsi: number; keterangan?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="baris !items-start" onClick={onClick}>
        <span className="titik-jenis mt-[5px]" style={{ background: `var(--${jenis})` }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px]">{nama}</span>
          <span className="mt-1 block"><BatangPorsi porsi={porsi} warna={`var(--${jenis})`} /></span>
          {keterangan ? <span className="mt-0.5 block text-[10.5px] text-dim">{keterangan}</span> : null}
        </span>
        <span className="angka flex-none text-right text-[11.5px]">
          {rupiah(nilai)}
          <span className="block text-[10.5px] text-dim">{angka(n)} paket</span>
        </span>
      </button>
    </li>
  );
}

function Lipat<T>({ daftar, awal = 8, render }: { daftar: T[]; awal?: number; render: (x: T, i: number) => React.ReactNode }) {
  const [semua, setSemua] = useState(false);
  const tampil = semua ? daftar.slice(0, 60) : daftar.slice(0, awal);
  return (
    <>
      <ul className="-mx-2">{tampil.map(render)}</ul>
      {daftar.length > awal ? (
        <button type="button" className="mt-1 border-0 bg-transparent p-0 text-[11.5px] text-accent hover:underline" onClick={() => setSemua((x) => !x)}>
          {semua ? "Ringkas" : `Lihat ${Math.min(60, daftar.length) - awal} lainnya`}
        </button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- vendor

function BerkasVendor(p: Props & { id: string; v: number }) {
  const { l, saring, r, v } = p;
  const vendor = l.vendor[v];
  const pf = useMemo(() => profil(l, saring, l.barisVendor[v], "satker"), [l, saring, v]);
  const milik = l.kepemilikan.filter(([dari]) => dari === v);
  const maks = pf.mitra[0]?.nilai ?? 1;
  return (
    <div className="muncul" data-uji="berkas-vendor">
      <Kepala
        jenis="vendor"
        id={p.id}
        aksi={p}
        judul={vendor.nama}
        sub={
          <>
            {vendor.bentuk || "Bentuk usaha tidak tertulis"}
            {vendor.alias?.length ? <span className="text-dim"> · di sumber juga tertulis “{vendor.alias[0]}”{vendor.alias.length > 1 ? ` dan ${vendor.alias.length - 1} ejaan lain` : ""}</span> : null}
          </>
        }
      />
      <div className="px-4 pb-6 pt-3">
        {pf.n === 0 ? (
          <Kosong>Vendor ini tidak punya paket di rentang dan filter yang aktif.</Kosong>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Total menang" nilai={rupiah(pf.nilai)} kecil={`peringkat ${angka(v + 1)} dari ${angka(l.vendor.length)} vendor`} />
              <Kpi label="Paket" nilai={angka(pf.n)} kecil={`${pf.tahunAwal}–${pf.tahunAkhir}`} />
              <Kpi label="Satker pembeli" nilai={angka(pf.mitra.length)} />
              <Kpi label="Pola ganda" nilai={persen(pf.nPola / pf.n, 0)} kecil={`${angka(pf.nPola)} paket · sektor ${persen(l.meta.dasar.porsi_ganda ?? 0, 0)}`} />
            </div>
            <JudulBagian>Nilai per tahun</JudulBagian>
            <BatangTahun data={pf.perTahun} rentang={l.meta.rentang} />
            <DaftarPola l={l} pf={pf} />
            <JudulBagian>Dibeli oleh</JudulBagian>
            <Lipat
              daftar={pf.mitra}
              render={(m) => {
                const total = r.satker.get(m.indeks)?.nilai ?? 0;
                const porsiSatker = total > 0 ? m.nilai / total : 0;
                const unit = l.unit[l.satker[m.indeks].unit];
                return (
                  <BarisMitra
                    key={m.indeks}
                    jenis="satker"
                    nama={l.satker[m.indeks].nama}
                    nilai={m.nilai}
                    n={m.n}
                    porsi={m.nilai / maks}
                    keterangan={`${unit.nama} · ${persen(porsiSatker, 0)} dari belanja tender satker ini`}
                    onClick={() => p.onPilih(idSimpul("satker", m.indeks))}
                  />
                );
              }}
            />
            {milik.length ? (
              <>
                <JudulBagian>Pemilik / afiliasi</JudulBagian>
                <ul className="-mx-2">
                  {milik.map(([, ke, hubungan]) => {
                    const pm = l.pemilik.find((x) => x.id === ke);
                    return pm ? (
                      <li key={ke}>
                        <button type="button" className="baris" onClick={() => p.onPilih(idSimpul("pemilik", ke))}>
                          <span className="titik-jenis" style={{ background: "var(--pemilik)" }} />
                          <span className="min-w-0 flex-1 truncate text-[12px]">{pm.nama}</span>
                          <span className="cip">{hubungan}</span>
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
              </>
            ) : null}
            <TabelPaket l={l} baris={pf.baris} onPilih={p.onPilih} kolom="satker" namaBerkas={vendor.nama} />
          </>
        )}
        {vendor.bukti?.length ? (
          <p className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            <span className="label-kecil">Entity resolution</span>
            <br />
            Beberapa catatan penyedia di sumber disatukan menjadi vendor ini karena {vendor.bukti.map((b) => BUKTI[b] ?? b).join(" dan ")}.
          </p>
        ) : null}
        <Catatan />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- satker

function BerkasSatker(p: Props & { id: string; s: number }) {
  const { l, saring, s } = p;
  const satker = l.satker[s];
  const unit = l.unit[satker.unit];
  const pf = useMemo(() => profil(l, saring, l.barisSatker[s], "vendor"), [l, saring, s]);
  const konsentrasi = hhi(pf.mitra.map((m) => m.nilai));
  return (
    <div className="muncul" data-uji="berkas-satker">
      <Kepala
        jenis="satker"
        id={p.id}
        aksi={p}
        judul={satker.nama}
        sub={
          <>
            <button type="button" className="border-0 bg-transparent p-0 text-accent hover:underline" onClick={() => p.onPilih(idSimpul("unit", satker.unit))}>{unit.nama}</button>
            {" · "}
            <button type="button" className="border-0 bg-transparent p-0 text-accent hover:underline" onClick={() => p.onPilih(idSimpul("instansi", unit.instansi))}>{l.instansi[unit.instansi].nama}</button>
          </>
        }
      />
      <div className="px-4 pb-6 pt-3">
        {pf.n === 0 ? (
          <Kosong>Satker ini tidak punya paket di rentang dan filter yang aktif.</Kosong>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Belanja tender" nilai={rupiah(pf.nilai)} kecil={`${pf.tahunAwal}–${pf.tahunAkhir}`} />
              <Kpi label="Paket" nilai={angka(pf.n)} />
              <Kpi label="Vendor pemenang" nilai={angka(pf.mitra.length)} />
              <Kpi label="Konsentrasi (HHI)" nilai={konsentrasi.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kecil={`${labelHhi(konsentrasi)} · 1 = satu vendor`} />
            </div>
            <JudulBagian>Nilai per tahun</JudulBagian>
            <BatangTahun data={pf.perTahun} rentang={l.meta.rentang} />
            <DaftarPola l={l} pf={pf} />
            <JudulBagian>Pemenang terbesar</JudulBagian>
            <Lipat
              daftar={pf.mitra}
              render={(m) => (
                <BarisMitra
                  key={m.indeks}
                  jenis="vendor"
                  nama={l.vendor[m.indeks].nama}
                  nilai={m.nilai}
                  n={m.n}
                  porsi={m.nilai / pf.nilai}
                  keterangan={`${persen(m.nilai / pf.nilai, 0)} dari belanja tender satker ini`}
                  onClick={() => p.onPilih(idSimpul("vendor", m.indeks))}
                />
              )}
            />
            <TabelPaket l={l} baris={pf.baris} onPilih={p.onPilih} kolom="vendor" namaBerkas={satker.nama} />
          </>
        )}
        <Catatan />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- unit & instansi

function BerkasKelompok(p: Props & { id: string; jenis: "unit" | "instansi"; indeks: number }) {
  const { l, saring, r, jenis, indeks } = p;
  const baris = useMemo(() => (jenis === "unit" ? barisUnit(l, indeks) : barisInstansi(l, indeks)), [l, jenis, indeks]);
  const pf = useMemo(() => profil(l, saring, baris, "vendor"), [l, saring, baris]);
  const satker = useMemo(
    () => peringkat(r.satker).filter((x) => (jenis === "unit" ? l.satker[x.indeks].unit === indeks : l.instansiSatker[x.indeks] === indeks)),
    [r, l, jenis, indeks],
  );
  const unit = jenis === "unit" ? l.unit[indeks] : null;
  const judul = unit ? unit.nama : l.instansi[indeks].nama;
  return (
    <div className="muncul" data-uji={`berkas-${jenis}`}>
      <Kepala
        jenis={jenis}
        id={p.id}
        aksi={p}
        judul={judul}
        sub={
          unit ? (
            <button type="button" className="border-0 bg-transparent p-0 text-accent hover:underline" onClick={() => p.onPilih(idSimpul("instansi", unit.instansi))}>{l.instansi[unit.instansi].nama}</button>
          ) : (
            "Instansi pembeli"
          )
        }
      />
      <div className="px-4 pb-6 pt-3">
        {pf.n === 0 ? (
          <Kosong>Tidak ada paket di rentang dan filter yang aktif.</Kosong>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Belanja tender" nilai={rupiah(pf.nilai)} kecil={`${pf.tahunAwal}–${pf.tahunAkhir}`} />
              <Kpi label="Paket" nilai={angka(pf.n)} />
              <Kpi label="Satker" nilai={angka(satker.length)} />
              <Kpi label="Vendor pemenang" nilai={angka(pf.mitra.length)} />
            </div>
            <JudulBagian>Nilai per tahun</JudulBagian>
            <BatangTahun data={pf.perTahun} rentang={l.meta.rentang} />
            <DaftarPola l={l} pf={pf} />
            <JudulBagian>Satker terbesar</JudulBagian>
            <Lipat
              daftar={satker}
              awal={6}
              render={(m) => (
                <BarisMitra key={m.indeks} jenis="satker" nama={l.satker[m.indeks].nama} nilai={m.nilai} n={m.n} porsi={m.nilai / (satker[0]?.nilai || 1)} onClick={() => p.onPilih(idSimpul("satker", m.indeks))} />
              )}
            />
            <JudulBagian>Vendor terbesar</JudulBagian>
            <Lipat
              daftar={pf.mitra}
              awal={6}
              render={(m) => (
                <BarisMitra key={m.indeks} jenis="vendor" nama={l.vendor[m.indeks].nama} nilai={m.nilai} n={m.n} porsi={m.nilai / (pf.mitra[0]?.nilai || 1)} keterangan={`${persen(m.nilai / pf.nilai)} dari total`} onClick={() => p.onPilih(idSimpul("vendor", m.indeks))} />
              )}
            />
          </>
        )}
        {unit?.spse ? (
          <a className="tombol mt-4 w-full" href={`https://spse.inaproc.id/${unit.spse}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Buka portal LPSE {unit.nama}
          </a>
        ) : null}
        <Catatan />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- paket

function Butir({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-1.5 text-[12px]">
      <dt className="flex-none text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right">{children}</dd>
    </div>
  );
}

function BerkasTender(p: Props & { id: string; baris: number }) {
  const { l, baris: i } = p;
  const satker = l.satker[l.satkerDari[i]];
  const unit = l.unit[satker.unit];
  const rasio = l.hps[i] > 0 ? l.nilai[i] / l.hps[i] : null;
  const pola = polaDariBit(l.pola[i]);
  const ulang = l.ulang[String(i)];
  return (
    <div className="muncul" data-uji="berkas-tender">
      <Kepala jenis="tender" id={p.id} aksi={p} judul={rapikanJudul(l.judul[i])} sub={<span className="angka">Kode tender {l.id[i]}</span>} />
      <div className="px-4 pb-6 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Nilai pemenang" nilai={rupiah(l.nilai[i])} kecil={rupiahPenuh(l.nilai[i])} />
          <Kpi label="Terhadap HPS" nilai={rasio !== null ? persen(rasio, 2) : "–"} kecil={l.hps[i] > 0 ? `HPS ${rupiah(l.hps[i])}` : "HPS tidak tercatat"} />
        </div>
        <dl className="mt-3">
          <Butir label="Pemenang">
            <button type="button" className="border-0 bg-transparent p-0 text-right text-accent hover:underline" onClick={() => p.onPilih(idSimpul("vendor", l.vendorDari[i]))}>{l.vendor[l.vendorDari[i]].nama}</button>
          </Butir>
          <Butir label="Satker">
            <button type="button" className="border-0 bg-transparent p-0 text-right text-accent hover:underline" onClick={() => p.onPilih(idSimpul("satker", l.satkerDari[i]))}>{satker.nama}</button>
          </Butir>
          <Butir label="Unit">{unit.nama} · {l.instansi[unit.instansi].singkat}</Butir>
          <Butir label="Jenis"><span className="capitalize">{l.kategori[l.kategoriDari[i]]}</span></Butir>
          <Butir label="Diumumkan"><span className="angka">{tanggal(l.umum[i])}</span></Butir>
          <Butir label="Pemenang ditetapkan"><span className="angka">{tanggal(l.menang[i])}</span></Butir>
          <Butir label="Jeda"><span className="angka">{l.umum[i] >= 0 ? `${l.menang[i] - l.umum[i]} hari` : "–"}</span></Butir>
        </dl>
        <JudulBagian>Pola di paket ini</JudulBagian>
        {pola.length === 0 ? (
          <Kosong>Tidak ada pola yang muncul di paket ini.</Kosong>
        ) : (
          <ul className="space-y-2">
            {pola.map((x) => (
              <li key={x.kunci} className="rounded-sm border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2">
                <span className="cip cip-pola">{x.label}</span>
                <p className="m-0 mt-1.5 text-[12px] leading-snug">{x.jelaskan(l.meta)}</p>
                <p className="m-0 mt-1 text-[11px] leading-snug text-dim">Penjelasan wajar: {x.wajar}</p>
              </li>
            ))}
          </ul>
        )}
        {ulang ? (
          <>
            <JudulBagian>Catatan di sumber</JudulBagian>
            <p className="m-0 rounded-sm border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[12px] leading-snug text-muted">“{ulang}”</p>
          </>
        ) : null}
        {unit.spse ? (
          <a className="tombol mt-4 w-full" href={`https://spse.inaproc.id/${unit.spse}/lelang`} target="_blank" rel="noreferrer" title={`Cari kode ${l.id[i]} di portal LPSE`}>
            <ExternalLink size={14} /> Cari kode {l.id[i]} di LPSE {unit.nama}
          </a>
        ) : null}
        <Catatan />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pemilik

function BerkasPemilik(p: Props & { id: string; kunci: string }) {
  const { l, r, kunci } = p;
  const pm = l.pemilik.find((x) => x.id === kunci);
  const vendor = useMemo(
    () => vendorMilik(l, kunci).map((v) => ({ v, a: r.vendor.get(v) ?? { n: 0, nilai: 0, nPola: 0 } })).sort((a, b) => b.a.nilai - a.a.nilai),
    [l, r, kunci],
  );
  if (!pm) return <RingkasanSektor {...p} />;
  const total = vendor.reduce((x, y) => x + y.a.nilai, 0);
  const induk = l.kepemilikan.filter(([dari]) => dari === `p:${kunci}`);
  const KET: Record<string, string> = {
    negara: "Pemegang saham akhir BUMN. Kepemilikan bisa langsung atau lewat holding.",
    bumn: "Badan usaha milik negara atau induk dari vendor yang tercatat di data.",
    koperasi: "Kelompok ini dibentuk dari nama koperasi (Primkop, Puskop, Inkop), bukan dari akta. Koperasi dimiliki anggotanya.",
  };
  return (
    <div className="muncul" data-uji="berkas-pemilik">
      <Kepala jenis="pemilik" id={p.id} aksi={p} judul={pm.nama} sub={KET[pm.jenis] ?? pm.jenis} />
      <div className="px-4 pb-6 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Vendor terkait" nilai={angka(vendor.length)} />
          <Kpi label="Total menang" nilai={rupiah(total)} />
        </div>
        {induk.length ? (
          <>
            <JudulBagian>Induk</JudulBagian>
            <ul className="-mx-2">
              {induk.map(([, ke, hubungan]) => (
                <li key={ke}>
                  <button type="button" className="baris" onClick={() => p.onPilih(idSimpul("pemilik", ke))}>
                    <span className="titik-jenis" style={{ background: "var(--pemilik)" }} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{l.pemilik.find((x) => x.id === ke)?.nama ?? ke}</span>
                    <span className="cip">{hubungan}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <JudulBagian>Vendor</JudulBagian>
        {vendor.length === 0 ? (
          <Kosong>Tidak ada vendor terkait di data.</Kosong>
        ) : (
          <Lipat
            daftar={vendor}
            awal={10}
            render={({ v, a }) => (
              <BarisMitra key={v} jenis="vendor" nama={l.vendor[v].nama} nilai={a.nilai} n={a.n} porsi={total > 0 ? a.nilai / total : 0} onClick={() => p.onPilih(idSimpul("vendor", v))} />
            )}
          />
        )}
        <a className="tombol mt-4 w-full" href={pm.sumber} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Sumber
        </a>
        <p className="mt-4 text-[11px] leading-relaxed text-dim">
          Data pemilik perusahaan swasta tidak tersedia sebagai data terbuka di Indonesia, jadi lapisan ini hanya memuat
          BUMN, anak usahanya, dan koperasi yang bisa dikenali dari sumber publik.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ringkasan sektor

function RingkasanSektor({ l, r, onPilih }: Props) {
  const vendor = useMemo(() => peringkat(r.vendor, 10), [r]);
  const satker = useMemo(() => peringkat(r.satker, 10), [r]);
  const berpola = useMemo(() => {
    // vendor dengan >= 8 paket, diurutkan dari porsi paket berpola ganda tertinggi
    const calon = peringkat(r.vendor).filter((x) => x.n >= 8);
    return calon.sort((a, b) => b.nPola / b.n - a.nPola / a.n || b.nilai - a.nilai).slice(0, 8);
  }, [r]);
  const pasanganTerbesar = useMemo(() => {
    let terbaik = { kunci: -1, nilai: 0 };
    for (const [kunci, a] of r.pasangan) if (a.nilai > terbaik.nilai) terbaik = { kunci, nilai: a.nilai };
    return terbaik.kunci >= 0 ? { v: Math.floor(terbaik.kunci / JARAK), s: terbaik.kunci % JARAK, nilai: terbaik.nilai } : null;
  }, [r]);
  return (
    <div data-uji="ringkasan-sektor">
      <header className="border-b border-[var(--border)] px-4 pb-3 pt-3">
        <div className="label-kecil">Ringkasan</div>
        <h2 className="mt-1.5 text-[16px] font-semibold leading-snug">Tender pertahanan &amp; keamanan</h2>
        <p className="m-0 mt-1 text-[12px] leading-relaxed text-muted">
          Klik simpul di graf untuk membuka berkasnya. Klik dua kali untuk memusatkan graf di simpul itu.
        </p>
      </header>
      <div className="px-4 pb-6 pt-3">
        {r.n === 0 ? (
          <Kosong>Tidak ada paket yang cocok dengan filter. Longgarkan filter di panel kiri.</Kosong>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Nilai tender" nilai={rupiah(r.nilai)} />
              <Kpi label="Paket" nilai={angka(r.n)} />
              <Kpi label="Vendor" nilai={angka(r.vendor.size)} />
              <Kpi label="Satker" nilai={angka(r.satker.size)} />
            </div>
            {r.medianRasio !== null ? (
              <div className="mt-3 rounded-sm border border-[rgba(255,143,63,0.35)] bg-[var(--pola-soft)] px-3 py-2.5">
                <div className="label-kecil !text-pola">Angka yang paling mencolok</div>
                <div className="mt-1 text-[13px] leading-snug">
                  Separuh paket dimenangkan di harga <span className="angka font-semibold text-pola">≥ {persen(r.medianRasio)}</span> dari HPS.
                  Selisih antara harga perkiraan dan harga menang nyaris tidak ada.
                </div>
              </div>
            ) : null}
            {pasanganTerbesar ? (
              <p className="m-0 mt-3 text-[12px] leading-relaxed text-muted">
                Aliran terbesar: <button type="button" className="border-0 bg-transparent p-0 text-accent hover:underline" onClick={() => onPilih(idSimpul("satker", pasanganTerbesar.s))}>{l.satker[pasanganTerbesar.s].nama}</button>
                {" → "}
                <button type="button" className="border-0 bg-transparent p-0 text-accent hover:underline" onClick={() => onPilih(idSimpul("vendor", pasanganTerbesar.v))}>{l.vendor[pasanganTerbesar.v].nama}</button>
                , <span className="angka text-[var(--text)]">{rupiah(pasanganTerbesar.nilai)}</span>.
              </p>
            ) : null}
            <JudulBagian>Vendor terbesar</JudulBagian>
            <ul className="-mx-2">
              {vendor.map((m) => (
                <BarisMitra key={m.indeks} jenis="vendor" nama={l.vendor[m.indeks].nama} nilai={m.nilai} n={m.n} porsi={m.nilai / (vendor[0]?.nilai || 1)} onClick={() => onPilih(idSimpul("vendor", m.indeks))} />
              ))}
            </ul>
            <JudulBagian>Satker terbesar</JudulBagian>
            <ul className="-mx-2">
              {satker.map((m) => (
                <BarisMitra key={m.indeks} jenis="satker" nama={l.satker[m.indeks].nama} nilai={m.nilai} n={m.n} porsi={m.nilai / (satker[0]?.nilai || 1)} keterangan={l.unit[l.satker[m.indeks].unit].nama} onClick={() => onPilih(idSimpul("satker", m.indeks))} />
              ))}
            </ul>
            {berpola.length ? (
              <>
                <JudulBagian>Porsi pola ganda tertinggi</JudulBagian>
                <ul className="-mx-2">
                  {berpola.map((m) => (
                    <li key={m.indeks}>
                      <button type="button" className="baris" onClick={() => onPilih(idSimpul("vendor", m.indeks))}>
                        <span className="titik-jenis" style={{ background: "var(--pola)" }} />
                        <span className="min-w-0 flex-1 truncate text-[12px]">{l.vendor[m.indeks].nama}</span>
                        <span className="angka flex-none text-[11.5px] text-pola">{persen(m.nPola / m.n, 0)}</span>
                        <span className="angka w-[58px] flex-none text-right text-[10.5px] text-dim">{angka(m.n)} paket</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="m-0 mt-1 text-[10.5px] text-dim">Pola ganda = paket dengan dua pola atau lebih sekaligus. Hanya vendor dengan minimal 8 paket.</p>
              </>
            ) : null}
          </>
        )}
        <Catatan />
      </div>
    </div>
  );
}
