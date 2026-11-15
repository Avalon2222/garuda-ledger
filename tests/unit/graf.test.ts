import { describe, expect, it } from "vitest";
import { aturUkuran, grafFokus, grafIkhtisar, idSah, idSimpul, labelSimpul, perluas, tetangga, uraiId, type Graf } from "@/lib/graf";
import { ringkas, saringAwal } from "@/lib/hitung";
import { acak, Tata, tempatkan } from "@/lib/tata";
import { ledgerAsli, ledgerMini } from "./bantu";

function utuh(g: Graf): void {
  const id = new Set(g.simpul.map((s) => s.id));
  expect(id.size).toBe(g.simpul.length); // tidak ada simpul kembar
  expect(new Set(g.sisi.map((e) => e.id)).size).toBe(g.sisi.length);
  for (const e of g.sisi) {
    expect(id.has(e.source), `${e.id} source`).toBe(true);
    expect(id.has(e.target), `${e.id} target`).toBe(true);
  }
  for (const s of g.simpul) expect(s.r).toBeGreaterThan(0);
}

describe("id simpul", () => {
  const l = ledgerMini();

  it("urai dan rangkai bolak-balik", () => {
    expect(uraiId(idSimpul("vendor", 12))).toEqual({ jenis: "vendor", indeks: 12, kunci: "12" });
    expect(uraiId("p:kop-ad")).toEqual({ jenis: "pemilik", indeks: -1, kunci: "kop-ad" });
    expect(uraiId("x:1")).toBeNull();
    expect(uraiId("v:-1")).toBeNull();
    expect(uraiId("v:1.5")).toBeNull();
    expect(uraiId("v:abc")).toBeNull();
  });

  it("idSah menolak indeks di luar data (tautan basi atau diutak-atik)", () => {
    expect(idSah(l, "v:4")).toBe(true);
    expect(idSah(l, "v:5")).toBe(false);
    expect(idSah(l, "s:3")).toBe(true);
    expect(idSah(l, "t:9")).toBe(true);
    expect(idSah(l, "t:10")).toBe(false);
    expect(idSah(l, "p:negara")).toBe(true);
    expect(idSah(l, "p:siapa")).toBe(false);
    expect(idSah(l, "<script>")).toBe(false);
  });

  it("label tiap jenis", () => {
    expect(labelSimpul(l, "v:0")).toBe("PT Alfa Sentosa");
    expect(labelSimpul(l, "i:1")).toBe("Polri");
    expect(labelSimpul(l, "p:induk")).toBe("PT Induk (Persero)");
    expect(labelSimpul(l, "t:0")).toBe("Pengadaan barang UJI nomor 0"); // kata tiga huruf dianggap singkatan
  });
});

describe("grafIkhtisar", () => {
  const l = ledgerMini();
  const r = ringkas(l, saringAwal(l));

  it("memuat vendor terbesar, satkernya, hierarki, dan pemilik", () => {
    const g = grafIkhtisar(l, r, { umum: 2, perInstansi: 0, satkerPerVendor: 1 });
    utuh(g);
    const id = new Set(g.simpul.map((s) => s.id));
    expect(id.has("v:4") && id.has("v:0")).toBe(true);
    expect(id.has("v:2")).toBe(false);
    // vendor 0: satker terbesarnya satker 2 (400), plus satker 3 karena sudah tampil lewat vendor 4
    expect(g.sisi.some((e) => e.id === "v:0>s:2" && e.jenis === "menang" && e.nilai === 400 && e.n === 1)).toBe(true);
    expect(g.sisi.some((e) => e.id === "v:0>s:3")).toBe(true);
    expect(g.sisi.some((e) => e.id === "v:0>s:0")).toBe(false);
    // hierarki instansi -> unit -> satker dan rantai pemilik vendor 0
    expect(g.sisi.some((e) => e.id === "i:0>u:1" && e.jenis === "hierarki")).toBe(true);
    expect(g.sisi.some((e) => e.id === "u:1>s:2")).toBe(true);
    expect(g.sisi.some((e) => e.id === "v:0>p:induk" && e.jenis === "milik")).toBe(true);
    expect(g.sisi.some((e) => e.id === "p:induk>p:negara")).toBe(true);
    // semua instansi yang punya paket ikut tampil
    expect(id.has("i:0") && id.has("i:1")).toBe(true);
  });

  it("kuota per instansi mengangkat vendor yang kalah besar di tingkat sektor", () => {
    const g = grafIkhtisar(l, r, { umum: 1, perInstansi: 1, satkerPerVendor: 1 });
    const vendor = g.simpul.filter((s) => s.jenis === "vendor").map((s) => s.id).sort();
    expect(vendor).toEqual(["v:0", "v:4"]); // v:4 juara sektor dan Polri, v:0 juara Kemhan/TNI
  });

  it("filter yang mengosongkan data menghasilkan graf kosong", () => {
    const kosong = ringkas(l, { tahun: [2020, 2020], instansi: [1], kategori: [], pola: 0 });
    expect(grafIkhtisar(l, kosong).simpul).toEqual([]);
  });

  it("porsi pola ganda dan nilai simpul datang dari ringkasan", () => {
    const g = grafIkhtisar(l, r, { umum: 5, perInstansi: 0, satkerPerVendor: 3 });
    const v0 = g.simpul.find((s) => s.id === "v:0")!;
    expect(v0).toMatchObject({ nilai: 780, n: 4, porsiPola: 0.5, label: "PT Alfa Sentosa" });
  });
});

