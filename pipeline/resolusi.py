"""Transform tahap 2: entity resolution untuk penyedia.

Masalahnya: SPSE tidak punya satu ID penyedia nasional di data lama. "PT. PANCA PRIMA", "PANCA PRIMA, PT" dan
"pt.panca prima" adalah satu perusahaan dengan tiga ejaan dan sering tiga ID berbeda (satu per LPSE).

Pendekatannya sengaja konservatif (lebih baik dua simpul untuk satu perusahaan daripada satu simpul untuk dua
perusahaan). Dua catatan digabung hanya kalau ada salah satu bukti ini:

  1. `id`        ID penyedia sama persis.
  2. `nama_pt`   Nama inti sama dan keduanya PT. Nama PT unik secara nasional (didaftarkan di Kemenkumham).
  3. `nama_lpse` Nama inti sama dan terdaftar di LPSE yang sama. Dipakai untuk CV/UD/koperasi dan nama tanpa
                 bentuk usaha, karena nama CV tidak unik secara nasional: "CV Karya Baru" di Aceh dan di Papua
                 hampir pasti dua usaha berbeda.

Kemiripan ejaan (fuzzy) tidak pernah menggabungkan apa pun. Pasangan yang mirip hanya dihitung sebagai
"kandidat duplikat" di laporan kualitas.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

# bentuk usaha yang dikenali, dari awalan atau akhiran nama
_BENTUK = {
    "PT": "PT", "PERSEROAN TERBATAS": "PT",
    "CV": "CV", "COMMANDITAIRE VENNOOTSCHAP": "CV",
    "UD": "UD", "PD": "PD", "FA": "Firma", "FIRMA": "Firma",
    "YAYASAN": "Yayasan", "PERUM": "Perum", "PERUMDA": "Perum", "KSO": "KSO",
}
# "Koperasi" sengaja tidak dipotong dari nama: "Primer Koperasi Kartika X" kehilangan arti tanpa kata itu
_AWALAN = re.compile(r"^(PERSEROAN TERBATAS|COMMANDITAIRE VENNOOTSCHAP|PERUMDA|YAYASAN|FIRMA|PERUM|KSO|PT|CV|UD|PD|FA)\b[\s.,]*", re.I)
_AKHIRAN = re.compile(r"[\s,.]+(PT|CV|UD|PD|FA)\.?$", re.I)
# awalan yang menempel tanpa spasi atau titik: "PT.PANCA", "CV.SUN", "pt.vita"
_AWALAN_TEMPEL = re.compile(r"^(PT|CV|UD|PD|FA)\.(?=\S)", re.I)
_KOPERASI_MILITER = re.compile(r"\b(PRIMKOP|INKOP|PUSKOP)\w*", re.I)
_KOPERASI_LAIN = re.compile(r"\b(KOPERASI|KSU|KUD|KPRI)\b", re.I)
_TBK = re.compile(r"[\s,.(]*\bTBK\b[.)]*", re.I)
_PERSERO = re.compile(r"\(?\bPERSERO\b\)?", re.I)
_BUKAN_ALNUM = re.compile(r"[^A-Z0-9]+")


@dataclass(frozen=True)
class NamaBersih:
    inti: str      # nama tanpa bentuk usaha, huruf besar, satu spasi
    bentuk: str    # PT | CV | UD | ... | "" kalau tidak tertulis
    kunci: str     # inti tanpa spasi, untuk membandingkan "LA NTERA" dengan "LANTERA"


def bersihkan_nama(mentah: str) -> NamaBersih:
    """Pisahkan bentuk usaha dari nama dan seragamkan ejaannya."""
    teks = re.sub(r"\s+", " ", (mentah or "").strip().upper())
    teks = _TBK.sub(" ", teks)
    teks = _PERSERO.sub(" ", teks).strip(" ,.")
    bentuk = ""
    teks = _AWALAN_TEMPEL.sub(lambda m: m.group(1) + ". ", teks)
    m = _AWALAN.match(teks)
    if m and len(teks) > m.end():
        bentuk = _BENTUK[re.sub(r"\s+", " ", m.group(1).upper())]
        teks = teks[m.end():]
    else:
        m = _AKHIRAN.search(teks)
        if m:
            bentuk = _BENTUK[m.group(1).upper()]
            teks = teks[: m.start()]
    if not bentuk and (_KOPERASI_MILITER.search(teks) or _KOPERASI_LAIN.search(teks)):
        bentuk = "Koperasi"
    inti = _BUKAN_ALNUM.sub(" ", teks).strip()
    return NamaBersih(inti=inti, bentuk=bentuk, kunci=inti.replace(" ", ""))


_KECIL = {"DAN", "DI", "DE", "VAN"}
_SINGKATAN = re.compile(r"^(?:[B-DF-HJ-NP-TV-Z]{2,4}|[A-Z]{1,3}\d+|\d+[A-Z]*|II|III|IV|VI|VII|VIII|IX)$")


def nama_tampil(inti: str, bentuk: str) -> str:
    """Nama untuk ditampilkan: 'PT Panca Prima Maju Bersama', singkatan tetap huruf besar."""
    kata = []
    for k in inti.split():
        if k in _KECIL:
            kata.append(k.lower())
        elif _SINGKATAN.match(k) or len(k) <= 2:
            kata.append(k)
        else:
            kata.append(k.capitalize())
    badan = " ".join(kata)
    if bentuk in ("PT", "CV", "UD", "PD", "Firma", "Perum", "Yayasan", "KSO") and badan:
        return f"{bentuk} {badan}"
    return badan or inti


class GabungCari:
    """Union-find dengan kompresi jalur."""

    def __init__(self) -> None:
        self.induk: dict[str, str] = {}

    def cari(self, x: str) -> str:
        self.induk.setdefault(x, x)
        akar = x
        while self.induk[akar] != akar:
            akar = self.induk[akar]
        while self.induk[x] != akar:
            self.induk[x], x = akar, self.induk[x]
        return akar

    def gabung(self, a: str, b: str) -> bool:
        ra, rb = self.cari(a), self.cari(b)
        if ra == rb:
            return False
        if rb < ra:
            ra, rb = rb, ra
        self.induk[rb] = ra
        return True


@dataclass
class Vendor:
    id: str
    nama: str
    bentuk: str
    alias: list[str] = field(default_factory=list)   # ejaan lain yang dipakai di sumber
    id_sumber: list[str] = field(default_factory=list)
    bukti: list[str] = field(default_factory=list)   # aturan yang menyatukan kelompok ini


@dataclass
class HasilResolusi:
    vendor: dict[str, Vendor]
    peta: dict[tuple[str, str, str], str]            # (id_penyedia, nama mentah, lpse) -> id vendor
    statistik: dict[str, int]


def _bentuk_cocok(a: str, b: str) -> bool:
    return a == b or not a or not b


def selesaikan(catatan: list[tuple[str, str, str]]) -> HasilResolusi:
    """Kelompokkan catatan penyedia (id_penyedia, nama mentah, lpse) menjadi vendor."""
    bersih = {c: bersihkan_nama(c[1]) for c in set(catatan)}
    simpul = {c: f"{c[0]}|{c[2]}|{b.kunci}|{b.bentuk}" for c, b in bersih.items()}
    uf = GabungCari()
    aturan: dict[str, set[str]] = defaultdict(set)
    hitung = Counter()

    def satukan(a: str, b: str, nama_aturan: str) -> None:
        if uf.gabung(a, b):
            hitung[nama_aturan] += 1
        aturan[a].add(nama_aturan)
        aturan[b].add(nama_aturan)

    for s in simpul.values():
        uf.cari(s)

    # 1. ID penyedia sama. ID kosong atau jelas placeholder tidak dipakai.
    per_id: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for c in bersih:
        if c[0] and c[0] not in ("0", "-", "0-1"):
            per_id[c[0]].append(c)
    for anggota in per_id.values():
        # ID yang dipakai banyak nama inti berbeda berarti ID-nya tidak bisa dipercaya (didaur ulang antar LPSE)
        if len({bersih[c].kunci for c in anggota}) > 1:
            hitung["id_bentrok_nama"] += 1
            continue
        for c in anggota[1:]:
            satukan(simpul[anggota[0]], simpul[c], "id")

    # 2. PT dengan nama inti sama: gabung nasional
    per_pt: dict[str, list] = defaultdict(list)
    for c, b in bersih.items():
        if b.bentuk == "PT" and len(b.kunci) >= 4:
            per_pt[b.kunci].append(c)
    for anggota in per_pt.values():
        for c in anggota[1:]:
            satukan(simpul[anggota[0]], simpul[c], "nama_pt")

    # 3. Nama inti sama di LPSE yang sama, bentuk usaha tidak bertentangan
    per_lpse: dict[tuple[str, str], list] = defaultdict(list)
    for c, b in bersih.items():
        if len(b.kunci) >= 4:
            per_lpse[(c[2], b.kunci)].append(c)
    for anggota in per_lpse.values():
        bentuk_ada = {bersih[c].bentuk for c in anggota if bersih[c].bentuk}
        if len(bentuk_ada) > 1:
            # "PT X" dan "CV X" di LPSE yang sama: gabung per bentuk saja, yang tanpa bentuk dibiarkan sendiri
            hitung["bentuk_bentrok"] += 1
            for bentuk in bentuk_ada:
                sama = [c for c in anggota if bersih[c].bentuk == bentuk]
                for c in sama[1:]:
                    satukan(simpul[sama[0]], simpul[c], "nama_lpse")
            continue
        for c in anggota[1:]:
            satukan(simpul[anggota[0]], simpul[c], "nama_lpse")

    # susun vendor per kelompok
    kelompok: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for c in bersih:
        kelompok[uf.cari(simpul[c])].append(c)
    kemunculan = Counter(catatan)
    vendor: dict[str, Vendor] = {}
    peta: dict[tuple[str, str, str], str] = {}
    urut = sorted(kelompok.items(), key=lambda kv: (min(bersih[c].kunci for c in kv[1]), kv[0]))
    for nomor, (akar, anggota) in enumerate(urut, start=1):
        vid = f"v{nomor}"
        bentuk = Counter(bersih[c].bentuk for c in anggota for _ in range(kemunculan[c]) if bersih[c].bentuk)
        inti = Counter()
        for c in anggota:
            inti[bersih[c].inti] += kemunculan[c]
        bentuk_utama = bentuk.most_common(1)[0][0] if bentuk else ""
        nama = nama_tampil(inti.most_common(1)[0][0], bentuk_utama)
        ejaan = Counter()
        for c in anggota:
            ejaan[c[1]] += kemunculan[c]
        bukti = sorted({a for c in anggota for a in aturan.get(simpul[c], ())})
        vendor[vid] = Vendor(
            id=vid,
            nama=nama,
            bentuk=bentuk_utama,
            alias=[e for e, _ in ejaan.most_common() if e != nama][:8],
            id_sumber=sorted({c[0] for c in anggota if c[0]})[:12],
            bukti=bukti,
        )
        for c in anggota:
            peta[c] = vid

    statistik = {
        "catatan_unik": len(bersih),
        "vendor": len(vendor),
        "digabung": len(bersih) - len(vendor),
        "gabung_id": hitung["id"],
        "gabung_nama_pt": hitung["nama_pt"],
        "gabung_nama_lpse": hitung["nama_lpse"],
        "id_bentrok_nama": hitung["id_bentrok_nama"],
        "bentuk_bentrok": hitung["bentuk_bentrok"],
        "kandidat_mirip": hitung_kandidat_mirip([bersih[kv[1][0]] for kv in urut]),
    }
    return HasilResolusi(vendor=vendor, peta=peta, statistik=statistik)


def jarak_sunting_maks1(a: str, b: str) -> bool:
    """True kalau a dan b berbeda paling banyak satu sisip/hapus/ganti huruf."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la > lb:
        a, b, la, lb = b, a, lb, la
    i = 0
    while i < la and a[i] == b[i]:
        i += 1
    if la == lb:
        return a[i + 1:] == b[i + 1:]
    return a[i:] == b[i + 1:]


def hitung_kandidat_mirip(nama: list[NamaBersih]) -> int:
    """Banyaknya pasangan vendor yang namanya hanya beda satu huruf (panjang >= 10). Tidak digabung, hanya dilaporkan."""
    ember: dict[tuple[str, str], list[str]] = defaultdict(list)
    for n in nama:
        if len(n.kunci) >= 10:
            # satu suntingan cuma bisa merusak salah satu ujung: 5 huruf depan atau 5 huruf belakang pasti sama
            ember[("d", n.kunci[:5])].append(n.kunci)
            ember[("b", n.kunci[-5:])].append(n.kunci)
    pasangan: set[tuple[str, str]] = set()
    for isi in ember.values():
        if len(isi) > 200:
            continue
        for i, a in enumerate(isi):
            for b in isi[i + 1:]:
                if a != b and jarak_sunting_maks1(a, b):
                    pasangan.add((a, b) if a < b else (b, a))
    return len(pasangan)
