# Sumber data

## Tender (tabel fakta)

| | |
|---|---|
| Sumber | Opentender, Indonesia Corruption Watch (ICW), hasil olahan data SPSE dari LKPP |
| Diambil dari | [OCP Data Registry, publikasi 101](https://data.open-contracting.org/en/publication/101) |
| Format | Open Contracting Data Standard (OCDS), satu berkas JSONL per tahun |
| Lisensi | [Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Cakupan waktu | Penetapan pemenang 2013–2023 (berkas 2024 dan 2025 di registri belum memuat sektor ini) |
| Frekuensi | Registri mengambil ulang dari Opentender kira-kira sebulan sekali; pipeline mengecek registri tiap hari |

Kolom OCDS yang dipakai:

| Kolom OCDS | Dipakai sebagai |
|---|---|
| `buyer.id`, `buyer.name` | Instansi (kode K/L versi LKPP: K28 Kemhan, L47 Polri, L58 Bakamla, L39 BSSN, L2 BIN, L37 Lemhannas, L10 BNPT, L26 Wantannas) |
| `tender.procuringEntity` | LPSE, dipetakan ke unit (TNI AD/AL/AU, Mabes TNI, Mabes Polri, Polda) |
| `parties[].additionalIdentifiers[].legalName` | Satuan kerja |
| `tender.id`, `tender.title` | Kode dan judul paket |
| `tender.minValue.amount` | HPS |
| `awards[0].value.amount` | Nilai pemenang |
| `awards[0].suppliers[0]` | Penyedia pemenang (ID dan nama) |
| `tender.datePublished`, `awards[0].date` | Tanggal pengumuman dan penetapan pemenang |
| `awards[0].items[0].classification.description` | Jenis pengadaan |
| `tender.statusDetails` | Catatan tender ulang (alasan tender sebelumnya gagal) |

Yang **tidak** ada di sumber: daftar peserta dan harga penawaran tiap peserta, nilai kontrak akhir, adendum, dan
realisasi pembayaran.

### Masalah kualitas yang ditangani pipeline

| Masalah | Penanganan | Jumlah |
|---|---|---|
| Kolom pembeli kosong (data 2013–2016) | Instansi diambil dari pemilik LPSE | ± 2.700 catatan |
| Pembeli lain tercatat di LPSE sektor ini (salah gabung di sumber) | Dibuang dari cakupan | ± 300 catatan |
| Jenis pengadaan berisi nama kolom mentah `kgr_nama` | Jatuh ke `mainProcurementCategory` | 6.490 paket |
| Satker kosong | Diberi nama pengganti "(unit, satker tidak tercatat)" | 4.443 paket |
| Tanggal salah ketik (tahun 3020, jeda puluhan tahun) | Tanggal menang rusak → baris dibuang; jeda tak masuk akal → jeda dikosongkan | lihat panel Data & metode |
| Satu penyedia, banyak ID dan ejaan | Entity resolution (lihat README) | 2.775 catatan disatukan |
| Nilai pemenang di atas HPS | Dibiarkan, ditandai pola "Di atas HPS" | 22 paket |

## Pemilik (kurasi tangan)

`pemilik.csv` dan `kepemilikan.csv` memuat BUMN, induknya, dan anak usaha yang muncul sebagai pemenang tender.
Hubungannya diambil dari situs resmi tiap perusahaan (kolom `sumber`) dan hanya mencatat "BUMN" atau "anak usaha",
tanpa persentase saham, karena komposisi saham berubah dari waktu ke waktu (pembentukan holding, pengalihan ke
BPI Danantara). Kepemilikan negara bisa langsung atau lewat holding.

Koperasi di lingkungan TNI dan Polri (Primkopad, Puskopal, Inkoppol, dan sejenisnya) dikelompokkan otomatis dari
namanya. Kelompok ini bukan badan hukum dan bukan pemilik: koperasi dimiliki anggotanya.

Data pemilik manfaat perusahaan swasta tidak tersedia sebagai data terbuka di Indonesia, jadi tidak dimuat.

## Ringkasan CSV (`data/ekspor/`)

`ledger.json` berbentuk kolom dan dibuat untuk aplikasi graf. Untuk dipakai alat lain (spreadsheet, notebook,
chatbot), pipeline bisa menulis tiga tabel agregat datar:

| Berkas | Satu baris per | Baris | Kolom penting |
|---|---|---|---|
| `vendor.csv` | vendor | 11.593 | `paket`, `nilai`, `satker` (jumlah satker pembeli), `unit_utama`, `tahun_awal`, `tahun_akhir`, `median_rasio_hps` |
| `satker.csv` | satuan kerja | 1.943 | `paket`, `nilai`, `vendor` (jumlah pemenang), `hhi`, `vendor_terbesar`, `porsi_vendor_terbesar` |
| `tahunan.csv` | tahun × instansi × jenis pengadaan | 224 | `paket`, `nilai`, `vendor`, `median_rasio_hps` |

Yang perlu diketahui sebelum memakainya:

- `nilai` adalah rupiah bulat yang dijumlahkan per paket, sama seperti di `ledger.json`. Total ketiga tabel cocok
  persis dengan total di aplikasi (diuji di `tests/pipeline/test_muat.py`).
- Kolom `mepet_hps`, `langganan`, dan `pola_ganda` adalah **hitungan paket** menurut definisi statistik di README.
  Angka itu bukan indikasi pelanggaran; banyak pola punya penjelasan yang wajar.
- Vendor bernama sama di daerah berbeda sengaja tetap dua baris (lihat aturan entity resolution). Kolom
  `unit_utama` membedakannya.
- Berkas ini **tidak** ikut refresh harian. Job harian hanya mendorong JSON ke cabang `data`; CSV di sini dibuat
  ulang dengan perintah di bawah lalu di-commit:

```bash
python -m pipeline.jalankan --paksa --ekspor data/ekspor
```

## Sumber yang dicoba tapi tidak dipakai

| Sumber | Kenapa tidak |
|---|---|
| Portal SPSE (`spse.inaproc.id`) | Daftar paket hanya bisa diambil dengan token sesi halaman; bukan antarmuka data untuk publik |
| INAPROC API Gateway | Hanya untuk Kementerian, Lembaga, dan Pemda yang mendaftar lewat surat permohonan |
| Dasbor `data.inaproc.id` | Menolak klien selain browser; tidak memuat HPS |
