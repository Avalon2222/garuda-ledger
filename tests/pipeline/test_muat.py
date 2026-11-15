"""Tes tahap ambil (extract), graf (load), gerbang kualitas, dan pipeline dari ujung ke ujung."""
import gzip
import io
import json
import urllib.error

from pipeline import ambil, graf, jalankan, kualitas, pola, resolusi
from pipeline.bersihkan import Laporan, saring

from .bantu import catatan


class Balasan(io.BytesIO):
    def __init__(self, isi: bytes, kepala: dict):
        super().__init__(isi)
        self.headers = kepala

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def pembuka_palsu(ada: dict[int, bytes], log: list):
    """Tiruan urlopen: 200 untuk tahun yang ada, 304 kalau ETag cocok, 404 selain itu."""
    def buka(permintaan, timeout=0):
        tahun = int(permintaan.full_url.split("name=")[1][:4])
        log.append((tahun, permintaan.get_header("If-none-match")))
        if tahun not in ada:
            raise urllib.error.HTTPError(permintaan.full_url, 404, "Not Found", {}, None)
        etag = f'"e{tahun}-{len(ada[tahun])}"'
        if permintaan.get_header("If-none-match") == etag:
            raise urllib.error.HTTPError(permintaan.full_url, 304, "Not Modified", {}, None)
        return Balasan(ada[tahun], {"ETag": etag, "Last-Modified": "Mon, 03 Aug 2026 02:51:39 GMT"})
    return buka


def test_cek_inkremental_pakai_etag(tmp_path):
    ada = {2021: b"isi-2021", 2022: b"isi-2022"}
    log: list = []
    pertama = ambil.cek(tmp_path, 2022, pembuka=pembuka_palsu(ada, log))
    assert sorted(pertama) == [2021, 2022] and all(b.berubah for b in pertama.values())
    assert (tmp_path / "2021.jsonl.gz").read_bytes() == b"isi-2021"

    log.clear()
    kedua = ambil.cek(tmp_path, 2022, pembuka=pembuka_palsu(ada, log))
    assert not any(b.berubah for b in kedua.values())
    assert (2021, '"e2021-8"') in log                      # permintaan bersyarat dikirim

    ada[2022] = b"isi-2022-versi-baru"
    ketiga = ambil.cek(tmp_path, 2022, pembuka=pembuka_palsu(ada, log))
    assert [t for t, b in ketiga.items() if b.berubah] == [2022]
    assert ambil.baca_manifest(tmp_path)[2022].ukuran == len(ada[2022])


def test_cek_cukup_dengan_manifest_tanpa_berkas(tmp_path):
    """Di CI berkas sumber tidak disimpan antar-run; manifest saja cukup untuk tahu ada rilis baru atau tidak."""
    ada = {2021: b"isi-2021", 2022: b"isi-2022"}
    ambil.cek(tmp_path, 2022, pembuka=pembuka_palsu(ada, []))
    for berkas in tmp_path.glob("*.jsonl.gz"):
        berkas.unlink()

    log: list = []
    hasil = ambil.cek(tmp_path, 2022, pembuka=pembuka_palsu(ada, log))
    assert not any(b.berubah for b in hasil.values())
    assert not list(tmp_path.glob("*.jsonl.gz"))            # 304: tidak ada yang diunduh

    lengkap = ambil.lengkapi(tmp_path, hasil, pembuka=pembuka_palsu(ada, log))
    assert sorted(p.name for p in tmp_path.glob("*.jsonl.gz")) == ["2021.jsonl.gz", "2022.jsonl.gz"]
    assert not any(b.berubah for b in lengkap.values())     # melengkapi berkas bukan berarti sumbernya berubah
    assert log[-1] == (2022, None)                          # unduhan pelengkap tidak bersyarat


def test_manifest_rusak_dianggap_kosong(tmp_path):
    (tmp_path / ambil.NAMA_MANIFEST).write_text("{bukan json", encoding="utf-8")
    assert ambil.baca_manifest(tmp_path) == {}


def bahan(n: int = 1200) -> list[dict]:
    """Catatan tiruan: 40 vendor, 12 satker, tiga LPSE, tanggal tersebar 2019-2022."""
    hasil = []
    for i in range(n):
        v = i % 40
        lpse = [("638", "LPSE TNI Angkatan Darat"), ("588", "LPSE TNI ANGKATAN LAUT"), ("44", "LPSE POLRI")][i % 3]
        pembeli = ("L47", "Kepolisian Negara Republik Indonesia") if lpse[0] == "44" else ("K28", "Kementerian Pertahanan")
        ejaan = [f"PT. VENDOR {v:02d} SEJAHTERA", f"PT VENDOR {v:02d} SEJAHTERA", f"VENDOR {v:02d} SEJAHTERA, PT"][i % 3]
        hasil.append(catatan(
            str(100000 + i), pembeli=pembeli, lpse=lpse, satker=f"Satker {i % 12}", penyedia=(f"{v}{lpse[0]}-1", ejaan),
            nilai=900e6 + (i % 97) * 1e6, hps=1000e6 + (i % 97) * 1e6,
            umum=f"{2019 + i % 4}-{1 + i % 12:02d}-01T00:00:00Z", menang=f"{2019 + i % 4}-{1 + i % 12:02d}-{10 + i % 15:02d}T00:00:00Z",
        ))
    return hasil


