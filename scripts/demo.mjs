// Merekam bingkai demo untuk docs/demo.gif (dirakit oleh scripts/rakit_gif.py).
//   node scripts/demo.mjs http://127.0.0.1:3100 bingkai/
import { mkdirSync } from "node:fs";
import { chromium, selectors } from "@playwright/test";

const dasar = process.argv[2] ?? "http://127.0.0.1:3100";
const folder = process.argv[3] ?? "bingkai";
mkdirSync(folder, { recursive: true });
selectors.setTestIdAttribute("data-uji");

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "id-ID" });
let nomor = 0;
const potret = async (banyak = 1, jeda = 160) => {
  for (let i = 0; i < banyak; i++) {
    await p.screenshot({ path: `${folder}/${String(nomor++).padStart(3, "0")}.png` });
    await p.waitForTimeout(jeda);
  }
};
const berkas = p.getByRole("complementary", { name: "Berkas" });

await p.goto(dasar);
await p.waitForSelector('[data-uji="graf"]');
await p.waitForTimeout(700);
await potret(12);                                   // ikhtisar merapikan diri

await p.getByTestId("tombol-cari").click();          // cari vendor
await potret(2);
for (const huruf of "jasuindo") {
  await p.keyboard.type(huruf);
  await potret(1, 60);
}
await potret(3);
await p.keyboard.press("Enter");
await potret(14);                                   // graf memusat di vendor

await berkas.getByRole("button", { name: /KORLANTAS POLRI/ }).first().click();
await potret(3);
await berkas.getByRole("button", { name: "Fokus", exact: true }).click();
await potret(14);                                   // pindah ke satker

await p.keyboard.press("l");                        // lensa pola ganda
await potret(8);
await p.keyboard.press("m");                        // data & metode
await potret(10, 200);

await browser.close();
console.log(`${nomor} bingkai di ${folder}`);
