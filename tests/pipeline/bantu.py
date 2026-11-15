"""Pabrik data uji: catatan OCDS dan baris Tender tiruan."""
from __future__ import annotations

from pipeline.bersihkan import Tender


def catatan(
    kode: str = "1001638",
    *,
    pembeli: tuple[str, str] = ("K28", "Kementerian Pertahanan"),
    lpse: tuple[str, str] = ("638", "LPSE TNI Angkatan Darat"),
    satker: str = "Pusbekangad TNI AD",
    penyedia: tuple[str, str] = ("77638-1", "PT. CONTOH JAYA"),
    nilai: float | None = 990_000_000.0,
    hps: float | None = 1_000_000_000.0,
    umum: str = "2021-03-01T00:00:00.000000Z",
    menang: str = "2021-03-15T00:00:00.000000Z",
    klas: str = "Pengadaan Barang",
    utama: str = "goods",
    status_rinci: str = " | ",
    berpemenang: bool = True,
) -> dict:
    """Satu catatan OCDS berbentuk sama dengan keluaran Opentender."""
    c: dict = {
        "ocid": f"ocds-20h3g7-{kode}",
        "buyer": {"id": pembeli[0], "name": pembeli[1]},
        "tender": {
            "id": kode,
            "title": f"Paket {kode}",
            "status": "complete" if berpemenang else "planning",
            "minValue": {"amount": hps, "currency": "IDR"},
            "datePublished": umum,
            "statusDetails": status_rinci,
            "procuringEntity": {"id": lpse[0], "name": lpse[1]},
            "mainProcurementCategory": utama,
        },
        "parties": [
            {"id": pembeli[0], "name": pembeli[1], "roles": ["buyer"], "additionalIdentifiers": [{"legalName": satker}]},
            {"id": lpse[0], "name": lpse[1], "roles": ["procuringEntity"]},
        ],
    }
    if berpemenang:
        c["awards"] = [{
            "id": f"{kode}-1",
            "date": menang,
            "items": [{"id": "1", "classification": {"description": klas}}],
            "title": f"Paket {kode}",
            "value": {"amount": nilai, "currency": "IDR"},
            "suppliers": [{"id": penyedia[0], "name": penyedia[1]}],
        }]
    return c


def tender(
    id: str = "t1",
    *,
    vendor: str = "v1",
    satker: str = "Satker A",
    nilai: float = 1_000_000_000.0,
    hps: float = 1_100_000_000.0,
    menang: str = "2021-03-15",
    jeda: int | None = 14,
    kategori: str = "barang",
    ulang: str = "",
) -> Tender:
    return Tender(
        id=id, judul=f"Paket {id}", instansi="kemhan", unit="TNI Angkatan Darat", lpse="638", satker=satker,
        kategori=kategori, hps=hps, nilai=nilai, tgl_umum="", tgl_menang=menang, id_penyedia="", nama_penyedia=vendor,
        jeda=jeda, rasio=(nilai / hps) if hps else None, ulang=ulang, vendor=vendor,
    )