def olah(catatan_mentah: list[dict]):
    lap = Laporan()
    tender = list(saring((json.dumps(c) for c in catatan_mentah), lap, 2027))
    kunci = [(t.id_penyedia, t.nama_penyedia, t.lpse) for t in tender]
    hasil = resolusi.selesaikan(kunci)
    for t, k in zip(tender, kunci):
        t.vendor = hasil.peta[k]
    ringkasan = pola.tandai(tender)
    return tender, lap, hasil, ringkasan


def test_susun_skema_bintang_konsisten(tmp_path):
    tender, lap, hasil, _ = olah(bahan(300))
    (tmp_path / "pemilik.csv").write_text("id,nama,jenis,sumber\nnegara,Negara RI,negara,https://x\ninduk,PT Induk,bumn,https://y\nlain,PT Tak Terpakai,bumn,https://z\n", encoding="utf-8")
    (tmp_path / "kepemilikan.csv").write_text("vendor,dari_pemilik,ke,hubungan\nPT Vendor 07 Sejahtera,,induk,anak usaha\n,induk,negara,BUMN\n,lain,negara,BUMN\n", encoding="utf-8")
    isi = graf.susun(tender, hasil, {"x": 1}, tmp_path)

    f = isi["tender"]
    n = len(f["id"])
    assert n == 300 and all(len(kolom) == n for kolom in f.values())
    assert max(f["vendor"]) < len(isi["vendor"]) == 40            # tiga ejaan + tiga LPSE -> 40 PT
    assert max(f["satker"]) < len(isi["satker"])
    assert all(s["unit"] < len(isi["unit"]) for s in isi["satker"])
    assert all(u["instansi"] < len(isi["instansi"]) for u in isi["unit"])
    assert f["menang"] == sorted(f["menang"])                      # fakta diurutkan menurut tanggal menang
    # vendor diurutkan dari nilai terbesar
    total = [0.0] * len(isi["vendor"])
    for v, nilai in zip(f["vendor"], f["nilai"]):
        total[v] += nilai
    assert total == sorted(total, reverse=True)
    # pemilik: rantai ke atas ikut, yang tidak terpakai dibuang
    assert [p["id"] for p in isi["pemilik"]] == ["negara", "induk"]
    nomor = next(i for i, v in enumerate(isi["vendor"]) if v["nama"] == "PT Vendor 07 Sejahtera")
    assert [nomor, "induk", "anak usaha"] in isi["kepemilikan"] and ["p:induk", "negara", "BUMN"] in isi["kepemilikan"]


def test_koperasi_dikelompokkan_dari_nama(tmp_path):
    mentah = bahan(30) + [catatan("900001", penyedia=("k1-1", "PRIMKOPAD KARTIKA MAHERI JAYA")), catatan("900002", penyedia=("k2-1", "Koperasi Zebra Jaya"))]
    tender, _, hasil, _ = olah(mentah)
    (tmp_path / "pemilik.csv").write_text("id,nama,jenis,sumber\nkop-ad,Koperasi di lingkungan TNI AD,koperasi,https://x\n", encoding="utf-8")
    isi = graf.susun(tender, hasil, {}, tmp_path)
    nama = {i: v["nama"] for i, v in enumerate(isi["vendor"])}
    assert [(nama[k[0]], k[1]) for k in isi["kepemilikan"]] == [("Primkopad Kartika Maheri Jaya", "kop-ad")]


def test_sidik_tidak_bergantung_pada_meta_dan_hari():
    tender, _, hasil, _ = olah(bahan(60))
    a = graf.susun(tender, hasil, {"dibangun": "kemarin"})
    b = graf.susun(tender, hasil, {"dibangun": "hari ini"})
    assert graf.sidik(a) == graf.sidik(b)
    tender[0].nilai += 1
    assert graf.sidik(graf.susun(tender, hasil, {})) != graf.sidik(a)
    assert graf.hari("2000-01-02") == 1 and graf.hari("") == -1


def test_gerbang_kualitas():
    tender, lap, hasil, _ = olah(bahan(1200))
    cek = kualitas.periksa(tender, lap, hasil, tender_sebelumnya=1200)
    assert kualitas.lulus_semua(cek), [c for c in cek if not c.lulus]

    sedikit = kualitas.periksa(tender[:50], lap, hasil)
    assert not kualitas.lulus_semua(sedikit)
    susut = kualitas.periksa(tender, lap, hasil, tender_sebelumnya=5000)
    assert [c.nama for c in susut if not c.lulus] == ["tidak_menyusut"]

    tender[3].vendor = "v-hilang"
    assert "vendor_terisi" in [c.nama for c in kualitas.periksa(tender, lap, hasil) if not c.lulus]


