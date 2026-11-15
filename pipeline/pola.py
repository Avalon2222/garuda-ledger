"""Transform tahap 3: pola statistik per tender.

Tiap pola adalah satu bit di kolom `pola`. Semuanya dihitung dari data itu sendiri (persentil, porsi, hitungan),
jadi artinya selalu "tidak biasa dibanding paket lain di sektor ini", bukan "melanggar aturan".
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from statistics import median

from .bersihkan import Tender
from .konfigurasi import (
    AMBANG_MEPET,
    AMBANG_PERSIS,
    BERUNTUN_HARI,
    BERUNTUN_JUMLAH,
    BIT_POLA,
    DEBUT_PERSENTIL,
    DOMINAN_MIN_PAKET,
    DOMINAN_PORSI,
    LANGGANAN_TAHUN,
    PERSENTIL_KILAT,
)


# Sumber tidak memuat daftar peserta. Satu-satunya jejak "peserta tunggal" ada di catatan tender ulang,
# misalnya "Hanya 1 (Satu) Peserta Lelang yang memasukkan penawaran".
PESERTA_TUNGGAL = re.compile(r"hanya\s+(?:ada\s+|terdapat\s+)?(?:1|satu)\b(?!\s*\(?\s*dua)|peserta\s+tunggal|penawar\s+tunggal", re.I)


# Pola yang dihitung untuk "pola ganda". "persis" tidak ikut karena selalu muncul bersama "mepet";
# "lewat_hps" dan "ulang" tidak ikut karena yang satu soal kualitas data dan yang lain prosedur biasa.
BIT_GANDA = sum(BIT_POLA[k] for k in ("mepet", "kilat", "beruntun", "langganan", "dominan", "debut", "tunggal"))


def pola_ganda(pola: int) -> bool:
    """True kalau paket punya dua pola atau lebih sekaligus. Satu pola saja terlalu umum untuk jadi sorotan."""
    return bin(pola & BIT_GANDA).count("1") >= 2


def persentil(nilai: list[float], p: float) -> float:
    """Persentil metode nearest-rank; daftar kosong -> 0."""
    if not nilai:
        return 0.0
    urut = sorted(nilai)
    return urut[min(len(urut) - 1, max(0, int(p * len(urut))))]


def kunci_satker(t: Tender) -> tuple[str, str, str]:
    return (t.instansi, t.unit, t.satker)


def tandai(tender: list[Tender]) -> dict:
    """Isi kolom `pola` di tiap tender (di tempat) dan kembalikan ambang + angka dasar yang dipakai."""
    for t in tender:
        t.pola = 0
        if t.ulang:
            t.pola |= BIT_POLA["ulang"]
            if PESERTA_TUNGGAL.search(t.ulang):
                t.pola |= BIT_POLA["tunggal"]

    # --- harga: mepet / persis / lewat HPS
    rasio = [t.rasio for t in tender if t.rasio is not None]
    for t in tender:
        if t.rasio is None:
            continue
        if t.rasio > 1.0001:
            t.pola |= BIT_POLA["lewat_hps"]
        elif t.rasio >= AMBANG_MEPET:
            t.pola |= BIT_POLA["mepet"]
            if t.rasio >= AMBANG_PERSIS:
                t.pola |= BIT_POLA["persis"]

    # --- kilat: jeda umumkan -> menang di persentil terbawah untuk kategorinya
    jeda_kategori: dict[str, list[float]] = defaultdict(list)
    for t in tender:
        if t.jeda is not None:
            jeda_kategori[t.kategori].append(t.jeda)
    ambang_kilat = {k: persentil(v, PERSENTIL_KILAT) for k, v in jeda_kategori.items()}
    for t in tender:
        if t.jeda is not None and t.jeda <= ambang_kilat.get(t.kategori, -1):
            t.pola |= BIT_POLA["kilat"]

    # --- pasangan vendor x satker
    pasangan: dict[tuple, list[Tender]] = defaultdict(list)
    per_satker: dict[tuple, list[Tender]] = defaultdict(list)
    for t in tender:
        pasangan[(t.vendor, kunci_satker(t))].append(t)
        per_satker[kunci_satker(t)].append(t)

    nilai_satker = {k: sum(t.nilai for t in v) for k, v in per_satker.items()}
    for (vendor, satker), daftar in pasangan.items():
        # langganan: menang di tahun-tahun berbeda
        if len({t.tgl_menang[:4] for t in daftar}) >= LANGGANAN_TAHUN:
            for t in daftar:
                t.pola |= BIT_POLA["langganan"]
        # dominan: porsi nilai satker
        if len(per_satker[satker]) >= DOMINAN_MIN_PAKET and nilai_satker[satker] > 0:
            if sum(t.nilai for t in daftar) / nilai_satker[satker] >= DOMINAN_PORSI:
                for t in daftar:
                    t.pola |= BIT_POLA["dominan"]
        # beruntun: >= N paket dalam jendela H hari (jendela geser di atas tanggal menang)
        if len(daftar) >= BERUNTUN_JUMLAH:
            urut = sorted(daftar, key=lambda t: t.tgl_menang)
            hari = [date.fromisoformat(t.tgl_menang).toordinal() for t in urut]
            kiri = 0
            for kanan in range(len(urut)):
                while hari[kanan] - hari[kiri] > BERUNTUN_HARI:
                    kiri += 1
                if kanan - kiri + 1 >= BERUNTUN_JUMLAH:
                    for t in urut[kiri:kanan + 1]:
                        t.pola |= BIT_POLA["beruntun"]

    # --- debut besar: kemenangan pertama vendor (di seluruh data) sudah bernilai sangat besar
    ambang_debut = persentil([t.nilai for t in tender], DEBUT_PERSENTIL)
    per_vendor: dict[str, list[Tender]] = defaultdict(list)
    for t in tender:
        per_vendor[t.vendor].append(t)
    tahun_awal_data = min((t.tgl_menang[:4] for t in tender), default="")
    for daftar in per_vendor.values():
        pertama = min(daftar, key=lambda t: (t.tgl_menang, t.id))
        # vendor yang sudah menang di tahun pertama data tidak bisa disebut debut (riwayat sebelumnya tidak terlihat)
        if pertama.nilai >= ambang_debut and pertama.tgl_menang[:4] != tahun_awal_data:
            pertama.pola |= BIT_POLA["debut"]

    n = len(tender) or 1
    return {
        "ambang": {
            "mepet": AMBANG_MEPET,
            "persis": AMBANG_PERSIS,
            "kilat_hari": {k: int(v) for k, v in sorted(ambang_kilat.items())},
            "beruntun": [BERUNTUN_JUMLAH, BERUNTUN_HARI],
            "langganan_tahun": LANGGANAN_TAHUN,
            "dominan": [DOMINAN_PORSI, DOMINAN_MIN_PAKET],
            "debut_nilai": ambang_debut,
        },
        "dasar": {
            "median_rasio": round(median(rasio), 4) if rasio else None,
            "median_jeda": median([t.jeda for t in tender if t.jeda is not None]) if any(t.jeda is not None for t in tender) else None,
            "porsi": {nama: round(sum(1 for t in tender if t.pola & bit) / n, 4) for nama, bit in BIT_POLA.items()},
            "porsi_ganda": round(sum(1 for t in tender if pola_ganda(t.pola)) / n, 4),
        },
    }
