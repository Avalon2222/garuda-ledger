"""Gerbang kualitas: pemeriksaan yang harus lulus sebelum data baru boleh dipublikasikan.

Kalau sumber berubah bentuk (kolom hilang, format tanggal baru), lebih baik run gagal dan aplikasi tetap
memakai data kemarin daripada menayangkan graf yang salah.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from .bersihkan import Laporan, Tender
from .resolusi import HasilResolusi


@dataclass
class Periksa:
    nama: str
    lulus: bool
    nilai: float | int | str
    batas: str
    kritis: bool = True


def periksa(tender: list[Tender], laporan: Laporan, resolusi: HasilResolusi, tender_sebelumnya: int | None = None) -> list[Periksa]:
    n = len(tender)
    id_unik = len({t.id for t in tender})
    ada_hps = sum(1 for t in tender if t.hps > 0)
    dibuang = sum(laporan.dibuang.values())
    berpemenang = n + dibuang
    hasil = [
        Periksa("jumlah_tender", n >= 1000, n, ">= 1000"),
        Periksa("kode_tender_unik", id_unik == n, n - id_unik, "0 duplikat"),
        Periksa("nilai_positif", all(t.nilai > 0 for t in tender), sum(1 for t in tender if t.nilai <= 0), "0 baris"),
        Periksa("tanggal_menang_terisi", all(len(t.tgl_menang) == 10 for t in tender), sum(1 for t in tender if len(t.tgl_menang) != 10), "0 baris"),
        Periksa("vendor_terisi", all(t.vendor in resolusi.vendor for t in tender), sum(1 for t in tender if t.vendor not in resolusi.vendor), "0 baris"),
        Periksa("hps_terisi", n > 0 and ada_hps / n >= 0.95, round(ada_hps / n, 4) if n else 0, ">= 95%"),
        Periksa("baris_dibuang", berpemenang > 0 and dibuang / berpemenang <= 0.05, round(dibuang / berpemenang, 4) if berpemenang else 1, "<= 5%"),
        Periksa("resolusi_tidak_memecah", resolusi.statistik["vendor"] <= resolusi.statistik["catatan_unik"], resolusi.statistik["vendor"], "<= catatan unik"),
        Periksa("rasio_wajar", sum(1 for t in tender if t.rasio is not None and t.rasio > 1.0001) / (n or 1) <= 0.01,
                sum(1 for t in tender if t.rasio is not None and t.rasio > 1.0001), "<= 1% di atas HPS", kritis=False),
    ]
    if tender_sebelumnya:
        hasil.append(Periksa("tidak_menyusut", n >= 0.9 * tender_sebelumnya, n, f">= 90% dari {tender_sebelumnya}"))
    return hasil


def lulus_semua(hasil: list[Periksa]) -> bool:
    return all(p.lulus for p in hasil if p.kritis)


def ke_json(hasil: list[Periksa]) -> list[dict]:
    return [asdict(p) for p in hasil]
