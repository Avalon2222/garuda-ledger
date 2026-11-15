import csv
import random

from pipeline import ekspor
from pipeline.konfigurasi import BIT_POLA as B
from pipeline.resolusi import Vendor

from .bantu import tender

VENDOR = {
    "va": Vendor(id="va", nama="PT Alfa", bentuk="PT"),
    "vb": Vendor(id="vb", nama="CV Karya Baru", bentuk="CV"),
    "vc": Vendor(id="vc", nama="CV Karya Baru", bentuk="CV"),   # nama sama, usaha berbeda (tidak digabung)
}


def bahan() -> list:
    a1 = tender("a1", vendor="va", satker="Satker X", nilai=600.0, hps=600.0, menang="2020-03-01")
    a2 = tender("a2", vendor="va", satker="Satker X", nilai=200.0, hps=250.0, menang="2022-05-01")
    b1 = tender("b1", vendor="vb", satker="Satker X", nilai=200.0, hps=400.0, menang="2021-01-10", kategori="jasa")
    c1 = tender("c1", vendor="vc", satker="Satker Y", nilai=50.0, hps=0.0, menang="2021-06-10")
    a1.pola = B["mepet"] | B["persis"] | B["langganan"]      # dua pola berbeda -> pola ganda
    a2.pola = B["langganan"]
    b1.pola = B["mepet"] | B["ulang"]                         # satu pola yang dihitung -> bukan pola ganda
    c1.unit = "TNI Angkatan Laut"
    return [a1, a2, b1, c1]


def test_tabel_vendor_angka_bisa_dihitung_tangan():
    v = ekspor.tabel(bahan(), VENDOR)["vendor"]
    assert [b["vendor"] for b in v] == ["PT Alfa", "CV Karya Baru", "CV Karya Baru"]   # urut nilai terbesar
    alfa = v[0]
    assert alfa == {
        "vendor": "PT Alfa", "bentuk": "PT", "unit_utama": "TNI Angkatan Darat", "instansi_utama": "Kemhan/TNI",
        "paket": 2, "nilai": 800, "satker": 1, "tahun_awal": 2020, "tahun_akhir": 2022,
        "median_rasio_hps": 0.9, "mepet_hps": 1, "langganan": 2, "pola_ganda": 1,
    }


def test_vendor_bernama_sama_tetap_dua_baris_dan_bisa_dibedakan():
    v = ekspor.tabel(bahan(), VENDOR)["vendor"]
    kembar = [b for b in v if b["vendor"] == "CV Karya Baru"]
    assert [(b["nilai"], b["unit_utama"]) for b in kembar] == [(200, "TNI Angkatan Darat"), (50, "TNI Angkatan Laut")]
    assert kembar[1]["median_rasio_hps"] == ""                 # HPS tidak tercatat -> rasio kosong, bukan nol


def test_tabel_satker_hhi_dan_vendor_terbesar():
    s = ekspor.tabel(bahan(), VENDOR)["satker"]
    assert [b["satker"] for b in s] == ["Satker X", "Satker Y"]
    x = s[0]
    assert (x["paket"], x["nilai"], x["vendor"]) == (3, 1000, 2)
    assert x["hhi"] == 0.68                                    # 0,8^2 + 0,2^2
    assert (x["vendor_terbesar"], x["porsi_vendor_terbesar"]) == ("PT Alfa", 0.8)
    assert x["pola_ganda"] == 1 and x["instansi"] == "Kemhan/TNI"
    assert s[1]["hhi"] == 1.0 and s[1]["unit"] == "TNI Angkatan Laut"


def test_tabel_tahunan_dipecah_per_jenis_dan_terurut():
    t = ekspor.tabel(bahan(), VENDOR)["tahunan"]
    assert [(b["tahun"], b["kategori"], b["paket"], b["nilai"]) for b in t] == [
        (2020, "barang", 1, 600), (2021, "barang", 1, 50), (2021, "jasa", 1, 200), (2022, "barang", 1, 200),
    ]
    assert t[2]["mepet_hps"] == 1 and t[2]["pola_ganda"] == 0 and t[2]["median_rasio_hps"] == 0.5


def test_keluaran_sama_persis_apa_pun_urutan_tender(tmp_path):
    acuan = ekspor.tabel(bahan(), VENDOR)
    for benih in range(5):
        acak = bahan()
        random.Random(benih).shuffle(acak)
        assert ekspor.tabel(acak, VENDOR) == acuan


def test_tulis_csv_kepala_tetap_dan_bisa_dibaca_ulang(tmp_path):
    jalur = ekspor.tulis(ekspor.tabel(bahan(), VENDOR), tmp_path)
    assert sorted(p.name for p in jalur) == ["satker.csv", "tahunan.csv", "vendor.csv"]
    for p in jalur:
        mentah = p.read_bytes()
        assert b"\r" not in mentah                              # LF saja, supaya sama di Windows dan Linux
        with open(p, encoding="utf-8", newline="") as f:
            baris = list(csv.DictReader(f))
        assert list(baris[0]) == ekspor.KOLOM[p.stem]
    with open(tmp_path / "vendor.csv", encoding="utf-8", newline="") as f:
        assert next(csv.DictReader(f))["nilai"] == "800"


def test_nama_kolom_netral():
    semua = " ".join(k for kolom in ekspor.KOLOM.values() for k in kolom)
    for kata in ("curiga", "korupsi", "curang", "red_flag", "fraud"):
        assert kata not in semua


def test_nilai_dan_paket_selalu_bilangan_bulat():
    """1000.0 == 1000 di Python, tapi di CSV jadi '1000.0'. Jadi tipenya ikut diperiksa, bukan cuma angkanya."""
    for nama, baris in ekspor.tabel(bahan(), VENDOR).items():
        for b in baris:
            assert type(b["nilai"]) is int and type(b["paket"]) is int, (nama, b)
