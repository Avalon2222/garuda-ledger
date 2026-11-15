"""Extract: unduh berkas OCDS per tahun dari OCP Data Registry.

Unduhan bersifat inkremental dan dua tahap:

  1. `cek`     Tiap berkas ditanya dengan permintaan bersyarat (If-None-Match + ETag dari manifest). Server
               menjawab 304 tanpa isi kalau tidak ada yang berubah, jadi run harian cuma beberapa permintaan
               kecil. Berkasnya sendiri tidak perlu ada di disk, cukup manifestnya.
  2. `lengkapi` Hanya kalau ada yang berubah (atau diminta membangun ulang): berkas yang belum ada diunduh.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from .konfigurasi import AGEN, TAHUN_AWAL, URL_UNDUH

NAMA_MANIFEST = "manifest.json"


@dataclass
class Berkas:
    tahun: int
    etag: str = ""
    diubah: str = ""       # Last-Modified dari server
    ukuran: int = 0
    dicek: str = ""        # kapan terakhir dicek (UTC ISO)
    berubah: bool = False  # True kalau run ini menemukan isi baru di server


def baca_manifest(folder: Path) -> dict[int, Berkas]:
    jalur = folder / NAMA_MANIFEST
    if not jalur.exists():
        return {}
    try:
        mentah = json.loads(jalur.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {int(b["tahun"]): Berkas(**{**b, "berubah": False}) for b in mentah.get("berkas", [])}


def tulis_manifest(folder: Path, berkas: dict[int, Berkas]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    isi = {"berkas": [{k: v for k, v in asdict(b).items() if k != "berubah"} for _, b in sorted(berkas.items())]}
    (folder / NAMA_MANIFEST).write_text(json.dumps(isi, indent=2), encoding="utf-8")


def _sekarang() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def jalur_berkas(folder: Path, tahun: int) -> Path:
    return folder / f"{tahun}.jsonl.gz"


def unduh_tahun(tahun: int, folder: Path, lama: Berkas | None, *, bersyarat: bool = True,
                pembuka=urllib.request.urlopen, coba: int = 3, jeda: float = 2.0) -> Berkas | None:
    """Ambil satu tahun. None = registri tidak punya berkas tahun itu (404).

    Dengan `bersyarat`, ETag lama dikirim dan jawaban 304 berarti "tidak berubah": tidak ada yang diunduh.
    """
    tujuan = jalur_berkas(folder, tahun)
    kepala = {"User-Agent": AGEN}
    if bersyarat and lama and lama.etag:
        kepala["If-None-Match"] = lama.etag
    galat: Exception | None = None
    for ke in range(coba):
        try:
            with pembuka(urllib.request.Request(URL_UNDUH.format(tahun=tahun), headers=kepala), timeout=120) as resp:
                sementara = tujuan.with_suffix(".tmp")
                with open(sementara, "wb") as keluar:
                    while potong := resp.read(1 << 20):
                        keluar.write(potong)
                sementara.replace(tujuan)
                etag = resp.headers.get("ETag", "")
                return Berkas(
                    tahun=tahun,
                    etag=etag,
                    diubah=resp.headers.get("Last-Modified", ""),
                    ukuran=tujuan.stat().st_size,
                    dicek=_sekarang(),
                    berubah=not (lama and lama.etag and lama.etag == etag),
                )
        except urllib.error.HTTPError as e:
            if e.code == 304 and lama:
                return Berkas(**{**asdict(lama), "dicek": _sekarang(), "berubah": False})
            if e.code == 404:
                return None
            galat = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            galat = e
        time.sleep(jeda * (ke + 1))
    raise RuntimeError(f"Gagal mengunduh {tahun}: {galat}")


def cek(folder: Path, tahun_akhir: int, *, pembuka=urllib.request.urlopen) -> dict[int, Berkas]:
    """Tahap 1: tanyakan tiap tahun ke registri. Berkas yang ternyata baru langsung tersimpan."""
    folder.mkdir(parents=True, exist_ok=True)
    lama = baca_manifest(folder)
    baru: dict[int, Berkas] = {}
    for tahun in range(TAHUN_AWAL, tahun_akhir + 1):
        hasil = unduh_tahun(tahun, folder, lama.get(tahun), pembuka=pembuka)
        if hasil is not None:
            baru[tahun] = hasil
    tulis_manifest(folder, baru)
    return baru


def lengkapi(folder: Path, berkas: dict[int, Berkas], *, pembuka=urllib.request.urlopen) -> dict[int, Berkas]:
    """Tahap 2: pastikan semua berkas di manifest benar-benar ada di disk sebelum transform dijalankan."""
    for tahun, b in list(berkas.items()):
        if jalur_berkas(folder, tahun).exists():
            continue
        hasil = unduh_tahun(tahun, folder, b, bersyarat=False, pembuka=pembuka)
        if hasil is None:
            del berkas[tahun]
        else:
            hasil.berubah = b.berubah
            berkas[tahun] = hasil
    tulis_manifest(folder, berkas)
    return berkas
