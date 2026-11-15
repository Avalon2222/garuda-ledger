// Mengambil ulang tangkapan layar untuk README dan gambar pratinjau tautan (Open Graph).
//   npm run build && npm run start -- -p 3100 &
//   node scripts/potret.mjs http://127.0.0.1:3100
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const dasar = process.argv[2] ?? "http://127.0.0.1:3100";
mkdirSync("docs/screenshots", { recursive: true });

/** [berkas keluaran, jalur + hash, lebar, tinggi, skala piksel, aksi tambahan] */
const DAFTAR = [
  ["docs/screenshots/hero.png", "/", 1440, 900, 2],
  ["docs/screenshots/vendor.png", "/#sel=v:1&fokus=v:1", 1440, 900, 2],
  ["docs/screenshots/satker.png", "/#sel=s:674&fokus=s:674&lensa=1", 1440, 900, 2],
  ["docs/screenshots/metode.png", "/", 1440, 900, 2, async (p) => p.keyboard.press("m")],
  ["docs/screenshots/mobile.png", "/#sel=v:1&fokus=v:1", 390, 844, 3],
  ["src/app/opengraph-image.png", "/#fokus=i:0", 1200, 630, 1],
];

const browser = await chromium.launch();
for (const [keluar, jalur, lebar, tinggi, skala, aksi] of DAFTAR) {
  const ponsel = lebar < 768;
  const halaman = await browser.newPage({ viewport: { width: lebar, height: tinggi }, deviceScaleFactor: skala, hasTouch: ponsel, isMobile: ponsel, locale: "id-ID" });
  await halaman.goto(dasar + jalur);
  await halaman.waitForSelector('[data-uji="graf"]', { timeout: 30_000 });
  // tunggu simulasi berhenti dan kamera selesai membingkai
  await halaman.waitForTimeout(6500);
  if (aksi) {
    await aksi(halaman);
    await halaman.waitForTimeout(600);
  }
  await halaman.screenshot({ path: keluar });
  await halaman.close();
  console.log("tersimpan", keluar);
}
await browser.close();
