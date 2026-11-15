"""Transform tahap 1: saring catatan OCDS ke sektor pertahanan & keamanan, lalu ratakan jadi baris tender.

Berkas sumber berisi semua pengadaan Indonesia (1,3 juta baris), jadi dibaca streaming baris per baris dan
baris yang jelas di luar cakupan dibuang sebelum di-parse sebagai JSON.
"""
from __future__ import annotations

import gzip
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable, Iterator

from .konfigurasi import JEDA_MAKS_HARI, KODE_KE_INSTANSI, LPSE_KE_UNIT, TAHUN_MAKS_TAMBAH, TAHUN_MIN

KATEGORI = {
    "Pengadaan Barang": "barang",
    "Pekerjaan Konstruksi": "konstruksi",
    "Pekerjaan Konstruksi Terintegrasi": "konstruksi",
    "Jasa Lainnya": "jasa",
    "Jasa Konsultansi Badan Usaha Non Konstruksi": "konsultansi",
    "Jasa Konsultansi Badan Usaha Konstruksi": "konsultansi",
    "Jasa Konsultansi Perorangan": "konsultansi",
}
KATEGORI_UTAMA = {"goods": "barang", "works": "konstruksi", "services": "jasa"}

# prasaring murah: baris yang tidak memuat satu pun penanda ini pasti di luar cakupan
_PENANDA = re.compile(
    r'"id":\s*"(?:' + "|".join(sorted(set(KODE_KE_INSTANSI) | set(LPSE_KE_UNIT))) + r')"|LPSE\s+POLDA', re.I
)
_SPASI = re.compile(r"\s+")


@dataclass
class Tender:
    id: str                 # kode tender di SPSE
    judul: str
    instansi: str           # id di konfigurasi.INSTANSI
    unit: str               # matra / Mabes / Polda (dari LPSE)
    lpse: str               # id LPSE
    satker: str
    kategori: str           # barang | konstruksi | jasa | konsultansi
    hps: float
    nilai: float            # nilai pemenang
    tgl_umum: str           # YYYY-MM-DD atau ""
    tgl_menang: str
    id_penyedia: str
    nama_penyedia: str
    jeda: int | None = None     # hari dari pengumuman ke penetapan pemenang
    rasio: float | None = None  # nilai / hps
    ulang: str = ""             # alasan tender sebelumnya gagal/dibatalkan, kalau paket ini hasil tender ulang
    vendor: str = ""            # diisi tahap resolusi entitas
    pola: int = 0               # bitmask, diisi tahap pola


@dataclass
class Laporan:
    """Hitungan tiap tahap, supaya kehilangan baris selalu bisa dijelaskan."""
    dibaca: int = 0
    lolos_prasaring: int = 0
    dalam_cakupan: int = 0
    perencanaan: int = 0
    gagal: Counter = field(default_factory=Counter)
    dibuang: Counter = field(default_factory=Counter)
    diperbaiki: Counter = field(default_factory=Counter)
    tender: int = 0


def rapikan(teks: str | None) -> str:
    return _SPASI.sub(" ", teks or "").strip()


def nama_unit(id_lpse: str, nama_lpse: str) -> tuple[str, str] | None:
    """(instansi, unit) dari LPSE, atau None kalau LPSE itu bukan milik sektor ini."""
    if id_lpse in LPSE_KE_UNIT:
        return LPSE_KE_UNIT[id_lpse]
    m = re.match(r"LPSE\s+POLDA\s+(.+)", rapikan(nama_lpse), re.I)
    if m:
        wilayah = m.group(1).title()
        wilayah = {"Sulsel": "Sulawesi Selatan", "Ntt": "NTT"}.get(wilayah, wilayah)
        return ("polri", f"Polda {wilayah}")
    return None


def tentukan_cakupan(catatan: dict) -> tuple[str, str] | None:
    """Putuskan (instansi, unit) sebuah catatan, atau None kalau di luar cakupan.

    Urutan bukti: kode pembeli yang dikenal dulu; kalau kolom pembeli kosong (umum di data 2013-2016),
    pakai pemilik LPSE-nya. Pembeli lain yang kebetulan lewat LPSE sektor ini (salah gabung di sumber) dibuang.
    """
    pembeli = catatan.get("buyer") or {}
    kode, nama = pembeli.get("id") or "", rapikan(pembeli.get("name"))
    pe = (catatan.get("tender") or {}).get("procuringEntity") or {}
    dari_lpse = nama_unit(str(pe.get("id") or ""), pe.get("name") or "")
    if kode in KODE_KE_INSTANSI:
        instansi = KODE_KE_INSTANSI[kode]
        if dari_lpse and dari_lpse[0] == instansi:
            return dari_lpse
        # satker daerah yang menumpang LPSE pemda: unitnya tidak bisa ditebak dari LPSE
        return (instansi, "Lewat LPSE lain")
    if not nama and dari_lpse:
        return dari_lpse
    return None


def _tanggal(teks: str | None, tahun_maks: int) -> str:
    if not teks or len(teks) < 10:
        return ""
    try:
        t = date.fromisoformat(teks[:10])
    except ValueError:
        return ""
    return t.isoformat() if TAHUN_MIN <= t.year <= tahun_maks else ""


