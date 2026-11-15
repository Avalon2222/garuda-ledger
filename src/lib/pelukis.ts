import { tetangga, type Graf, type Jenis, type Simpul } from "./graf";
import { dekati, keDunia, keLayar, kotakDari, paskan, zumDiTitik, type Kamera, type Tepi } from "./kamera";
import { potong } from "./format";
import { alfa, WARNA, WARNA_JENIS, warnaPola } from "./warna";

const DUA_PI = Math.PI * 2;
const FON = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** Bentuk kecil di tengah simpul, satu per jenis, supaya jenis terbaca tanpa bergantung pada warna saja. */
function glif(c: CanvasRenderingContext2D, jenis: Jenis, x: number, y: number, s: number): void {
  c.beginPath();
  switch (jenis) {
    case "vendor": // gedung
      c.rect(x - s * 0.55, y - s * 0.6, s * 1.1, s * 1.2);
      break;
    case "satker": // perisai
      c.moveTo(x - s * 0.6, y - s * 0.6);
      c.lineTo(x + s * 0.6, y - s * 0.6);
      c.lineTo(x + s * 0.6, y + s * 0.05);
      c.lineTo(x, y + s * 0.75);
      c.lineTo(x - s * 0.6, y + s * 0.05);
      c.closePath();
      break;
    case "unit": // belah ketupat
      c.moveTo(x, y - s * 0.75);
      c.lineTo(x + s * 0.75, y);
      c.lineTo(x, y + s * 0.75);
      c.lineTo(x - s * 0.75, y);
      c.closePath();
      break;
    case "instansi": // bintang lima
      for (let i = 0; i < 10; i++) {
        const sudut = -Math.PI / 2 + (i * Math.PI) / 5;
        const jari = i % 2 === 0 ? s * 0.85 : s * 0.38;
        c[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(sudut) * jari, y + Math.sin(sudut) * jari);
      }
      c.closePath();
      break;
    case "pemilik": // segitiga
      c.moveTo(x, y - s * 0.75);
      c.lineTo(x + s * 0.72, y + s * 0.55);
      c.lineTo(x - s * 0.72, y + s * 0.55);
      c.closePath();
      break;
    case "tender":
      c.arc(x, y, s * 0.45, 0, DUA_PI);
      break;
  }
  c.fill();
}

export interface OpsiLukis {
  lensaPola: boolean;
  /** gerak dikurangi (prefers-reduced-motion): tanpa titik berjalan dan tanpa animasi kamera */
  tenang: boolean;
}

/** Menggambar graf ke kanvas 2D dan mengurus kamera. Tidak tahu apa-apa soal React. */
export class Pelukis {
  private c: CanvasRenderingContext2D;
  private graf: Graf = { simpul: [], sisi: [] };
  private peta = new Map<string, Simpul>();
  private kawan = new Map<string, Set<string>>();
  private lebar = 300;
  private tinggi = 300;
  private dpr = 1;
  private sasaran: Kamera | null = null;
  private bingkai = 0;
  private diminta = false;
  kamera: Kamera = { k: 1, tx: 150, ty: 150 };
  pilih: string | null = null;
  hover: string | null = null;
  opsi: OpsiLukis = { lensaPola: false, tenang: false };
  tepi: Tepi = { atas: 16, kanan: 16, bawah: 16, kiri: 16 };
  /** dipanggil tiap bingkai; mengembalikan true selama simulasi masih bergerak */
  masihGerak: () => boolean = () => false;

  constructor(private kanvas: HTMLCanvasElement) {
    const c = kanvas.getContext("2d");
    if (!c) throw new Error("Canvas 2D tidak tersedia");
    this.c = c;
  }

  atur(graf: Graf): void {
    this.graf = graf;
    this.peta = new Map(graf.simpul.map((s) => [s.id, s]));
    this.kawan = tetangga(graf);
    if (this.hover && !this.peta.has(this.hover)) this.hover = null;
    this.minta();
  }

