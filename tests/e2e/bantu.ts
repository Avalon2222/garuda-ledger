import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Playwright dijalankan dari akar repo
const STATUS_BAWAAN = readFileSync(path.join(process.cwd(), "public", "data", "status.json"), "utf8");

/** Kumpulkan galat konsol dan pelanggaran CSP selama halaman dipakai. */
export function pantauGalat(page: Page): string[] {
  const galat: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") galat.push(m.text());
  });
  page.on("pageerror", (e) => galat.push(`pageerror: ${e.message}`));
  return galat;
}

export function ponsel(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 768;
}

/**
 * Buka konsol dan tunggu graf siap. Permintaan ke cabang `data` di GitHub dijawab dengan status bawaan build,
 * supaya tes tidak bergantung pada jaringan dan tidak ikut berubah kalau pipeline harian baru saja jalan.
 */
export async function bukaKonsol(page: Page, jalur = "/") {
  await page.route("https://raw.githubusercontent.com/**", (rute) =>
    rute.request().url().endsWith("/status.json") ? rute.fulfill({ contentType: "application/json", body: STATUS_BAWAAN }) : rute.abort(),
  );
  await page.goto(jalur);
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("graf")).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId("graf").getAttribute("data-simpul"))).toBeGreaterThan(3);
}

/** Posisi layar sebuah simpul (relatif ke halaman), ditunggu sampai graf berhenti bergerak. */
export async function posisiSimpul(page: Page, id: string): Promise<{ x: number; y: number }> {
  const baca = () =>
    page.evaluate((idSimpul) => {
      const kanvas = document.querySelector("canvas") as (HTMLCanvasElement & { __layar?: (id: string) => [number, number] | null }) | null;
      const p = kanvas?.__layar?.(idSimpul);
      if (!kanvas || !p) return null;
      const k = kanvas.getBoundingClientRect();
      return { x: k.left + p[0], y: k.top + p[1] };
    }, id);
  let lama = await baca();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const baru = await baca();
    if (lama && baru && Math.hypot(baru.x - lama.x, baru.y - lama.y) < 0.6) return baru;
    lama = baru;
  }
  if (!lama) throw new Error(`Simpul ${id} tidak ada di graf`);
  return lama;
}

/**
 * Elemen yang terlihat tapi keluar dari layar (terpotong) dihitung gagal. Untuk isi panel yang memang bisa
 * digulung ke bawah, pakai `hanyaSamping` supaya yang diperiksa cuma tepi kiri dan kanan.
 */
export async function terpotong(page: Page, pemilih: string, hanyaSamping = false): Promise<string[]> {
  return page.evaluate(([sel, samping]) => {
    const lebar = document.documentElement.clientWidth;
    const tinggi = document.documentElement.clientHeight;
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel as string))) {
      const k = el.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) continue;
      if (k.left < -0.5 || k.right > lebar + 0.5 || (!samping && (k.top < -0.5 || k.bottom > tinggi + 0.5))) {
        hasil.push(`${el.getAttribute("aria-label") ?? el.title ?? el.textContent} @ ${Math.round(k.left)}..${Math.round(k.right)}`);
      }
    }
    return hasil;
  }, [pemilih, hanyaSamping] as const);
}

/** Tombol dan tautan yang tidak punya nama untuk pembaca layar. */
export async function tanpaNama(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a[href]"))) {
      const nama = (el.getAttribute("aria-label") ?? "").trim() || (el.textContent ?? "").trim();
      if (!nama) hasil.push(el.outerHTML.slice(0, 160));
    }
    return hasil;
  });
}

/** Selisih lebar isi dan lebar layar; > 0 berarti halaman bisa digeser ke samping. */
export async function melebar(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Panel berkas: lembar bawah di ponsel, panel kanan di layar lebar. */
export function berkas(page: Page) {
  return ponsel(page) ? page.getByTestId("lembar") : page.getByRole("complementary", { name: "Berkas" });
}
