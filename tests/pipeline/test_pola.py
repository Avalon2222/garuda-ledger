from pipeline.konfigurasi import BIT_POLA as B
from pipeline.pola import PESERTA_TUNGGAL, persentil, pola_ganda, tandai

from .bantu import tender


def latar(n: int = 40) -> list:
    """Paket biasa dari banyak vendor, supaya persentil punya pembanding."""
    return [tender(f"l{i}", vendor=f"lv{i}", satker=f"Satker L{i % 7}", nilai=500e6 + i * 1e6, hps=600e6 + i * 1e6,
                   menang=f"2020-{1 + i % 12:02d}-10", jeda=12 + i % 9) for i in range(n)]


def test_persentil():
    assert persentil([], 0.5) == 0
    assert persentil([5, 1, 3], 0) == 1 and persentil([5, 1, 3], 0.5) == 3 and persentil([5, 1, 3], 1) == 5


def test_harga_mepet_persis_dan_lewat_hps():
    a = tender("a", nilai=999.5e6, hps=1000e6)
    b = tender("b", nilai=1000e6, hps=1000e6)
    c = tender("c", nilai=1001e6, hps=1000e6)
    d = tender("d", nilai=990e6, hps=1000e6)
    e = tender("e", nilai=1e9, hps=0)
    tandai([a, b, c, d, e, *latar()])
    assert a.pola & B["mepet"] and not a.pola & B["persis"]
    assert b.pola & B["mepet"] and b.pola & B["persis"]
    assert c.pola & B["lewat_hps"] and not c.pola & B["mepet"]
    assert not d.pola & (B["mepet"] | B["persis"] | B["lewat_hps"])
    assert e.pola & (B["mepet"] | B["lewat_hps"]) == 0


def test_kilat_relatif_terhadap_kategorinya():
    cepat = tender("cepat", jeda=2)
    tanpa = tender("tanpa", jeda=None)
    ringkasan = tandai([cepat, tanpa, *latar(60)])
    assert cepat.pola & B["kilat"] and not tanpa.pola & B["kilat"]
    assert ringkasan["ambang"]["kilat_hari"]["barang"] <= 12
    assert sum(1 for t in latar(60) if t.pola & B["kilat"]) == 0


def test_langganan_butuh_lima_tahun_berbeda():
    lima = [tender(f"y{y}", vendor="setia", satker="Satker X", menang=f"{y}-05-05") for y in range(2017, 2022)]
    empat = [tender(f"z{y}", vendor="baru", satker="Satker X", menang=f"{y}-05-05") for y in range(2018, 2022)]
    tandai([*lima, *empat, *latar()])
    assert all(t.pola & B["langganan"] for t in lima)
    assert not any(t.pola & B["langganan"] for t in empat)


def test_dominan_butuh_porsi_dan_jumlah_paket():
    besar = [tender(f"b{i}", vendor="raja", satker="Satker D", nilai=10e9, hps=11e9, menang=f"201{6 + i}-02-02") for i in range(3)]
    kecil = [tender(f"k{i}", vendor=f"lain{i}", satker="Satker D", nilai=1e9, hps=1.1e9) for i in range(3)]
    # satker dengan cuma dua paket: porsi 100% tapi terlalu sedikit untuk disebut dominan
    sepi = [tender(f"s{i}", vendor="sendiri", satker="Satker Sepi", menang=f"201{8 + i}-02-02") for i in range(2)]
    tandai([*besar, *kecil, *sepi, *latar()])
    assert all(t.pola & B["dominan"] for t in besar)
    assert not any(t.pola & B["dominan"] for t in kecil + sepi)


def test_beruntun_jendela_geser_30_hari():
    rapat = [tender(f"r{i}", vendor="cepat", satker="Satker R", menang=f"2022-06-{1 + i * 10:02d}") for i in range(3)]   # 1, 11, 21 Juni
    renggang = [tender(f"g{i}", vendor="santai", satker="Satker R", menang=f"2022-{1 + i * 3:02d}-01") for i in range(3)]
    susulan = tender("r9", vendor="cepat", satker="Satker R", menang="2022-12-25")
    tandai([*rapat, *renggang, susulan, *latar()])
    assert all(t.pola & B["beruntun"] for t in rapat)
    assert not any(t.pola & B["beruntun"] for t in renggang)
    assert not susulan.pola & B["beruntun"]


def test_debut_besar_hanya_kemenangan_pertama_dan_bukan_di_tahun_awal_data():
    awal = tender("awal", vendor="lama", nilai=900e9, hps=950e9, menang="2015-01-05")       # tahun pertama data
    debut = tender("debut", vendor="pendatang", nilai=800e9, hps=850e9, menang="2021-01-05")
    kedua = tender("kedua", vendor="pendatang", nilai=850e9, hps=900e9, menang="2022-01-05")
    tandai([awal, debut, kedua, *latar()])
    assert debut.pola & B["debut"]
    assert not kedua.pola & B["debut"] and not awal.pola & B["debut"]


def test_catatan_tender_ulang_dan_peserta_tunggal():
    a = tender("a", ulang="Hanya 1 (Satu) Peserta Lelang yang memasukkan penawaran.")
    b = tender("b", ulang="Tidak ada peserta yang lulus evaluasi teknis")
    c = tender("c", ulang="hanya ada dua peserta yang memasukkan dokumen penawaran")
    d = tender("d")
    tandai([a, b, c, d, *latar()])
    assert a.pola & B["ulang"] and a.pola & B["tunggal"]
    assert b.pola & B["ulang"] and not b.pola & B["tunggal"]
    assert not c.pola & B["tunggal"] and d.pola & (B["ulang"] | B["tunggal"]) == 0
    assert PESERTA_TUNGGAL.search("Hanya satu penyedia yang memasukkan penawaran")


def test_ringkasan_memuat_ambang_dan_porsi_semua_pola():
    r = tandai(latar())
    assert set(r["dasar"]["porsi"]) == set(B)
    assert 0.8 < r["dasar"]["median_rasio"] < 1
    assert r["ambang"]["mepet"] == 0.999


def test_menandai_ulang_tidak_menumpuk_bit_lama():
    t = tender("x", nilai=1000e6, hps=1000e6)
    tandai([t, *latar()])
    pertama = t.pola
    tandai([t, *latar()])
    assert t.pola == pertama


def test_pola_ganda_butuh_dua_pola_berbeda():
    assert not pola_ganda(0)
    assert not pola_ganda(B["mepet"] | B["persis"])            # persis hanyalah mepet yang lebih ketat
    assert not pola_ganda(B["mepet"] | B["ulang"] | B["lewat_hps"])
    assert pola_ganda(B["mepet"] | B["langganan"])
    assert pola_ganda(B["kilat"] | B["tunggal"] | B["debut"])
    r = tandai(latar())
    assert 0 <= r["dasar"]["porsi_ganda"] <= 1
