"""Orkestrasi pipeline dari ujung ke ujung.

    python -m pipeline.jalankan                      # cek sumber, bangun ulang kalau ada yang baru
    python -m pipeline.jalankan --paksa              # bangun ulang walau sumber tidak berubah
    python -m pipeline.jalankan --tanpa-unduh        # pakai berkas yang sudah ada di data/mentah

Tahap: ambil (extract) -> bersihkan -> resolusi -> pola (transform) -> kualitas (gerbang) -> graf (load).
Keluar dengan kode 1 kalau gerbang kualitas gagal; berkas keluaran lama tidak disentuh.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from . import ambil, bersihkan, graf, kualitas, pola, resolusi
from .konfigurasi import TAHUN_MAKS_TAMBAH, URL_REGISTRI

AKAR = Path(__file__).resolve().parent.parent


def _sekarang() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sumber_diubah(berkas: dict[int, ambil.Berkas]) -> str:
    """Last-Modified paling baru di antara semua berkas sumber, sebagai ISO UTC."""
    waktu = []
    for b in berkas.values():
        try:
            waktu.append(parsedate_to_datetime(b.diubah))
        except (TypeError, ValueError):
            continue
    return max(waktu).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if waktu else ""


def bangun(mentah: Path, kurasi: Path, berkas: dict[int, ambil.Berkas], tender_sebelumnya: int | None = None) -> tuple[dict, list[kualitas.Periksa]]:
    """Jalankan semua tahap transform di atas berkas yang sudah ada di folder `mentah`."""
    lama: dict[str, float] = {}

    def catat(nama: str, mulai: float) -> None:
        lama[nama] = round(time.perf_counter() - mulai, 2)

    t0 = time.perf_counter()
    laporan = bersihkan.Laporan()
    tender = bersihkan.saring_folder(mentah, laporan, date.today().year + TAHUN_MAKS_TAMBAH)
    catat("bersihkan", t0)

    t0 = time.perf_counter()
    kunci = [(t.id_penyedia, t.nama_penyedia, t.lpse) for t in tender]
    hasil = resolusi.selesaikan(kunci)
    for t, k in zip(tender, kunci):
        t.vendor = hasil.peta[k]
    catat("resolusi", t0)

    t0 = time.perf_counter()
    ringkasan_pola = pola.tandai(tender)
    catat("pola", t0)

    cek = kualitas.periksa(tender, laporan, hasil, tender_sebelumnya)
    tahun = sorted({int(t.tgl_menang[:4]) for t in tender}) or [0]
    meta = {
        "dibangun": _sekarang(),
        "sumber": {
            "nama": "Opentender (Indonesia Corruption Watch) via OCP Data Registry",
            "url": URL_REGISTRI,
            "lisensi": "ODbL 1.0",
            "diubah": _sumber_diubah(berkas),
            "berkas": [{"tahun": b.tahun, "ukuran": b.ukuran, "diubah": b.diubah} for _, b in sorted(berkas.items())],
        },
        "rentang": [tahun[0], tahun[-1]],
        "ambang": ringkasan_pola["ambang"],
        "dasar": ringkasan_pola["dasar"],
        "tahap": {
            "dibaca": laporan.dibaca,
            "lolos_prasaring": laporan.lolos_prasaring,
            "dalam_cakupan": laporan.dalam_cakupan,
            "perencanaan": laporan.perencanaan,
            "dibuang": dict(laporan.dibuang),
            "diperbaiki": dict(laporan.diperbaiki),
            "gagal_tender": sum(laporan.gagal.values()),
            "tender": len(tender),
            "detik": lama,
        },
        "resolusi": hasil.statistik,
        "kualitas": kualitas.ke_json(cek),
    }
    isi = graf.susun(tender, hasil, meta, kurasi)
    isi["meta"]["sidik"] = graf.sidik(isi)
    return isi, cek


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Bangun data Garuda Ledger dari OCDS Opentender.")
    p.add_argument("--mentah", type=Path, default=AKAR / "data" / "mentah", help="folder cache berkas sumber")
    p.add_argument("--kurasi", type=Path, default=AKAR / "data", help="folder CSV kurasi (pemilik)")
    p.add_argument("--keluar", type=Path, default=AKAR / "public" / "data", help="folder keluaran")
    p.add_argument("--status-lama", type=Path, help="status.json dari run sebelumnya (untuk gerbang 'tidak menyusut')")
    p.add_argument("--tanpa-unduh", action="store_true", help="jangan hubungi registri, pakai cache apa adanya")
    p.add_argument("--paksa", action="store_true", help="bangun ulang walau tidak ada berkas sumber yang berubah")
    a = p.parse_args(argv)

    status_lama: dict = {}
    jalur_lama = a.status_lama or (a.keluar / "status.json")
    if jalur_lama.exists():
        try:
            status_lama = json.loads(jalur_lama.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            status_lama = {}

    if a.tanpa_unduh:
        berkas = ambil.baca_manifest(a.mentah)
        ada_baru = True
    else:
        berkas = ambil.cek(a.mentah, date.today().year)
        ada_baru = any(b.berubah for b in berkas.values())
    print(f"sumber: {len(berkas)} berkas, {sum(1 for b in berkas.values() if b.berubah)} berubah")

    a.keluar.mkdir(parents=True, exist_ok=True)
    if not ada_baru and not a.paksa and status_lama.get("sidik"):
        status = {**status_lama, "dicek": _sekarang(), "berubah": False}
        (a.keluar / "status.json").write_text(json.dumps(status, indent=2), encoding="utf-8")
        print("tidak ada data baru; hanya waktu cek yang diperbarui")
        return 0

    if not a.tanpa_unduh:
        berkas = ambil.lengkapi(a.mentah, berkas)
    isi, cek = bangun(a.mentah, a.kurasi, berkas, status_lama.get("tender"))
    for c in cek:
        print(f"  [{'ok' if c.lulus else 'GAGAL'}] {c.nama}: {c.nilai} (batas {c.batas})")
    if not kualitas.lulus_semua(cek):
        print("gerbang kualitas gagal; keluaran lama dipertahankan", file=sys.stderr)
        return 1

    berubah = isi["meta"]["sidik"] != status_lama.get("sidik")
    graf.tulis(isi, a.keluar / "ledger.json")
    status = {
        "dicek": _sekarang(),
        "dibangun": isi["meta"]["dibangun"] if berubah else status_lama.get("dibangun", isi["meta"]["dibangun"]),
        "sidik": isi["meta"]["sidik"],
        "sumber_diubah": isi["meta"]["sumber"]["diubah"],
        "tender": len(isi["tender"]["id"]),
        "vendor": len(isi["vendor"]),
        "nilai": sum(isi["tender"]["nilai"]),
        "berubah": berubah,
    }
    (a.keluar / "status.json").write_text(json.dumps(status, indent=2), encoding="utf-8")
    print(f"selesai: {status['tender']} tender, {status['vendor']} vendor, sidik {status['sidik']}, berubah={berubah}")
    print(json.dumps(isi["meta"]["tahap"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
