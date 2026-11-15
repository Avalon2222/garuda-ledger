import { describe, expect, it } from "vitest";
import { buatIndeks, cari, ratakan, skor } from "@/lib/cari";
import { angka, lamaLalu, persen, potong, rapikanJudul, rupiah, rupiahPenuh, tahunDariHari, tanggal, waktuWib } from "@/lib/format";
import { saringAwal } from "@/lib/hitung";
import { dekati, keDunia, keLayar, kotakDari, paskan, zumDiTitik, K_MAKS, K_MIN } from "@/lib/kamera";
import { headerKeamanan, kebijakanKonten } from "@/lib/keamanan";
import { bitDariKunci, BIT_GANDA, kunciDariBit, POLA, polaDariBit, polaGanda } from "@/lib/pola";
import { dariHash, keHash } from "@/lib/url";
import { keCsv, KEPALA_CSV, namaBerkasAman, selCsv } from "@/lib/unduh";
import { alfa, campur, warnaPola } from "@/lib/warna";
import { ledgerAsli, ledgerMini, metaMini } from "./bantu";

describe("format", () => {
  it("rupiah ringkas gaya Indonesia", () => {
    expect(rupiah(298_340_938_119_149)).toBe("Rp 298,3 T");
    expect(rupiah(5_119_000_000_000)).toBe("Rp 5,12 T");
    expect(rupiah(45_600_000_000)).toBe("Rp 46 M");
    expect(rupiah(1_250_000_000)).toBe("Rp 1,3 M");
    expect(rupiah(733_431_500)).toBe("Rp 733 jt");
    expect(rupiah(1_540_000)).toBe("Rp 1,5 jt");
    expect(rupiah(10_950)).toBe("Rp 11 rb");
    expect(rupiah(500)).toBe("Rp 500");
    expect(rupiah(NaN)).toBe("–");
    expect(rupiahPenuh(733_431_500)).toBe("Rp 733.431.500");
  });

  it("angka dan persen", () => {
    expect(angka(44092)).toBe("44.092");
    expect(persen(0.991)).toBe("99,1%");
    expect(persen(0.1527, 0)).toBe("15%");
    expect(persen(NaN)).toBe("–");
  });

  it("hari sejak 2000 ke tanggal", () => {
    expect(tanggal(0)).toBe("1 Jan 2000");
    expect(tanggal(7279)).toBe("6 Des 2019");
    expect(tanggal(-1)).toBe("–");
    expect(tahunDariHari(7305)).toBe(2020);
    expect(tahunDariHari(7304)).toBe(2019);
    expect(tahunDariHari(-1)).toBe(0);
  });

  it("waktu WIB dan lama lalu", () => {
    expect(waktuWib("2026-11-15T01:09:30Z")).toBe("15 Nov 2026, 08.09 WIB");
    expect(waktuWib("2026-11-15T18:30:00Z")).toBe("16 Nov 2026, 01.30 WIB"); // lewat tengah malam WIB
    expect(waktuWib(undefined)).toBe("–");
    expect(waktuWib("bukan tanggal")).toBe("–");
    const kini = Date.parse("2026-11-15T12:00:00Z");
    expect(lamaLalu("2026-11-15T11:59:50Z", kini)).toBe("baru saja");
    expect(lamaLalu("2026-11-15T11:20:00Z", kini)).toBe("40 menit lalu");
    expect(lamaLalu("2026-11-15T07:00:00Z", kini)).toBe("5 jam lalu");
    expect(lamaLalu("2026-11-12T12:00:00Z", kini)).toBe("3 hari lalu");
    expect(lamaLalu("2026-11-16T12:00:00Z", kini)).toBe("baru saja"); // jam klien telat: jangan tampilkan angka minus
    expect(lamaLalu(undefined, kini)).toBe("–");
  });

  it("potong di batas kata", () => {
    expect(potong("pendek", 20)).toBe("pendek");
    expect(potong("Pengadaan kendaraan lidik sidik dan olah TKP", 24)).toBe("Pengadaan kendaraan…");
    expect(potong("Supercalifragilistic", 10)).toBe("Supercali…");
  });

  it("judul HURUF BESAR dirapikan, singkatan dan judul biasa dibiarkan", () => {
    expect(rapikanJudul("PENGADAAN ATK DENSUS 88 AT POLRI T.A. 2020")).toBe("Pengadaan ATK DENSUS 88 AT POLRI T.A. 2020");
    expect(rapikanJudul("PEMBANGUNAN RUMDIS PRAJURIT TNI AD (SBSN) TA 2021")).toBe("Pembangunan rumdis prajurit TNI AD (SBSN) TA 2021");
    expect(rapikanJudul("Ransum Jaga Mabes TNI")).toBe("Ransum Jaga Mabes TNI");
    expect(rapikanJudul("TNKB 2020")).toBe("TNKB 2020");
  });
});

