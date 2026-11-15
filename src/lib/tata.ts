import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum } from "d3-force";
import type { Graf, JenisSisi, Simpul } from "./graf";

interface Tali extends SimulationLinkDatum<Simpul> {
  jenis: JenisSisi;
}

const JARAK_SISI: Record<JenisSisi, number> = { hierarki: 70, menang: 105, milik: 64, paket: 46 };
const KUAT_SISI: Record<JenisSisi, number> = { hierarki: 0.7, menang: 0.12, milik: 0.6, paket: 0.5 };

/** Angka acak deterministik (mulberry32), supaya tata letak awal sama di tiap muat dan di tes. */
export function acak(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Beri posisi awal ke simpul yang belum punya: di dekat tetangga yang sudah berposisi, atau melingkar di
 * sekitar pusat. Simpul lama tidak disentuh, jadi graf tidak "meledak" tiap kali ada simpul baru.
 */
export function tempatkan(graf: Graf, rng: () => number = acak(7)): void {
  const peta = new Map(graf.simpul.map((s) => [s.id, s]));
  const kawan = new Map<string, Simpul[]>();
  for (const e of graf.sisi) {
    const a = peta.get(e.source);
    const b = peta.get(e.target);
    if (!a || !b) continue;
    (kawan.get(a.id) ?? kawan.set(a.id, []).get(a.id)!).push(b);
    (kawan.get(b.id) ?? kawan.set(b.id, []).get(b.id)!).push(a);
  }
  const baru = graf.simpul.filter((s) => s.x === undefined || s.y === undefined);
  const semuaBaru = baru.length === graf.simpul.length;
  for (const s of baru) {
    const jangkar = (kawan.get(s.id) ?? []).find((k) => k.x !== undefined && k.y !== undefined);
    const sudut = rng() * Math.PI * 2;
    if (jangkar && !semuaBaru) {
      const jarak = 40 + rng() * 40;
      s.x = jangkar.x! + Math.cos(sudut) * jarak;
      s.y = jangkar.y! + Math.sin(sudut) * jarak;
    } else {
      // instansi di tengah, sisanya makin ke luar: memberi simulasi titik berangkat yang sudah mirip hasil akhir
      const cincin = { instansi: 60, unit: 160, satker: 260, pemilik: 330, vendor: 360, tender: 300 }[s.jenis];
      const jarak = cincin * (0.7 + rng() * 0.6);
      s.x = Math.cos(sudut) * jarak;
      s.y = Math.sin(sudut) * jarak;
    }
  }
}

/** Simulasi gaya untuk graf yang sedang tampil. Simpul dipakai langsung (posisinya ditulis di tempat). */
export class Tata {
  private sim: Simulation<Simpul, Tali>;

  /** dipanggil sekali tiap kali simulasi berhenti bergerak */
  saatDiam: () => void = () => {};

  constructor(private saatGerak: () => void) {
    this.sim = forceSimulation<Simpul, Tali>([])
      .force("muatan", forceManyBody<Simpul>().strength((d) => -170 - d.r * 20).distanceMax(700))
      .force("tabrak", forceCollide<Simpul>().radius((d) => d.r + 13).strength(0.9))
      .force("x", forceX<Simpul>(0).strength(0.05))
      .force("y", forceY<Simpul>(0).strength(0.07))
      .velocityDecay(0.34)
      .alphaDecay(0.028)
      .on("tick", () => this.saatGerak())
      .on("end", () => this.saatDiam())
      .stop();
  }

  /** Ganti isi simulasi. `hangat` = berapa langkah dijalankan langsung sebelum animasi (0 untuk tes cepat). */
  pasang(graf: Graf, hangat = 90): void {
    tempatkan(graf);
    const tali: Tali[] = graf.sisi.map((e) => ({ source: e.source, target: e.target, jenis: e.jenis }));
    this.sim.nodes(graf.simpul);
    this.sim.force(
      "tali",
      forceLink<Simpul, Tali>(tali)
        .id((d) => d.id)
        .distance((t) => JARAK_SISI[t.jenis] + ((t.source as Simpul).r + (t.target as Simpul).r) * 0.9)
        .strength((t) => KUAT_SISI[t.jenis]),
    );
    this.sim.alpha(0.9);
    for (let i = 0; i < hangat; i++) this.sim.tick();
    this.sim.alpha(hangat ? 0.14 : 0.9).restart();
  }

  /**
   * Sesuaikan gravitasi dengan bentuk layar: di layar tegak (ponsel) tarikan mendatar diperkuat supaya graf
   * tumbuh ke atas-bawah, di layar lebar sebaliknya. `rasio` = lebar / tinggi area graf.
   */
  bentuk(rasio: number): void {
    const r = Math.min(2.2, Math.max(0.45, rasio));
    this.sim.force("x", forceX<Simpul>(0).strength(0.06 / r));
    this.sim.force("y", forceY<Simpul>(0).strength(0.06 * r));
  }

  /** Panaskan lagi (dipakai saat simpul diseret). */
  panaskan(alpha = 0.3): void {
    this.sim.alphaTarget(alpha).restart();
  }

  dinginkan(): void {
    this.sim.alphaTarget(0);
  }

  get aktif(): boolean {
    return this.sim.alpha() > this.sim.alphaMin();
  }

  hentikan(): void {
    this.sim.stop();
  }
}