describe("grafFokus", () => {
  const l = ledgerMini();
  const s = saringAwal(l);
  const r = ringkas(l, s);

  it("vendor: semua satkernya, tetangga redup, paket terbesar, pemilik", () => {
    const g = grafFokus(l, r, s, "v:0")!;
    utuh(g);
    const peta = new Map(g.simpul.map((x) => [x.id, x]));
    expect(peta.get("v:0")?.utama).toBe(true);
    for (const sat of ["s:0", "s:2", "s:3"]) expect(peta.has(sat)).toBe(true);
    expect(peta.get("v:4")?.redup).toBe(true); // menang di satker 3 juga
    expect(peta.get("v:1")?.redup).toBe(true);
    expect(peta.has("t:5")).toBe(true); // paket terbesar vendor 0
    expect(g.sisi.some((e) => e.id === "v:0>t:5" && e.jenis === "paket")).toBe(true);
    expect(g.sisi.some((e) => e.id === "t:5>s:2")).toBe(true);
    expect(peta.has("p:induk") && peta.has("p:negara")).toBe(true);
  });

  it("satker: vendor pemenangnya", () => {
    const g = grafFokus(l, r, s, "s:3")!;
    utuh(g);
    const id = new Set(g.simpul.map((x) => x.id));
    expect(id.has("v:4") && id.has("v:0") && id.has("u:2") && id.has("i:1")).toBe(true);
    expect(g.simpul.find((x) => x.id === "s:3")?.utama).toBe(true);
  });

  it("unit, instansi, pemilik, dan paket punya tampilan fokus sendiri", () => {
    for (const id of ["u:0", "i:0", "p:induk", "p:kop-ad", "t:7"]) {
      const g = grafFokus(l, r, s, id);
      expect(g, id).not.toBeNull();
      utuh(g!);
      expect(g!.simpul.some((x) => x.id === id && x.utama), id).toBe(true);
    }
    const paket = grafFokus(l, r, s, "t:7")!;
    expect(new Set(paket.simpul.map((x) => x.id)).has("v:4")).toBe(true);
    const pemilik = grafFokus(l, r, s, "p:negara")!;
    expect(new Set(pemilik.simpul.map((x) => x.id)).has("v:0")).toBe(true);
  });

  it("id yang tidak sah mengembalikan null", () => {
    expect(grafFokus(l, r, s, "v:99")).toBeNull();
    expect(grafFokus(l, r, s, "ngawur")).toBeNull();
  });
});

describe("perluas", () => {
  const l = ledgerMini();
  const s = saringAwal(l);
  const r = ringkas(l, s);

  it("menambah tetangga tanpa membuang atau menggandakan simpul lama, posisi lama bertahan", () => {
    const awal = grafFokus(l, r, s, "s:1")!;
    awal.simpul.forEach((x, i) => { x.x = i * 10; x.y = i * 5; });
    const lebih = perluas(l, r, s, awal, "v:1");
    utuh(lebih);
    const id = new Set(lebih.simpul.map((x) => x.id));
    for (const x of awal.simpul) expect(id.has(x.id)).toBe(true);
    expect(id.has("s:0")).toBe(true); // satker lain milik vendor 1
    const lama = lebih.simpul.find((x) => x.id === "s:1")!;
    expect(lama.x).toBe(awal.simpul.find((x) => x.id === "s:1")!.x);
    expect(perluas(l, r, s, lebih, "v:1").simpul.length).toBe(lebih.simpul.length); // idempoten
  });

  it("paket yang belum tampil masuk bersama vendor dan satkernya", () => {
    const g = perluas(l, r, s, grafIkhtisar(l, r, { umum: 1, perInstansi: 0, satkerPerVendor: 1 }), "t:4");
    utuh(g);
    const id = new Set(g.simpul.map((x) => x.id));
    expect(id.has("t:4") && id.has("v:2") && id.has("s:1")).toBe(true);
  });

  it("vendor yang naik dari tetangga redup jadi simpul biasa", () => {
    const g = grafFokus(l, r, s, "v:0")!;
    expect(g.simpul.find((x) => x.id === "v:4")?.redup).toBe(true);
    const lebih = perluas(l, r, s, g, "s:3");
    expect(lebih.simpul.find((x) => x.id === "v:4")?.redup).toBe(false);
  });
});