describe("pola", () => {
  it("bit unik, pangkat dua, dan cocok dengan pipeline", () => {
    const bit = POLA.map((p) => p.bit);
    expect(new Set(bit).size).toBe(bit.length);
    for (const b of bit) expect(b & (b - 1)).toBe(0);
    expect(Object.fromEntries(POLA.map((p) => [p.kunci, p.bit]))).toEqual({
      mepet: 1, persis: 2, kilat: 4, beruntun: 8, langganan: 16, dominan: 32, debut: 64, lewat_hps: 128, ulang: 256, tunggal: 512,
    });
    // semua pola yang dilaporkan pipeline dikenal aplikasi
    for (const kunci of Object.keys(ledgerAsli().meta.dasar.porsi)) expect(POLA.some((p) => p.kunci === kunci), kunci).toBe(true);
  });

  it("konversi bit ↔ kunci", () => {
    expect(bitDariKunci(["mepet", "langganan", "ngawur"])).toBe(17);
    expect(kunciDariBit(17)).toEqual(["mepet", "langganan"]);
    expect(polaDariBit(0)).toEqual([]);
  });

  it("pola ganda: dua pola berbeda, persis tidak dihitung dobel", () => {
    expect(polaGanda(0)).toBe(false);
    expect(polaGanda(1 | 2)).toBe(false);
    expect(polaGanda(1 | 128 | 256)).toBe(false);
    expect(polaGanda(1 | 16)).toBe(true);
    expect(polaGanda(4 | 64 | 512)).toBe(true);
    expect(BIT_GANDA & 2).toBe(0);
  });

  it("tiap pola punya penjelasan berangka dan penjelasan wajar", () => {
    const m = metaMini();
    for (const p of POLA) {
      expect(p.jelaskan(m).length, p.kunci).toBeGreaterThan(20);
      expect(p.jelaskan(m)).not.toMatch(/undefined|NaN/);
      expect(p.wajar.length, p.kunci).toBeGreaterThan(20);
    }
    expect(POLA[0].jelaskan(m)).toContain("99,9%");
  });

  it("teks pola tidak memakai kata yang menuduh", () => {
    const semua = POLA.map((p) => `${p.label} ${p.ringkas} ${p.jelaskan(metaMini())} ${p.wajar}`).join(" ").toLowerCase();
    for (const kata of ["korupsi", "curang", "kolusi", "suap", "mark-up", "markup", "fiktif", "penipuan", "ilegal"]) expect(semua).not.toContain(kata);
  });
});