  ukuran(lebar: number, tinggi: number, dpr: number): void {
    this.lebar = lebar;
    this.tinggi = tinggi;
    this.dpr = dpr;
    this.kanvas.width = Math.round(lebar * dpr);
    this.kanvas.height = Math.round(tinggi * dpr);
    this.minta();
  }

  minta(): void {
    if (this.diminta) return;
    this.diminta = true;
    this.bingkai = requestAnimationFrame((t) => {
      this.diminta = false;
      const kameraJalan = this.sasaran ? !dekati(this.kamera, this.sasaran) : false;
      if (!kameraJalan) this.sasaran = null;
      this.lukis(t);
      const adaAliran = this.pilih !== null && !this.opsi.tenang && this.peta.has(this.pilih) && document.visibilityState === "visible";
      if (kameraJalan || this.masihGerak() || adaAliran) this.minta();
    });
  }

  hancurkan(): void {
    cancelAnimationFrame(this.bingkai);
  }

  // ---------- kamera

  terbang(k: Kamera, langsung = false): void {
    if (langsung || this.opsi.tenang) {
      this.kamera = { ...k };
      this.sasaran = null;
    } else {
      this.sasaran = { ...k };
    }
    this.minta();
  }

  paskan(langsung = false): void {
    const kotak = kotakDari(this.graf.simpul);
    if (kotak) this.terbang(paskan(kotak, this.lebar, this.tinggi, this.tepi), langsung);
  }

  zum(faktor: number, sx = this.lebar / 2, sy = this.tinggi / 2, halus = false): void {
    const dasar = halus && this.sasaran ? this.sasaran : this.kamera;
    this.terbang(zumDiTitik(dasar, faktor, sx, sy), !halus);
  }

  geser(dx: number, dy: number): void {
    this.sasaran = null;
    this.kamera.tx += dx;
    this.kamera.ty += dy;
    this.minta();
  }

  /** Bawa satu simpul ke tengah area yang tidak tertutup panel. */
  pusatkan(id: string): void {
    const s = this.peta.get(id);
    if (!s || s.x === undefined || s.y === undefined) return;
    const k = Math.max(this.kamera.k, 0.9);
    const cx = this.tepi.kiri + (this.lebar - this.tepi.kiri - this.tepi.kanan) / 2;
    const cy = this.tepi.atas + (this.tinggi - this.tepi.atas - this.tepi.bawah) / 2;
    this.terbang({ k, tx: cx - s.x * k, ty: cy - s.y * k });
  }

  dunia(sx: number, sy: number): [number, number] {
    return keDunia(this.kamera, sx, sy);
  }

  layar(id: string): [number, number] | null {
    const s = this.peta.get(id);
    return s && s.x !== undefined && s.y !== undefined ? keLayar(this.kamera, s.x, s.y) : null;
  }

  /** Simpul di bawah titik layar. Sasaran sentuh minimal 14 px walau simpulnya kecil. */
  cari(sx: number, sy: number): Simpul | null {
    const [x, y] = this.dunia(sx, sy);
    const minimal = 14 / this.kamera.k;
    let terbaik: Simpul | null = null;
    let jarakTerbaik = Infinity;
    for (const s of this.graf.simpul) {
      if (s.x === undefined || s.y === undefined) continue;
      const jarak = Math.hypot(s.x - x, s.y - y);
      if (jarak <= Math.max(s.r, minimal) && jarak - s.r < jarakTerbaik) {
        terbaik = s;
        jarakTerbaik = jarak - s.r;
      }
    }
    return terbaik;
  }

  // ---------- gambar

  private warnaSimpul(s: Simpul): string {
    if (this.opsi.lensaPola && (s.jenis === "vendor" || s.jenis === "satker" || s.jenis === "tender")) return warnaPola(s.porsiPola);
    return WARNA_JENIS[s.jenis];
  }

