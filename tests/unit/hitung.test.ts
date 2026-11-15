import { describe, expect, it } from "vitest";
import { siapkan } from "@/lib/data";
import {
  barisInstansi,
  barisUnit,
  hhi,
  hitungPola,
  JARAK,
  labelHhi,
  median,
  peringkat,
  perTahunPenuh,
  profil,
  ringkas,
  saringAktif,
  saringAwal,
  vendorMilik,
} from "@/lib/hitung";
import { ledgerAsli, ledgerMini, mentahMini } from "./bantu";

describe("siapkan", () => {
  it("membangun indeks balik vendor dan satker", () => {
    const l = ledgerMini();
    expect(l.n).toBe(10);
    expect([...l.barisVendor[0]]).toEqual([0, 1, 5, 9]);
    expect([...l.barisSatker[3]]).toEqual([7, 8, 9]);
    expect([...l.instansiSatker]).toEqual([0, 0, 0, 1]);
    expect([...l.tahun]).toEqual([2020, 2021, 2021, 2022, 2020, 2022, 2022, 2021, 2022, 2022]);
  });

  it("menolak kolom yang panjangnya tidak sama", () => {
    const m = mentahMini();
    m.tender.nilai.pop();
    expect(() => siapkan(m)).toThrow(/nilai/);
  });
});

describe("ringkas", () => {
  const l = ledgerMini();

  it("tanpa filter: total, agregat per entitas, dan pasangan", () => {
    const r = ringkas(l, saringAwal(l));
    expect(r.n).toBe(10);
    expect(r.nilai).toBe(2660);
    expect(r.vendor.get(0)).toEqual({ n: 4, nilai: 780, nPola: 2 });
    expect(r.satker.get(3)).toEqual({ n: 3, nilai: 1580, nPola: 1 });
    expect(r.unit.get(0)?.nilai).toBe(670);
    expect(r.instansi.get(0)?.nilai).toBe(1080);
    expect(r.instansi.get(1)?.nilai).toBe(1580);
    expect(r.pasangan.get(0 * JARAK + 0)).toEqual({ n: 2, nilai: 300, nPola: 1 });
    expect(r.perTahun.get(2022)?.n).toBe(5);
    expect(r.perPola.mepet).toBe(3);
    expect(r.perPola.langganan).toBe(2);
  });

  it("pola ganda butuh dua pola berbeda; mepet+persis dihitung satu", () => {
    const r = ringkas(l, saringAwal(l));
    // baris 0 (mepet+langganan), 3 (mepet+kilat), 9 (beruntun+tunggal)
    expect([...r.vendor.values()].reduce((a, b) => a + b.nPola, 0)).toBe(3);
    expect(r.vendor.get(3)?.nPola).toBe(0);
  });

  it("filter tahun, instansi, kategori, dan pola saling memotong", () => {
    expect(ringkas(l, { ...saringAwal(l), tahun: [2022, 2022] }).n).toBe(5);
    expect(ringkas(l, { ...saringAwal(l), instansi: [1] }).nilai).toBe(1580);
    expect(ringkas(l, { ...saringAwal(l), kategori: [1] }).n).toBe(2);
    expect(ringkas(l, { ...saringAwal(l), pola: 16 }).n).toBe(2);
    expect(ringkas(l, { ...saringAwal(l), pola: 16 | 4 }).n).toBe(3); // salah satu bit cukup
    expect(ringkas(l, { tahun: [2022, 2022], instansi: [0], kategori: [0], pola: 0 }).nilai).toBe(400);
    expect(ringkas(l, { tahun: [2020, 2020], instansi: [1], kategori: [], pola: 0 }).n).toBe(0);
  });

  it("median rasio dihitung dari baris yang lolos saja", () => {
    const r = ringkas(l, { ...saringAwal(l), instansi: [1] });
    expect(r.medianRasio).toBeCloseTo(1000 / 1100, 6);
  });

  it("saringAktif mengenali filter bawaan", () => {
    expect(saringAktif(l, saringAwal(l))).toBe(false);
    expect(saringAktif(l, { ...saringAwal(l), tahun: [2021, 2022] })).toBe(true);
    expect(saringAktif(l, { ...saringAwal(l), pola: 1 })).toBe(true);
  });
});

