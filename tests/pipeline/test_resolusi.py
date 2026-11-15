import pytest

from pipeline.resolusi import (
    GabungCari,
    bersihkan_nama,
    hitung_kandidat_mirip,
    jarak_sunting_maks1,
    nama_tampil,
    selesaikan,
)


@pytest.mark.parametrize("mentah,inti,bentuk", [
    ("PT. PANCA PRIMA MAJU BERSAMA", "PANCA PRIMA MAJU BERSAMA", "PT"),
    ("PT.PANCA PRIMA MAJU BERSAMA", "PANCA PRIMA MAJU BERSAMA", "PT"),
    ("pt.vita jaya kencana", "VITA JAYA KENCANA", "PT"),
    ("DIANA JAYA LESTARI, PT", "DIANA JAYA LESTARI", "PT"),
    ("Baru Mulia, CV", "BARU MULIA", "CV"),
    ("CV Abadi Air Condition Service", "ABADI AIR CONDITION SERVICE", "CV"),
    ("UD. LA NTERA  PATHUNO BERSINAR", "LA NTERA PATHUNO BERSINAR", "UD"),
    ("PT. SRI REJEKI ISMAN, Tbk", "SRI REJEKI ISMAN", "PT"),
    ("PT Wijaya Karya (Persero) Tbk", "WIJAYA KARYA", "PT"),
    ("FELINDO MITRA ABADI", "FELINDO MITRA ABADI", ""),
    ("PRIMKOPAD KARTIKA MAHERI JAYA", "PRIMKOPAD KARTIKA MAHERI JAYA", "Koperasi"),
    ("Koperasi Konsumen Pusat Koperasi Kartika Tidar", "KOPERASI KONSUMEN PUSAT KOPERASI KARTIKA TIDAR", "Koperasi"),
    ("Perum Peruri", "PERURI", "Perum"),
])
def test_bersihkan_nama(mentah, inti, bentuk):
    hasil = bersihkan_nama(mentah)
    assert (hasil.inti, hasil.bentuk) == (inti, bentuk)
    assert hasil.kunci == inti.replace(" ", "")


def test_awalan_bentuk_tidak_memakan_nama_yang_kebetulan_mirip():
    # "PTP" atau "CVA" bukan PT/CV; nama yang hanya berisi bentuk usaha dibiarkan apa adanya
    assert bersihkan_nama("PTPN Nusantara").bentuk == ""
    assert bersihkan_nama("CV").inti == "CV"


def test_nama_tampil_menjaga_singkatan():
    assert nama_tampil("PANCA PRIMA MAJU BERSAMA", "PT") == "PT Panca Prima Maju Bersama"
    assert nama_tampil("CMI TEKNOLOGI", "PT") == "PT Cmi Teknologi"
    assert nama_tampil("BRT 21 DAN REKAN", "CV") == "CV BRT 21 dan Rekan"
    assert nama_tampil("PRIMKOPAD KARTIKA", "Koperasi") == "Primkopad Kartika"


def test_gabung_cari_transitif():
    uf = GabungCari()
    assert uf.gabung("a", "b") and uf.gabung("b", "c")
    assert not uf.gabung("a", "c")
    assert uf.cari("c") == uf.cari("a")
    assert uf.cari("z") == "z"


def test_id_sama_menyatukan_ejaan_berbeda():
    hasil = selesaikan([("10-1", "PT. ABADI JAYA", "638"), ("10-1", "ABADI JAYA, PT", "638"), ("10-1", "PT ABADI JAYA", "588")])
    assert hasil.statistik["vendor"] == 1
    v = next(iter(hasil.vendor.values()))
    assert v.nama == "PT Abadi Jaya" and "id" in v.bukti


def test_pt_digabung_nasional_cv_tidak():
    hasil = selesaikan([
        ("1-1", "PT. SAMUDERA BIRU", "638"), ("2-1", "PT SAMUDERA BIRU", "44"),      # PT: unik nasional
        ("3-1", "CV. KARYA BARU", "568"), ("4-1", "CV KARYA BARU", "636"),          # CV di dua LPSE: dua usaha
    ])
    assert hasil.peta[("1-1", "PT. SAMUDERA BIRU", "638")] == hasil.peta[("2-1", "PT SAMUDERA BIRU", "44")]
    assert hasil.peta[("3-1", "CV. KARYA BARU", "568")] != hasil.peta[("4-1", "CV KARYA BARU", "636")]
    assert hasil.statistik["gabung_nama_pt"] == 1


def test_nama_sama_di_lpse_yang_sama_digabung_termasuk_yang_tanpa_bentuk():
    hasil = selesaikan([("5-1", "CV. KARYA BARU", "568"), ("6-1", "KARYA BARU", "568"), ("7-1", "cv.karya baru", "568")])
    assert hasil.statistik["vendor"] == 1
    assert next(iter(hasil.vendor.values())).bentuk == "CV"


def test_pt_dan_cv_bernama_sama_tidak_pernah_digabung():
    hasil = selesaikan([("8-1", "PT. MITRA SEJATI", "44"), ("9-1", "CV. MITRA SEJATI", "44"), ("11-1", "MITRA SEJATI", "44")])
    assert hasil.statistik["vendor"] == 3
    assert hasil.statistik["bentuk_bentrok"] == 1


def test_id_yang_dipakai_dua_nama_berbeda_diabaikan():
    hasil = selesaikan([("99-1", "PT. ALFA SATU", "638"), ("99-1", "PT. BETA DUA", "603")])
    assert hasil.statistik["vendor"] == 2
    assert hasil.statistik["id_bentrok_nama"] == 1


def test_salah_ketik_tidak_digabung_hanya_dihitung():
    hasil = selesaikan([("1-1", "PT. SAMUDERA BIRU ABADI", "638"), ("2-1", "PT. SAMUDRA BIRU ABADI", "638")])
    assert hasil.statistik["vendor"] == 2
    assert hasil.statistik["kandidat_mirip"] == 1


def test_id_vendor_stabil_terhadap_urutan_masukan():
    data = [("1-1", "PT. ZETA", "1"), ("2-1", "CV. ALFA RAYA", "1"), ("3-1", "PT. MEGA", "2")]
    a = selesaikan(data)
    b = selesaikan(list(reversed(data)))
    assert {k: v.nama for k, v in a.vendor.items()} == {k: v.nama for k, v in b.vendor.items()}


@pytest.mark.parametrize("a,b,harap", [
    ("SAMUDERA", "SAMUDRA", True), ("SAMUDERA", "SAMUDERA", True), ("ABADI", "ABADY", True),
    ("ABADI", "ABADIX", True), ("ABADI", "ABDIX", False), ("ABADI", "ABADIXX", False),
])
def test_jarak_sunting(a, b, harap):
    assert jarak_sunting_maks1(a, b) is harap
    assert jarak_sunting_maks1(b, a) is harap


def test_kandidat_mirip_mengabaikan_nama_pendek():
    assert hitung_kandidat_mirip([bersihkan_nama("PT ABADI"), bersihkan_nama("PT ABADY")]) == 0