  private lukis(waktu: number): void {
    const { c, kamera: k, dpr } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.lebar, this.tinggi);
    this.kisi();

    const pusat = this.hover ?? this.pilih;
    const sorot = pusat && this.peta.has(pusat) ? this.kawan.get(pusat) ?? new Set<string>() : null;
    const terang = (id: string) => !sorot || id === pusat || sorot.has(id);

    // --- sisi
    c.lineCap = "round";
    for (const e of this.graf.sisi) {
      const a = this.peta.get(e.source);
      const b = this.peta.get(e.target);
      if (!a || !b || a.x === undefined || b.x === undefined) continue;
      const kena = pusat !== null && (e.source === pusat || e.target === pusat);
      const [ax, ay] = keLayar(k, a.x, a.y!);
      const [bx, by] = keLayar(k, b.x, b.y!);
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.setLineDash(e.jenis === "milik" ? [5, 4] : e.jenis === "hierarki" ? [2, 4] : []);
      const tebal = e.jenis === "menang" ? 0.7 + Math.min(3.2, Math.log10(1 + e.nilai / 1e9) * 0.9) : 1;
      c.lineWidth = (kena ? tebal + 0.6 : tebal) * Math.max(0.6, Math.min(1.4, k.k));
      c.strokeStyle = kena
        ? WARNA.sisiSorot
        : e.jenis === "hierarki" ? WARNA.sisiHierarki : e.jenis === "milik" ? WARNA.sisiMilik : WARNA.sisi;
      c.globalAlpha = sorot && !kena ? 0.4 : 1;
      c.stroke();
    }
    c.setLineDash([]);
    c.globalAlpha = 1;

    // --- titik berjalan: uang mengalir dari satker ke vendor di sisi milik simpul terpilih
    if (this.pilih && !this.opsi.tenang && this.peta.has(this.pilih)) {
      c.fillStyle = WARNA.pilih;
      for (const e of this.graf.sisi) {
        if (e.jenis !== "menang" && e.jenis !== "paket") continue;
        if (e.source !== this.pilih && e.target !== this.pilih) continue;
        const dari = this.peta.get(e.target);
        const ke = this.peta.get(e.source);
        if (!dari || !ke || dari.x === undefined || ke.x === undefined) continue;
        const fase = ((waktu / 1600 + (e.id.length % 7) / 7) % 1 + 1) % 1;
        const [x, y] = keLayar(k, dari.x + (ke.x - dari.x) * fase, dari.y! + (ke.y! - dari.y!) * fase);
        c.beginPath();
        c.arc(x, y, 2, 0, DUA_PI);
        c.fill();
      }
    }

    // --- simpul
    const urut = [...this.graf.simpul].sort((a, b) => Number(terang(a.id)) - Number(terang(b.id)) || b.r - a.r);
    for (const s of urut) {
      if (s.x === undefined || s.y === undefined) continue;
      const [x, y] = keLayar(k, s.x, s.y);
      const r = Math.max(2.5, s.r * k.k);
      if (x < -r - 40 || y < -r - 40 || x > this.lebar + r + 40 || y > this.tinggi + r + 40) continue;
      const warna = this.warnaSimpul(s);
      const nyala = terang(s.id);
      c.globalAlpha = nyala ? (s.redup && !sorot ? 0.6 : 1) : 0.3;

      if (s.id === this.pilih || s.utama) {
        c.beginPath();
        c.arc(x, y, r + 6, 0, DUA_PI);
        c.fillStyle = alfa(s.id === this.pilih ? WARNA.pilih : warna, 0.16);
        c.fill();
      }
      c.beginPath();
      c.arc(x, y, r, 0, DUA_PI);
      c.fillStyle = alfa(warna, s.jenis === "tender" ? 0.5 : 0.2);
      c.fill();
      c.lineWidth = s.id === this.pilih ? 2.2 : s.id === this.hover ? 2 : 1.3;
      c.strokeStyle = s.id === this.pilih ? WARNA.pilih : warna;
      c.stroke();
      if (r >= 7) {
        c.fillStyle = alfa(warna, 0.95);
        glif(c, s.jenis, x, y, Math.min(r * 0.62, 11));
      }
      // busur pola: porsi paket berpola ganda
      if (s.porsiPola > 0 && s.jenis !== "instansi" && s.jenis !== "unit" && r >= 4) {
        c.beginPath();
        c.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + DUA_PI * Math.min(1, s.porsiPola));
        c.lineWidth = 2;
        c.strokeStyle = s.porsiPola > 0.5 ? WARNA.polaKuat : WARNA.pola;
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    this.label(urut, sorot, pusat);
  }