describe("kamera", () => {
  it("layar ↔ dunia saling membalik", () => {
    const c = { k: 1.7, tx: 120, ty: -40 };
    const [sx, sy] = keLayar(c, 33, -12);
    const [x, y] = keDunia(c, sx, sy);
    expect(x).toBeCloseTo(33);
    expect(y).toBeCloseTo(-12);
  });

  it("zoom menjaga titik di bawah kursor dan dibatasi", () => {
    const c = { k: 1, tx: 0, ty: 0 };
    const sebelum = keDunia(c, 200, 150);
    const z = zumDiTitik(c, 2, 200, 150);
    const sesudah = keDunia(z, 200, 150);
    expect(z.k).toBe(2);
    expect(sesudah[0]).toBeCloseTo(sebelum[0]);
    expect(sesudah[1]).toBeCloseTo(sebelum[1]);
    expect(zumDiTitik(c, 1000, 0, 0).k).toBe(K_MAKS);
    expect(zumDiTitik(c, 0.0001, 0, 0).k).toBe(K_MIN);
  });

  it("paskan memuat kotak di ruang yang tidak tertutup panel", () => {
    const kotak = kotakDari([{ x: -200, y: -100, r: 10 }, { x: 300, y: 150, r: 20 }, { r: 5 }])!;
    expect(kotak).toEqual({ x0: -210, y0: -110, x1: 320, y1: 170 });
    const tepi = { atas: 60, kanan: 20, bawah: 300, kiri: 20 };
    const c = paskan(kotak, 390, 844, tepi);
    for (const [x, y] of [[kotak.x0, kotak.y0], [kotak.x1, kotak.y1]]) {
      const [sx, sy] = keLayar(c, x, y);
      expect(sx).toBeGreaterThanOrEqual(tepi.kiri - 0.01);
      expect(sx).toBeLessThanOrEqual(390 - tepi.kanan + 0.01);
      expect(sy).toBeGreaterThanOrEqual(tepi.atas - 0.01);
      expect(sy).toBeLessThanOrEqual(844 - tepi.bawah + 0.01);
    }
    expect(kotakDari([])).toBeNull();
    // graf satu simpul tidak diperbesar tanpa batas
    expect(paskan({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1000, 800, { atas: 0, kanan: 0, bawah: 0, kiri: 0 }).k).toBe(1.6);
  });

  it("dekati sampai di sasaran dalam jumlah langkah terbatas", () => {
    const c = { k: 0.5, tx: 0, ty: 0 };
    const sasaran = { k: 1.5, tx: 300, ty: -200 };
    let langkah = 0;
    while (!dekati(c, sasaran) && langkah < 200) langkah++;
    expect(langkah).toBeLessThan(80);
    expect(c).toEqual(sasaran);
  });
});

describe("url", () => {
  const l = ledgerMini();

  it("tampilan awal tidak menulis hash", () => {
    expect(keHash(l, { pilih: null, fokus: null, saring: saringAwal(l), lensaPola: false })).toBe("");
  });

  it("keadaan lengkap bolak-balik", () => {
    const k = { pilih: "t:7", fokus: "v:4", saring: { tahun: [2021, 2022] as [number, number], instansi: [1], kategori: [0, 3], pola: 1 | 16 }, lensaPola: true };
    const hash = keHash(l, k);
    expect(hash).toBe("#sel=t%3A7&fokus=v%3A4&th=2021-2022&in=polri&kat=barang,konsultansi&pola=mepet,langganan&lensa=1");
    expect(dariHash(l, hash)).toEqual(k);
  });

  it("hash rusak atau di luar data diabaikan tanpa galat", () => {
    const awal = { pilih: null, fokus: null, saring: saringAwal(l), lensaPola: false };
    expect(dariHash(l, "")).toEqual(awal);
    expect(dariHash(l, "#sel=v:999&fokus=<img>&th=1999-2050&in=nasa&kat=roket&pola=jahat&lensa=ya")).toEqual(awal);
    expect(dariHash(l, "#th=2022-2020")).toEqual(awal);
    expect(dariHash(l, "#%E0%A4%A").pilih).toBeNull();
    expect(dariHash(l, "#sel=p:kop-ad").pilih).toBe("p:kop-ad");
  });
});

describe("cari", () => {
  const l = ledgerMini();
  const indeks = buatIndeks(l);

  it("meratakan tanda baca dan huruf besar", () => {
    expect(ratakan("PT. Alfa-Sentosa, Tbk")).toBe("pt alfa sentosa tbk");
    expect(skor("pt alfa sentosa", ["alfa"])).toBeGreaterThan(skor("pt malfasentosa", ["alfa"]));
    expect(skor("pt alfa sentosa", ["alfa", "beta"])).toBe(0);
  });

  it("menemukan vendor lewat nama, alias, dan potongan kata", () => {
    expect(cari(l, indeks, "alfa")[0]).toMatchObject({ id: "v:0", jenis: "vendor" });
    expect(cari(l, indeks, "SENTOSA, pt")[0].id).toBe("v:0"); // urutan kata bebas
    expect(cari(l, indeks, "primkopad")[0].id).toBe("v:3");
  });

  it("menemukan satker, unit, instansi, pemilik, dan paket", () => {
    expect(cari(l, indeks, "korlantas")[0]).toMatchObject({ id: "s:3", jenis: "satker" });
    expect(cari(l, indeks, "angkatan laut")[0].id).toBe("u:1");
    expect(cari(l, indeks, "polri").map((h) => h.id)).toContain("i:1");
    expect(cari(l, indeks, "persero")[0].id).toBe("p:induk");
    expect(cari(l, indeks, "nomor 7").map((h) => h.id)).toContain("t:7");
    expect(cari(l, indeks, "9004")[0]).toMatchObject({ id: "t:4", jenis: "tender" }); // kode tender
  });

  it("kueri terlalu pendek atau tanpa hasil", () => {
    expect(cari(l, indeks, "a")).toEqual([]);
    expect(cari(l, indeks, "   ")).toEqual([]);
    expect(cari(l, indeks, "zzzqqq")).toEqual([]);
  });

  it("di data asli: cepat, terbatas, dan pemain besar muncul duluan", () => {
    const asli = ledgerAsli();
    const ix = buatIndeks(asli);
    const mulai = performance.now();
    const hasil = cari(asli, ix, "karya");
    expect(performance.now() - mulai).toBeLessThan(400);
    expect(hasil.length).toBe(24);
    const vendor = hasil.filter((h) => h.jenis === "vendor").map((h) => Number(h.id.slice(2)));
    expect(vendor.length).toBeGreaterThan(5);
    expect(cari(asli, ix, "polda metro").some((h) => h.jenis === "unit")).toBe(true);
    expect(cari(asli, ix, "kemhan")[0].jenis).toBe("instansi");
  });
});

describe("unduh CSV", () => {
  const l = ledgerMini();

  it("sel dikutip kalau perlu dan awalan rumus dijinakkan", () => {
    expect(selCsv("biasa")).toBe("biasa");
    expect(selCsv('ada "kutip", koma')).toBe('"ada ""kutip"", koma"');
    expect(selCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(selCsv("+62")).toBe("'+62");
    expect(selCsv(-5)).toBe("-5"); // angka negatif bukan rumus
    expect(selCsv("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("baris tender jadi CSV dengan kepala yang tetap", () => {
    const [kepala, pertama, kedua] = keCsv(l, [0, 4]).split("\n");
    expect(kepala).toBe(KEPALA_CSV.join(","));
    expect(pertama).toBe("9000,PENGADAAN BARANG UJI NOMOR 0,Kemhan/TNI,TNI Angkatan Darat,Pusbekangad TNI AD,PT Alfa Sentosa,barang,100,100,1.0000,2020-01-01,2020-01-11,mepet|persis|langganan");
    expect(kedua.split(",").slice(-3)).toEqual(["2020-01-05", "2020-01-15", "ulang"]);
    expect(keCsv(l, []).split("\n")).toHaveLength(1);
  });

  it("nama berkas aman", () => {
    expect(namaBerkasAman("PT. Alfa Sentosa, Tbk")).toBe("pt-alfa-sentosa-tbk");
    expect(namaBerkasAman("../../etc/passwd")).toBe("etc-passwd");
    expect(namaBerkasAman("***")).toBe("paket");
  });
});

describe("warna dan keamanan", () => {
  it("alfa, campur, dan lensa pola", () => {
    expect(alfa("#ff8f3f", 0.5)).toBe("rgba(255, 143, 63, 0.5)");
    expect(campur("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(campur("#102030", "#405060", 0)).toBe("#102030");
    expect(campur("#102030", "#405060", 5)).toBe("#405060");
    expect(warnaPola(0)).toBe("#4a78b8");
    expect(warnaPola(0.5)).toBe("#ff8f3f");
    expect(warnaPola(1)).toBe("#ff5d5d");
  });

  it("CSP hanya membuka host yang memang dipakai", () => {
    const csp = kebijakanKonten(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://raw.githubusercontent.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\/\*/);
    expect(kebijakanKonten(true)).toContain("'unsafe-eval'");
    const kepala = Object.fromEntries(headerKeamanan().map((h) => [h.key, h.value]));
    expect(kepala["X-Content-Type-Options"]).toBe("nosniff");
    expect(kepala["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