def _satker(catatan: dict) -> str:
    for pihak in catatan.get("parties") or []:
        if "buyer" in (pihak.get("roles") or []):
            for tambahan in pihak.get("additionalIdentifiers") or []:
                if rapikan(tambahan.get("legalName")):
                    return rapikan(tambahan["legalName"])
    return ""


def ratakan(catatan: dict, cakupan: tuple[str, str], laporan: Laporan, tahun_maks: int) -> Tender | None:
    """Satu catatan OCDS -> satu baris Tender, atau None kalau tidak layak dipakai."""
    t = catatan.get("tender") or {}
    menang = catatan.get("awards") or []
    if not menang:
        if t.get("status") == "planning":
            laporan.perencanaan += 1
        else:
            laporan.dibuang["tanpa_pemenang"] += 1
        return None
    a = menang[0]
    penyedia = (a.get("suppliers") or [{}])[0]
    nama = rapikan(penyedia.get("name"))
    nilai = (a.get("value") or {}).get("amount")
    hps = (t.get("minValue") or {}).get("amount")
    if not nama:
        laporan.dibuang["penyedia_kosong"] += 1
        return None
    if not isinstance(nilai, (int, float)) or nilai <= 0:
        laporan.dibuang["nilai_tidak_valid"] += 1
        return None
    if not isinstance(hps, (int, float)) or hps <= 0:
        hps = 0.0
        laporan.diperbaiki["hps_kosong"] += 1

    klas = ((a.get("items") or [{}])[0].get("classification") or {}).get("description")
    kategori = KATEGORI.get(klas or "")
    if kategori is None:
        # sumber kadang berisi nama kolom mentah ("kgr_nama"); jatuh ke kategori utama OCDS
        kategori = KATEGORI_UTAMA.get(t.get("mainProcurementCategory") or "", "jasa")
        laporan.diperbaiki["kategori_dari_utama"] += 1

    tgl_umum = _tanggal(t.get("datePublished"), tahun_maks)
    tgl_menang = _tanggal(a.get("date"), tahun_maks)
    if not tgl_menang:
        laporan.dibuang["tanggal_menang_rusak"] += 1
        return None
    jeda = None
    if tgl_umum:
        selisih = (date.fromisoformat(tgl_menang) - date.fromisoformat(tgl_umum)).days
        if 0 <= selisih <= JEDA_MAKS_HARI:
            jeda = selisih
        else:
            tgl_umum = ""
            laporan.diperbaiki["jeda_tidak_masuk_akal"] += 1

    satker = _satker(catatan)
    if not satker:
        satker = f"({cakupan[1]}, satker tidak tercatat)"
        laporan.diperbaiki["satker_kosong"] += 1

    return Tender(
        id=str(t.get("id") or catatan.get("ocid") or ""),
        judul=rapikan(t.get("title") or a.get("title")),
        instansi=cakupan[0],
        unit=cakupan[1],
        lpse=str((t.get("procuringEntity") or {}).get("id") or ""),
        satker=satker,
        kategori=kategori,
        hps=float(hps),
        nilai=float(nilai),
        tgl_umum=tgl_umum,
        tgl_menang=tgl_menang,
        id_penyedia=str(penyedia.get("id") or ""),
        nama_penyedia=nama,
        jeda=jeda,
        rasio=(float(nilai) / float(hps)) if hps else None,
    )


def baca_baris(jalur: Path) -> Iterator[str]:
    with gzip.open(jalur, "rt", encoding="utf-8") as berkas:
        yield from berkas


def saring(baris: Iterable[str], laporan: Laporan, tahun_maks: int, terlihat: set[str] | None = None) -> Iterator[Tender]:
    """Streaming: baris JSONL -> Tender dalam cakupan. Duplikat kode tender dibuang (yang pertama menang)."""
    terlihat = set() if terlihat is None else terlihat
    for teks in baris:
        laporan.dibaca += 1
        if not _PENANDA.search(teks):
            continue
        laporan.lolos_prasaring += 1
        try:
            catatan = json.loads(teks)
        except json.JSONDecodeError:
            laporan.dibuang["json_rusak"] += 1
            continue
        cakupan = tentukan_cakupan(catatan)
        if cakupan is None:
            continue
        laporan.dalam_cakupan += 1
        tender = ratakan(catatan, cakupan, laporan, tahun_maks)
        if tender is None:
            continue
        # statusDetails berisi alasan tender sebelumnya gagal atau dibatalkan ("Tidak ada peserta yang lulus ...")
        tender.ulang = rapikan(((catatan.get("tender") or {}).get("statusDetails") or "").replace("|", " "))[:160]
        if tender.ulang:
            laporan.gagal[tender.ulang.lower()[:60]] += 1
        if tender.id in terlihat:
            laporan.dibuang["duplikat"] += 1
            continue
        terlihat.add(tender.id)
        laporan.tender += 1
        yield tender


def saring_folder(folder: Path, laporan: Laporan, tahun_maks: int | None = None) -> list[Tender]:
    tahun_maks = tahun_maks or date.today().year + TAHUN_MAKS_TAMBAH
    hasil: list[Tender] = []
    terlihat: set[str] = set()
    for jalur in sorted(folder.glob("*.jsonl.gz")):
        hasil.extend(saring(baca_baris(jalur), laporan, tahun_maks, terlihat))
    return hasil
