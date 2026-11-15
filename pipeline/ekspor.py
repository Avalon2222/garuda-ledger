"""Ekspor ringkasan datar (CSV) untuk dipakai alat lain, misalnya chatbot talk-to-the-data.

ledger.json berbentuk kolom dan dibuat untuk aplikasi graf. Untuk tanya-jawab, yang lebih berguna adalah
tabel agregat kecil: satu baris per vendor, per satker, dan per tahun x instansi x jenis pengadaan.

Nilai dijumlahkan dari rupiah bulat per paket, sama seperti kolom `nilai` di ledger.json, jadi total di CSV
cocok persis dengan total di aplikasi. Semua urutan ditentukan secara eksplisit (tender diurutkan dulu, baris keluaran diurutkan dengan kunci
lengkap) supaya berkas yang dihasilkan sama persis di tiap run atas data yang sama.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path
from statistics import median

from .bersihkan import Tender
from .konfigurasi import BIT_POLA, INSTANSI
from .pola import pola_ganda
from .resolusi import Vendor

KOLOM = {
    "vendor": ["vendor", "bentuk", "unit_utama", "instansi_utama", "paket", "nilai", "satker", "tahun_awal",
               "tahun_akhir", "median_rasio_hps", "mepet_hps", "langganan", "pola_ganda"],
    "satker": ["instansi", "unit", "satker", "paket", "nilai", "vendor", "hhi", "vendor_terbesar",
               "porsi_vendor_terbesar", "median_rasio_hps", "pola_ganda"],
    "tahunan": ["tahun", "instansi", "kategori", "paket", "nilai", "vendor", "median_rasio_hps", "mepet_hps",
                "langganan", "pola_ganda"],
}

_SINGKAT = {i.id: i.singkat for i in INSTANSI}


def _median_rasio(daftar: list[Tender]) -> float | str:
    rasio = [t.rasio for t in daftar if t.rasio is not None]
    return round(median(rasio), 4) if rasio else ""


def _hitung_pola(daftar: list[Tender]) -> dict[str, int]:
    return {
        "mepet_hps": sum(1 for t in daftar if t.pola & BIT_POLA["mepet"]),
        "langganan": sum(1 for t in daftar if t.pola & BIT_POLA["langganan"]),
        "pola_ganda": sum(1 for t in daftar if pola_ganda(t.pola)),
    }


def _terbesar(nilai: dict[str, int]) -> str:
    """Kunci dengan nilai terbesar; yang seri dimenangkan urutan abjad."""
    return min(nilai.items(), key=lambda kv: (-kv[1], kv[0]))[0]


def tabel(tender: list[Tender], vendor: dict[str, Vendor]) -> dict[str, list[dict]]:
    """Tiga tabel agregat dari daftar tender yang sudah lewat resolusi dan pola."""
    urut = sorted(tender, key=lambda t: (t.tgl_menang, t.id))

    # --- per vendor
    per_vendor: dict[str, list[Tender]] = defaultdict(list)
    for t in urut:
        per_vendor[t.vendor].append(t)
    baris_vendor = []
    for vid, daftar in per_vendor.items():
        per_unit: dict[str, int] = defaultdict(int)
        per_instansi: dict[str, int] = defaultdict(int)
        for t in daftar:
            per_unit[t.unit] += round(t.nilai)
            per_instansi[_SINGKAT[t.instansi]] += round(t.nilai)
        baris_vendor.append({
            "vendor": vendor[vid].nama,
            "bentuk": vendor[vid].bentuk,
            # vendor bernama sama di daerah berbeda sengaja tidak digabung; unit utama membedakannya
            "unit_utama": _terbesar(per_unit),
            "instansi_utama": _terbesar(per_instansi),
            "paket": len(daftar),
            "nilai": sum(round(t.nilai) for t in daftar),
            "satker": len({(t.instansi, t.unit, t.satker) for t in daftar}),
            "tahun_awal": int(daftar[0].tgl_menang[:4]),
            "tahun_akhir": int(daftar[-1].tgl_menang[:4]),
            "median_rasio_hps": _median_rasio(daftar),
            **_hitung_pola(daftar),
        })
    baris_vendor.sort(key=lambda b: (-b["nilai"], b["vendor"], b["unit_utama"], b["paket"]))

    # --- per satker
    per_satker: dict[tuple[str, str, str], list[Tender]] = defaultdict(list)
    for t in urut:
        per_satker[(t.instansi, t.unit, t.satker)].append(t)
    baris_satker = []
    for (instansi, unit, satker), daftar in per_satker.items():
        # penjumlah bilangan bulat: totalnya rupiah persis dan ditulis ke CSV tanpa ".0"
        per_v: dict[str, int] = defaultdict(int)
        for t in daftar:
            per_v[t.vendor] += round(t.nilai)
        total = sum(per_v.values())
        juara = min(per_v.items(), key=lambda kv: (-kv[1], vendor[kv[0]].nama, kv[0]))
        baris_satker.append({
            "instansi": _SINGKAT[instansi],
            "unit": unit,
            "satker": satker,
            "paket": len(daftar),
            "nilai": total,
            "vendor": len(per_v),
            "hhi": round(sum((v / total) ** 2 for v in per_v.values()), 4) if total > 0 else "",
            "vendor_terbesar": vendor[juara[0]].nama,
            "porsi_vendor_terbesar": round(juara[1] / total, 4) if total > 0 else "",
            "median_rasio_hps": _median_rasio(daftar),
            "pola_ganda": _hitung_pola(daftar)["pola_ganda"],
        })
    baris_satker.sort(key=lambda b: (-b["nilai"], b["instansi"], b["unit"], b["satker"]))

    # --- per tahun x instansi x jenis pengadaan
    per_tahun: dict[tuple[int, str, str], list[Tender]] = defaultdict(list)
    for t in urut:
        per_tahun[(int(t.tgl_menang[:4]), _SINGKAT[t.instansi], t.kategori)].append(t)
    baris_tahunan = [
        {
            "tahun": tahun,
            "instansi": instansi,
            "kategori": kategori,
            "paket": len(daftar),
            "nilai": sum(round(t.nilai) for t in daftar),
            "vendor": len({t.vendor for t in daftar}),
            "median_rasio_hps": _median_rasio(daftar),
            **_hitung_pola(daftar),
        }
        for (tahun, instansi, kategori), daftar in sorted(per_tahun.items())
    ]
    return {"vendor": baris_vendor, "satker": baris_satker, "tahunan": baris_tahunan}


def tulis(isi: dict[str, list[dict]], folder: Path) -> list[Path]:
    """Tulis tiap tabel ke <folder>/<nama>.csv dengan urutan kolom tetap dan akhir baris LF."""
    folder.mkdir(parents=True, exist_ok=True)
    hasil = []
    for nama, baris in isi.items():
        jalur = folder / f"{nama}.csv"
        with open(jalur, "w", encoding="utf-8", newline="") as f:
            penulis = csv.DictWriter(f, fieldnames=KOLOM[nama], lineterminator="\n")
            penulis.writeheader()
            penulis.writerows(baris)
        hasil.append(jalur)
    return hasil
