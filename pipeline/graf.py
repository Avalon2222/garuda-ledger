"""Load: susun tabel dimensi + tabel fakta (skema bintang) menjadi satu JSON ringkas untuk aplikasi.

Dimensi: instansi, unit, satker, vendor, pemilik. Fakta: tender, disimpan per kolom supaya kecil dan cepat
dibaca di browser. Semua agregat (total per vendor, sisi graf, porsi) dihitung di browser dari tabel fakta,
jadi filter tahun cukup memotong kolom tanpa perlu data kedua.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import date
from pathlib import Path

from .bersihkan import Tender
from .konfigurasi import INSTANSI, LPSE_KE_UNIT, SLUG_SPSE
from .resolusi import HasilResolusi, bersihkan_nama

EPOK = date(2000, 1, 1).toordinal()
KATEGORI = ["barang", "konstruksi", "jasa", "konsultansi"]

# Koperasi di lingkungan TNI/Polri dikenali dari namanya (Primkopad, Inkopal, Puskoppolda, ...).
_KOPERASI = (
    (re.compile(r"\b(PRIM|IN|PUS)KOP\s?AD\b|\b(KOPERASI|PRIMKOP|PUSKOP|INKOP)\b.*\b(KARTIKA|TNI AD|ANGKATAN DARAT|HIPAKAD)\b"), "kop-ad"),
    (re.compile(r"\b(PRIM|IN|PUS)KOP\s?AL\b|\b(KOPERASI|PRIMKOP|PUSKOP|INKOP)\b.*\b(TNI AL|ANGKATAN LAUT)\b"), "kop-al"),
    (re.compile(r"\b(PRIM|IN|PUS)KOP\s?AU\b|\b(KOPERASI|PRIMKOP|PUSKOP|INKOP)\b.*\b(TNI AU|ANGKATAN UDARA)\b"), "kop-au"),
    (re.compile(r"\b(PRIM|IN|PUS)KOPP?OL\w*|\bKOPERASI\b.*\b(POLRI|POLDA|POLRES|KEPOLISIAN|BHAYANGKARA)\b"), "kop-pol"),
)


def hari(tanggal: str) -> int:
    """Tanggal ISO -> hari sejak 2000-01-01; kosong -> -1."""
    return date.fromisoformat(tanggal).toordinal() - EPOK if tanggal else -1


def baca_pemilik(folder: Path) -> tuple[list[dict], list[dict]]:
    """Baca dua CSV kurasi tangan: entitas pemilik dan relasi vendor -> pemilik."""
    def baca(nama: str) -> list[dict]:
        jalur = folder / nama
        if not jalur.exists():
            return []
        with open(jalur, encoding="utf-8", newline="") as f:
            return [{k: (v or "").strip() for k, v in baris.items()} for baris in csv.DictReader(f)]
    return baca("pemilik.csv"), baca("kepemilikan.csv")


def susun(tender: list[Tender], resolusi: HasilResolusi, meta: dict, folder_kurasi: Path | None = None) -> dict:
    instansi = [{"id": i.id, "nama": i.nama, "singkat": i.singkat} for i in INSTANSI]
    indeks_instansi = {i.id: n for n, i in enumerate(INSTANSI)}

    # hanya vendor yang benar-benar punya tender, diurutkan dari nilai terbesar supaya indeks kecil = pemain besar
    nilai_vendor: dict[str, float] = {}
    for t in tender:
        nilai_vendor[t.vendor] = nilai_vendor.get(t.vendor, 0.0) + t.nilai
    urut_vendor = sorted(nilai_vendor, key=lambda v: (-nilai_vendor[v], resolusi.vendor[v].nama))
    indeks_vendor = {v: n for n, v in enumerate(urut_vendor)}

    unit: list[dict] = []
    indeks_unit: dict[tuple[str, str], int] = {}
    satker: list[dict] = []
    indeks_satker: dict[tuple[str, str, str], int] = {}
    for t in sorted(tender, key=lambda t: (indeks_instansi[t.instansi], t.unit, t.satker)):
        ku = (t.instansi, t.unit)
        if ku not in indeks_unit:
            indeks_unit[ku] = len(unit)
            baris_unit = {"nama": t.unit, "instansi": indeks_instansi[t.instansi]}
            if LPSE_KE_UNIT.get(t.lpse) == ku and t.lpse in SLUG_SPSE:
                baris_unit["spse"] = SLUG_SPSE[t.lpse]
            unit.append(baris_unit)
        ks = (t.instansi, t.unit, t.satker)
        if ks not in indeks_satker:
            indeks_satker[ks] = len(satker)
            satker.append({"nama": t.satker, "unit": indeks_unit[ku]})

    vendor = []
    for v in urut_vendor:
        data = resolusi.vendor[v]
        baris: dict = {"nama": data.nama, "bentuk": data.bentuk}
        if data.alias:
            baris["alias"] = data.alias
        if data.bukti:
            baris["bukti"] = data.bukti
        vendor.append(baris)

    # pemilik: kurasi tangan (BUMN, induk Tbk) + kelompok koperasi dari nama
    pemilik, relasi = baca_pemilik(folder_kurasi) if folder_kurasi else ([], [])
    kunci_vendor: dict[str, list[int]] = {}
    for n, v in enumerate(urut_vendor):
        kunci_vendor.setdefault(bersihkan_nama(resolusi.vendor[v].nama).kunci, []).append(n)
    kepemilikan: list[list] = []
    terpakai: set[str] = set()
    id_pemilik = {p["id"] for p in pemilik}
    for r in relasi:
        if r.get("ke") not in id_pemilik:
            continue
        if r.get("dari_pemilik"):
            if r["dari_pemilik"] in id_pemilik:
                kepemilikan.append([f"p:{r['dari_pemilik']}", r["ke"], r.get("hubungan", "induk")])
            continue
        for n in kunci_vendor.get(bersihkan_nama(r.get("vendor", "")).kunci, []):
            if resolusi.vendor[urut_vendor[n]].bentuk in ("PT", "Perum", ""):
                kepemilikan.append([n, r["ke"], r.get("hubungan", "induk")])
                terpakai.add(r["ke"])
    for n, v in enumerate(urut_vendor):
        data = resolusi.vendor[v]
        if data.bentuk != "Koperasi":
            continue
        inti = bersihkan_nama(data.nama).inti
        for pola, kelompok in _KOPERASI:
            if pola.search(inti) and kelompok in id_pemilik:
                kepemilikan.append([n, kelompok, "afiliasi (dari nama)"])
                terpakai.add(kelompok)
                break
    # ikutkan induk dari pemilik yang terpakai (rantai ke atas), buang sisanya
    berubah = True
    while berubah:
        berubah = False
        for dari, ke, _ in kepemilikan:
            if isinstance(dari, str) and dari[2:] in terpakai and ke not in terpakai:
                terpakai.add(ke)
                berubah = True
    pemilik = [p for p in pemilik if p["id"] in terpakai]
    kepemilikan = [k for k in kepemilikan if k[1] in terpakai and (not isinstance(k[0], str) or k[0][2:] in terpakai)]

    urut_tender = sorted(tender, key=lambda t: (t.tgl_menang, t.id))
    fakta = {
        "id": [t.id for t in urut_tender],
        "judul": [t.judul for t in urut_tender],
        "satker": [indeks_satker[(t.instansi, t.unit, t.satker)] for t in urut_tender],
        "vendor": [indeks_vendor[t.vendor] for t in urut_tender],
        "nilai": [round(t.nilai) for t in urut_tender],
        "hps": [round(t.hps) for t in urut_tender],
        "umum": [hari(t.tgl_umum) for t in urut_tender],
        "menang": [hari(t.tgl_menang) for t in urut_tender],
        "kategori": [KATEGORI.index(t.kategori) for t in urut_tender],
        "pola": [t.pola for t in urut_tender],
    }
    # kolom jarang: alasan tender ulang, sebagai {indeks baris: teks}
    ulang = {str(n): t.ulang for n, t in enumerate(urut_tender) if t.ulang}
    isi = {
        "versi": 1,
        "meta": meta,
        "kategori": KATEGORI,
        "instansi": instansi,
        "unit": unit,
        "satker": satker,
        "vendor": vendor,
        "pemilik": pemilik,
        "kepemilikan": kepemilikan,
        "tender": fakta,
        "ulang": ulang,
    }
    return isi


def sidik(isi: dict) -> str:
    """Sidik jari isi data (tanpa meta), untuk tahu apakah run ini menghasilkan sesuatu yang baru."""
    inti = {k: v for k, v in isi.items() if k != "meta"}
    return hashlib.sha256(json.dumps(inti, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]


def tulis(isi: dict, jalur: Path) -> None:
    jalur.parent.mkdir(parents=True, exist_ok=True)
    jalur.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