def tulis_sumber(folder, catatan_mentah, tahun=2022):
    folder.mkdir(parents=True, exist_ok=True)
    with gzip.open(folder / f"{tahun}.jsonl.gz", "wt", encoding="utf-8") as f:
        for c in catatan_mentah:
            f.write(json.dumps(c) + "\n")
    ambil.tulis_manifest(folder, {tahun: ambil.Berkas(tahun=tahun, etag='"x"', diubah="Mon, 03 Aug 2026 02:51:39 GMT", ukuran=1)})


def test_pipeline_ujung_ke_ujung(tmp_path):
    mentah, keluar = tmp_path / "mentah", tmp_path / "keluar"
    tulis_sumber(mentah, bahan(1200))
    argumen = ["--mentah", str(mentah), "--kurasi", str(tmp_path), "--keluar", str(keluar), "--tanpa-unduh"]
    assert jalankan.main(argumen) == 0

    isi = json.loads((keluar / "ledger.json").read_text(encoding="utf-8"))
    status = json.loads((keluar / "status.json").read_text(encoding="utf-8"))
    assert status["tender"] == 1200 == len(isi["tender"]["id"]) and status["berubah"] is True
    assert status["sidik"] == isi["meta"]["sidik"] and status["sumber_diubah"] == "2026-08-03T02:51:39Z"
    assert isi["meta"]["tahap"]["dibaca"] == 1200 and isi["meta"]["rentang"] == [2019, 2022]
    assert isi["meta"]["resolusi"]["vendor"] == 40

    # run kedua di atas data yang sama: sidik tetap, tidak dianggap berubah, tanggal bangun lama dipertahankan
    assert jalankan.main(argumen) == 0
    lagi = json.loads((keluar / "status.json").read_text(encoding="utf-8"))
    assert lagi["berubah"] is False and lagi["dibangun"] == status["dibangun"] and lagi["sidik"] == status["sidik"]


def test_pipeline_menolak_data_yang_menyusut(tmp_path, capsys):
    mentah, keluar = tmp_path / "mentah", tmp_path / "keluar"
    tulis_sumber(mentah, bahan(2000))
    argumen = ["--mentah", str(mentah), "--kurasi", str(tmp_path), "--keluar", str(keluar), "--tanpa-unduh"]
    assert jalankan.main(argumen) == 0
    sebelum = (keluar / "ledger.json").read_bytes()

    tulis_sumber(mentah, bahan(1100))                      # sumber tiba-tiba kehilangan 45% baris
    assert jalankan.main(argumen) == 1
    assert (keluar / "ledger.json").read_bytes() == sebelum  # keluaran lama tidak ditimpa
    assert "gerbang kualitas gagal" in capsys.readouterr().err


def _baca_csv(jalur):
    import csv
    with open(jalur, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_ekspor_ditulis_hanya_kalau_diminta_dan_cocok_dengan_ledger(tmp_path):
    mentah, keluar, folder = tmp_path / "mentah", tmp_path / "keluar", tmp_path / "ekspor"
    tulis_sumber(mentah, bahan(1200))
    dasar = ["--mentah", str(mentah), "--kurasi", str(tmp_path), "--keluar", str(keluar), "--tanpa-unduh"]

    assert jalankan.main(dasar) == 0
    assert not list(tmp_path.rglob("*.csv"))                  # tanpa --ekspor tidak ada CSV yang ditulis di mana pun

    assert jalankan.main(dasar + ["--ekspor", str(folder)]) == 0
    assert sorted(p.name for p in folder.glob("*.csv")) == ["satker.csv", "tahunan.csv", "vendor.csv"]
    status = json.loads((keluar / "status.json").read_text(encoding="utf-8"))
    vendor, satker, tahunan = (_baca_csv(folder / f"{n}.csv") for n in ("vendor", "satker", "tahunan"))
    assert len(vendor) == status["vendor"]
    for tabel in (vendor, satker, tahunan):                   # tiga tabel dan ledger harus menjumlah ke angka yang sama
        assert sum(int(b["nilai"]) for b in tabel) == status["nilai"]
        assert sum(int(b["paket"]) for b in tabel) == status["tender"]


def test_ekspor_tidak_ditimpa_kalau_gerbang_gagal(tmp_path):
    mentah, keluar, folder = tmp_path / "mentah", tmp_path / "keluar", tmp_path / "ekspor"
    tulis_sumber(mentah, bahan(2000))
    argumen = ["--mentah", str(mentah), "--kurasi", str(tmp_path), "--keluar", str(keluar), "--tanpa-unduh", "--ekspor", str(folder)]
    assert jalankan.main(argumen) == 0
    sebelum = (folder / "vendor.csv").read_bytes()

    tulis_sumber(mentah, bahan(1100))
    assert jalankan.main(argumen) == 1
    assert (folder / "vendor.csv").read_bytes() == sebelum