describe("hitungan pendukung", () => {
  const l = ledgerMini();

  it("hitungPola mengabaikan filter pola tapi menghormati filter lain", () => {
    const semua = hitungPola(l, { ...saringAwal(l), pola: 16 });
    expect(semua.mepet).toBe(3);
    expect(hitungPola(l, { ...saringAwal(l), instansi: [1] }).mepet).toBe(0);
    expect(hitungPola(l, { ...saringAwal(l), instansi: [1] }).debut).toBe(1);
  });

  it("perTahunPenuh mengabaikan filter tahun supaya linimasa tetap utuh", () => {
    const t = perTahunPenuh(l, { ...saringAwal(l), tahun: [2022, 2022], instansi: [0] });
    expect([...t.keys()].sort()).toEqual([2020, 2021, 2022]);
    expect(t.get(2021)?.nilai).toBe(250);
  });

  it("peringkat mengurutkan dan memotong", () => {
    const r = ringkas(l, saringAwal(l));
    expect(peringkat(r.vendor, 2).map((x) => x.indeks)).toEqual([4, 0]);
    expect(peringkat(r.vendor, Infinity, "n")[0].indeks).toBe(0);
  });

  it("median, HHI, dan labelnya", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(hhi([])).toBe(0);
    expect(hhi([10])).toBe(1);
    expect(hhi([5, 5])).toBeCloseTo(0.5);
    expect(hhi([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBeCloseTo(0.1);
    expect([labelHhi(0.1), labelHhi(0.2), labelHhi(0.6)]).toEqual(["tersebar", "sedang", "terpusat"]);
  });
});

describe("profil", () => {
  const l = ledgerMini();

  it("vendor: mitra = satker, urut nilai, lengkap dengan pola dan rentang tahun", () => {
    const p = profil(l, saringAwal(l), l.barisVendor[0], "satker");
    expect(p.n).toBe(4);
    expect(p.nilai).toBe(780);
    expect([p.tahunAwal, p.tahunAkhir]).toEqual([2020, 2022]);
    expect(p.mitra.map((m) => [m.indeks, m.nilai])).toEqual([[2, 400], [0, 300], [3, 80]]);
    expect(p.perPola.langganan).toBe(2);
    expect(p.nPola).toBe(2);
    expect(p.medianJeda).toBe(10);
  });

  it("satker: mitra = vendor, mengikuti filter", () => {
    const p = profil(l, { ...saringAwal(l), tahun: [2022, 2022] }, l.barisSatker[3], "vendor");
    expect(p.baris).toEqual([8, 9]);
    expect(p.mitra.map((m) => m.indeks)).toEqual([4, 0]);
  });

  it("entitas tanpa paket di bawah filter menghasilkan profil kosong, bukan galat", () => {
    const p = profil(l, { ...saringAwal(l), tahun: [2020, 2020] }, l.barisVendor[4], "satker");
    expect(p).toMatchObject({ n: 0, nilai: 0, tahunAwal: 0, tahunAkhir: 0, medianRasio: null, medianJeda: null });
  });

  it("baris per unit dan instansi", () => {
    expect(barisUnit(l, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(barisInstansi(l, 1)).toEqual([7, 8, 9]);
  });

  it("vendorMilik menelusuri rantai pemilik ke bawah", () => {
    expect(vendorMilik(l, "induk")).toEqual([0]);
    expect(vendorMilik(l, "negara")).toEqual([0]); // lewat induk
    expect(vendorMilik(l, "kop-ad")).toEqual([3]);
    expect(vendorMilik(l, "tidak-ada")).toEqual([]);
  });
});

describe("data sungguhan", () => {
  const l = ledgerAsli();

  it("tabel fakta dan dimensi saling cocok", () => {
    expect(l.n).toBeGreaterThan(40_000);
    expect(l.vendor.length).toBeGreaterThan(10_000);
    expect(Math.max(...l.satkerDari)).toBeLessThan(l.satker.length);
    expect(Math.max(...l.vendorDari)).toBeLessThan(l.vendor.length);
    expect(l.satker.length).toBeLessThan(JARAK); // kunci pasangan vendor*JARAK+satker tidak boleh bertabrakan
    for (const s of l.satker) expect(s.unit).toBeLessThan(l.unit.length);
    for (const u of l.unit) expect(u.instansi).toBeLessThan(l.instansi.length);
  });

  it("vendor diurutkan dari nilai terbesar, jadi indeks = peringkat", () => {
    const r = ringkas(l, saringAwal(l));
    const urut = peringkat(r.vendor, 50).map((x) => x.indeks);
    expect(urut.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(r.n).toBe(l.n);
    expect(r.vendor.size).toBe(l.vendor.length);
  });

  it("porsi pola di meta sama dengan hitungan ulang di browser", () => {
    const r = ringkas(l, saringAwal(l));
    for (const [kunci, porsi] of Object.entries(l.meta.dasar.porsi)) {
      expect(r.perPola[kunci] / l.n, kunci).toBeCloseTo(porsi, 3);
    }
    const ganda = [...r.vendor.values()].reduce((a, b) => a + b.nPola, 0) / l.n;
    expect(ganda).toBeCloseTo(l.meta.dasar.porsi_ganda, 3);
    expect(r.medianRasio).toBeCloseTo(l.meta.dasar.median_rasio ?? 0, 3);
  });

  it("semua tanggal menang ada di dalam rentang meta dan tidak ada nilai nol", () => {
    const [dari, sampai] = l.meta.rentang;
    for (let i = 0; i < l.n; i += 97) {
      expect(l.tahun[i]).toBeGreaterThanOrEqual(dari);
      expect(l.tahun[i]).toBeLessThanOrEqual(sampai);
      expect(l.nilai[i]).toBeGreaterThan(0);
    }
  });

  it("tiap relasi kepemilikan menunjuk vendor dan pemilik yang ada", () => {
    const id = new Set(l.pemilik.map((p) => p.id));
    expect(l.kepemilikan.length).toBeGreaterThan(10);
    for (const [dari, ke] of l.kepemilikan) {
      expect(id.has(ke)).toBe(true);
      if (typeof dari === "number") expect(dari).toBeLessThan(l.vendor.length);
      else expect(id.has(dari.slice(2))).toBe(true);
    }
  });
});