  private kisi(): void {
    const { c, kamera: k } = this;
    const langkah = 48 * k.k;
    if (langkah < 14) return;
    c.fillStyle = WARNA.kisi;
    const mulaiX = ((k.tx % langkah) + langkah) % langkah;
    const mulaiY = ((k.ty % langkah) + langkah) % langkah;
    for (let x = mulaiX; x < this.lebar; x += langkah) {
      for (let y = mulaiY; y < this.tinggi; y += langkah) c.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
    }
  }

  /** Label dengan pencegah tumpang tindih: simpul penting dulu, sisanya hanya kalau masih ada tempat. */
  private label(urut: Simpul[], sorot: Set<string> | null, pusat: string | null): void {
    const { c, kamera: k } = this;
    const penting = (s: Simpul) =>
      (s.id === this.pilih ? 1000 : 0) + (s.id === this.hover ? 900 : 0) + (s.utama ? 800 : 0) +
      (sorot?.has(s.id) ? 300 : 0) + (s.jenis === "instansi" ? 200 : s.jenis === "unit" ? 60 : 0) + s.r;
    const calon = urut
      .filter((s) => s.x !== undefined && (!sorot || s.id === pusat || sorot.has(s.id)))
      .sort((a, b) => penting(b) - penting(a));
    const terisi: [number, number, number, number][] = [];
    c.textBaseline = "top";
    c.textAlign = "center";
    c.lineJoin = "round";
    for (const s of calon) {
      const wajib = s.id === this.pilih || s.id === this.hover || s.utama === true;
      const r = s.r * k.k;
      if (!wajib && s.jenis === "tender" && !(sorot && pusat && k.k > 0.7)) continue;
      if (!wajib && r < (sorot ? 3 : s.jenis === "instansi" || s.jenis === "unit" ? 5 : 8.5)) continue;
      const [x, y] = keLayar(k, s.x!, s.y!);
      if (x < -60 || y < -30 || x > this.lebar + 60 || y > this.tinggi + 30) continue;
      const besar = s.jenis === "instansi" ? 12.5 : wajib ? 12 : 11;
      c.font = `${s.jenis === "instansi" || wajib ? 600 : 500} ${besar}px ${FON}`;
      const teks = potong(s.label, wajib ? 44 : s.jenis === "tender" ? 26 : 30);
      const lebar = c.measureText(teks).width;
      const kotak: [number, number, number, number] = [x - lebar / 2 - 3, y + r + 4, x + lebar / 2 + 3, y + r + 4 + besar + 4];
      if (!wajib && terisi.some((t) => kotak[0] < t[2] && kotak[2] > t[0] && kotak[1] < t[3] && kotak[3] > t[1])) continue;
      terisi.push(kotak);
      c.lineWidth = 3.5;
      c.strokeStyle = "rgba(8, 11, 16, 0.92)";
      c.strokeText(teks, x, y + r + 5);
      c.fillStyle = s.id === this.pilih ? WARNA.pilih : wajib || s.jenis === "instansi" ? WARNA.teks : s.redup ? WARNA.teksRedup : "#aeb8c7";
      c.fillText(teks, x, y + r + 5);
    }
  }
}
