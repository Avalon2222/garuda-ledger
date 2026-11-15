import json

from pipeline.bersihkan import Laporan, nama_unit, ratakan, saring, tentukan_cakupan

from .bantu import catatan

TAHUN_MAKS = 2027


def test_cakupan_dari_kode_pembeli_dan_lpse():
    assert tentukan_cakupan(catatan()) == ("kemhan", "TNI Angkatan Darat")
    polda = catatan(pembeli=("L47", "Kepolisian Negara Republik Indonesia"), lpse=("581", "LPSE Polda Jawa Timur"))
    assert tentukan_cakupan(polda) == ("polri", "Polda Jawa Timur")


def test_pembeli_kosong_diselamatkan_lewat_lpse():
    lama = catatan(pembeli=("", ""), lpse=("44", "LPSE POLRI"))
    assert tentukan_cakupan(lama) == ("polri", "Mabes Polri")


def test_pembeli_lain_di_lpse_sektor_ini_dibuang():
    nyasar = catatan(pembeli=("K29", "Kementerian Pertanian"), lpse=("424", "LPSE Badan Intelijen Negara"))
    assert tentukan_cakupan(nyasar) is None


def test_satker_yang_menumpang_lpse_pemda():
    numpang = catatan(pembeli=("L47", "Kepolisian Negara Republik Indonesia"), lpse=("88", "LPSE Kota Salatiga"))
    assert tentukan_cakupan(numpang) == ("polri", "Lewat LPSE lain")


def test_nama_unit_polda():
    assert nama_unit("544", "LPSE POLDA SULSEL") == ("polri", "Polda Sulawesi Selatan")
    assert nama_unit("573", "LPSE Polda NTT") == ("polri", "Polda NTT")
    assert nama_unit("107", "LPSE Kabupaten Muara Enim") is None


def test_ratakan_menghitung_rasio_dan_jeda():
    lap = Laporan()
    t = ratakan(catatan(), ("kemhan", "TNI Angkatan Darat"), lap, TAHUN_MAKS)
    assert t is not None
    assert (t.id, t.kategori, t.jeda) == ("1001638", "barang", 14)
    assert t.rasio == 0.99 and t.satker == "Pusbekangad TNI AD"
    assert t.nama_penyedia == "PT. CONTOH JAYA"


def test_kategori_kgr_nama_jatuh_ke_kategori_utama():
    lap = Laporan()
    t = ratakan(catatan(klas="kgr_nama", utama="services"), ("polri", "Polda Bali"), lap, TAHUN_MAKS)
    assert t.kategori == "jasa" and lap.diperbaiki["kategori_dari_utama"] == 1


def test_tanggal_salah_ketik_tidak_menghasilkan_jeda():
    lap = Laporan()
    t = ratakan(catatan(umum="2012-01-01T00:00:00Z", menang="2021-03-15T00:00:00Z"), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS)
    assert t.jeda is None and t.tgl_umum == "" and lap.diperbaiki["jeda_tidak_masuk_akal"] == 1
    # tahun 3020 di tanggal menang: baris tidak dipakai sama sekali
    assert ratakan(catatan(menang="3020-03-15T00:00:00Z"), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS) is None
    assert lap.dibuang["tanggal_menang_rusak"] == 1


def test_baris_tanpa_pemenang_atau_nilai_dibuang_dengan_alasan():
    lap = Laporan()
    assert ratakan(catatan(berpemenang=False), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS) is None
    assert lap.perencanaan == 1
    assert ratakan(catatan(nilai=0), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS) is None
    assert ratakan(catatan(penyedia=("1", "  ")), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS) is None
    assert lap.dibuang == {"nilai_tidak_valid": 1, "penyedia_kosong": 1}


def test_hps_kosong_tetap_dipakai_tanpa_rasio():
    lap = Laporan()
    t = ratakan(catatan(hps=None), ("kemhan", "Mabes TNI"), lap, TAHUN_MAKS)
    assert t.hps == 0 and t.rasio is None and lap.diperbaiki["hps_kosong"] == 1


def test_satker_kosong_diberi_nama_pengganti():
    lap = Laporan()
    t = ratakan(catatan(satker=""), ("bin", "BIN"), lap, TAHUN_MAKS)
    assert t.satker == "(BIN, satker tidak tercatat)"


def test_saring_streaming_membuang_luar_cakupan_duplikat_dan_json_rusak():
    baris = [
        json.dumps(catatan("1")),
        json.dumps(catatan("1")),                                              # duplikat
        json.dumps(catatan("2", pembeli=("D485", "Pemerintah Daerah Kabupaten Muara Enim"), lpse=("107", "LPSE Kabupaten Muara Enim"))),
        '{"buyer": {"id": "K28"',                                              # terpotong
        json.dumps(catatan("3", status_rinci=" | Tidak ada peserta yang lulus evaluasi penawaran")),
        json.dumps(catatan("4", berpemenang=False)),
    ]
    lap = Laporan()
    hasil = list(saring(baris, lap, TAHUN_MAKS))
    assert [t.id for t in hasil] == ["1", "3"]
    assert lap.dibaca == 6 and lap.lolos_prasaring == 5 and lap.dalam_cakupan == 4
    assert lap.dibuang == {"duplikat": 1, "json_rusak": 1} and lap.perencanaan == 1
    assert hasil[1].ulang == "Tidak ada peserta yang lulus evaluasi penawaran"