describe("ukuran, tetangga, tata letak", () => {
  it("jari-jari naik bersama nilai dan tetap di rentang jenisnya", () => {
    const g: Graf = {
      simpul: [
        { id: "v:0", jenis: "vendor", label: "a", nilai: 100, n: 1, porsiPola: 0, r: 0 },
        { id: "v:1", jenis: "vendor", label: "b", nilai: 25, n: 1, porsiPola: 0, r: 0 },
        { id: "v:2", jenis: "vendor", label: "c", nilai: 0, n: 0, porsiPola: 0, r: 0 },
      ],
      sisi: [],
    };
    aturUkuran(g);
    const [a, b, c] = g.simpul.map((x) => x.r);
    expect(a).toBe(20);
    expect(c).toBe(6);
    expect(b).toBeCloseTo(13); // akar(0,25) = setengah jalan
  });

  it("tetangga dua arah", () => {
    const l = ledgerMini();
    const s = saringAwal(l);
    const g = grafFokus(l, ringkas(l, s), s, "s:3")!;
    const t = tetangga(g);
    expect(t.get("s:3")?.has("v:4")).toBe(true);
    expect(t.get("v:4")?.has("s:3")).toBe(true);
  });

  it("penempatan awal deterministik dan simulasi menghasilkan posisi berhingga tanpa tumpang tindih parah", () => {
    const l = ledgerAsli();
    const s = saringAwal(l);
    const r = ringkas(l, s);
    const a = grafIkhtisar(l, r);
    const b = grafIkhtisar(l, r);
    utuh(a);
    expect(a.simpul.length).toBeGreaterThan(60);
    expect(a.simpul.length).toBeLessThan(260);
    tempatkan(a, acak(7));
    tempatkan(b, acak(7));
    expect(a.simpul.map((x) => [x.x, x.y])).toEqual(b.simpul.map((x) => [x.x, x.y]));

    const tata = new Tata(() => {});
    tata.pasang(a, 200);
    tata.hentikan();
    for (const x of a.simpul) {
      expect(Number.isFinite(x.x) && Number.isFinite(x.y), x.id).toBe(true);
    }
    let tindih = 0;
    for (let i = 0; i < a.simpul.length; i++) {
      for (let j = i + 1; j < a.simpul.length; j++) {
        const p = a.simpul[i];
        const q = a.simpul[j];
        if (Math.hypot(p.x! - q.x!, p.y! - q.y!) < (p.r + q.r) * 0.8) tindih++;
      }
    }
    expect(tindih).toBeLessThan(4);
  });

  it("simpul baru ditempatkan dekat tetangganya yang sudah berposisi", () => {
    const g: Graf = {
      simpul: [
        { id: "s:0", jenis: "satker", label: "a", nilai: 1, n: 1, porsiPola: 0, r: 8, x: 500, y: -300 },
        { id: "v:0", jenis: "vendor", label: "b", nilai: 1, n: 1, porsiPola: 0, r: 8 },
      ],
      sisi: [{ id: "v:0>s:0", source: "v:0", target: "s:0", jenis: "menang", nilai: 1, n: 1 }],
    };
    tempatkan(g);
    const v = g.simpul[1];
    expect(Math.hypot(v.x! - 500, v.y! + 300)).toBeLessThanOrEqual(80);
    expect(g.simpul[0].x).toBe(500); // simpul lama tidak digeser
  });

  it("fokus pada vendor terbesar di data asli tetap berukuran wajar", () => {
    const l = ledgerAsli();
    const s = saringAwal(l);
    const g = grafFokus(l, ringkas(l, s), s, "v:0")!;
    utuh(g);
    expect(g.simpul.length).toBeLessThan(140);
    expect(g.simpul.filter((x) => x.jenis === "tender").length).toBe(8);
  });
});
