"""Semua angka dan daftar yang menentukan cakupan dan ambang pipeline ada di sini."""
from __future__ import annotations

from dataclasses import dataclass

# OCP Data Registry, publikasi 101: Indonesia Corruption Watch (Opentender), lisensi ODbL.
# Satu berkas JSONL per tahun; registri mengambil ulang dari opentender.net kira-kira sebulan sekali.
URL_REGISTRI = "https://data.open-contracting.org/en/publication/101"
URL_UNDUH = URL_REGISTRI + "/download?name={tahun}.jsonl.gz"
TAHUN_AWAL = 2013
AGEN = "garuda-ledger/1.0 (+https://github.com/Avalon2222/garuda-ledger)"


@dataclass(frozen=True)
class Instansi:
    id: str
    nama: str
    singkat: str
    kode_pembeli: tuple[str, ...]


# Pembeli di sektor pertahanan & keamanan. kode_pembeli = buyer.id di OCDS (kode K/L versi LKPP).
INSTANSI: tuple[Instansi, ...] = (
    Instansi("kemhan", "Kementerian Pertahanan & TNI", "Kemhan/TNI", ("K28",)),
    Instansi("polri", "Kepolisian Negara Republik Indonesia", "Polri", ("L47",)),
    Instansi("bakamla", "Badan Keamanan Laut", "Bakamla", ("L58",)),
    Instansi("bssn", "Badan Siber dan Sandi Negara", "BSSN", ("L39",)),
    Instansi("bin", "Badan Intelijen Negara", "BIN", ("L2",)),
    Instansi("lemhannas", "Lembaga Ketahanan Nasional", "Lemhannas", ("L37",)),
    Instansi("bnpt", "Badan Nasional Penanggulangan Terorisme", "BNPT", ("L10",)),
    Instansi("wantannas", "Dewan Ketahanan Nasional", "Wantannas", ("L26",)),
)
KODE_KE_INSTANSI = {kode: i.id for i in INSTANSI for kode in i.kode_pembeli}

# LPSE (procuringEntity.id) milik instansi di atas. Dipakai untuk dua hal:
# 1) menamai "unit" (matra TNI, Mabes Polri, Polda) dan
# 2) menyelamatkan catatan lama (2013-2016) yang kolom pembelinya kosong.
LPSE_KE_UNIT: dict[str, tuple[str, str]] = {
    "482": ("kemhan", "Kementerian Pertahanan"),
    "603": ("kemhan", "Mabes TNI"),
    "638": ("kemhan", "TNI Angkatan Darat"),
    "588": ("kemhan", "TNI Angkatan Laut"),
    "605": ("kemhan", "TNI Angkatan Udara"),
    "44": ("polri", "Mabes Polri"),
    "713": ("bakamla", "Bakamla"),
    "491": ("bssn", "BSSN"),
    "424": ("bin", "BIN"),
    "649": ("lemhannas", "Lemhannas"),
    "547": ("bnpt", "BNPT"),
}

# Alamat portal SPSE tiap LPSE (https://spse.inaproc.id/<slug>), hanya yang sudah dicek terbuka.
SLUG_SPSE = {
    "482": "kemhan", "638": "tniad", "588": "tnial", "44": "polri", "713": "bakamla",
    "491": "bssn", "424": "bin", "649": "lemhannas", "547": "bnpt",
}

# Ambang pola. Semuanya deskriptif: pola menandai paket yang layak dibaca lebih teliti, bukan pelanggaran.
AMBANG_MEPET = 0.999        # nilai menang >= 99,9% HPS
AMBANG_PERSIS = 0.99999     # nilai menang praktis sama dengan HPS
PERSENTIL_KILAT = 0.05      # jeda umumkan -> menang di 5% tercepat untuk jenis pengadaannya
BERUNTUN_JUMLAH = 3         # >= 3 paket vendor yang sama di satker yang sama ...
BERUNTUN_HARI = 30          # ... dalam jendela 30 hari
LANGGANAN_TAHUN = 5         # menang di satker yang sama pada >= 5 tahun berbeda
DOMINAN_PORSI = 0.5         # >= 50% nilai satker jatuh ke satu vendor ...
DOMINAN_MIN_PAKET = 5       # ... dengan syarat satker punya >= 5 paket
DEBUT_PERSENTIL = 0.9       # kemenangan pertama vendor sudah di 10% nilai terbesar

# Jeda umumkan -> menang di luar rentang ini dianggap salah ketik tanggal dan tidak dipakai.
JEDA_MAKS_HARI = 730
TAHUN_MIN, TAHUN_MAKS_TAMBAH = 2008, 1  # tanggal menang harus di antara 2008 dan tahun berjalan + 1

BIT_POLA = {
    "mepet": 1,
    "persis": 2,
    "kilat": 4,
    "beruntun": 8,
    "langganan": 16,
    "dominan": 32,
    "debut": 64,
    "lewat_hps": 128,
    "ulang": 256,
    "tunggal": 512,
}
