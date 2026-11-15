import { expect, test } from "@playwright/test";
import { berkas, bukaKonsol, melebar, pantauGalat, ponsel, tanpaNama, terpotong } from "./bantu";

test("konsol terbuka: graf terisi, header utuh, tidak ada galat", async ({ page }) => {
  const galat = pantauGalat(page);
  await bukaKonsol(page);

  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: "Cari vendor, satker, atau paket" })).toBeVisible();
  await expect(header.getByRole("button", { name: /Data (&|dan) metode/ }).first()).toBeVisible();
  await expect(header.getByRole("button", { name: "Bantuan dan pintasan" })).toBeVisible();
  expect(await terpotong(page, "header button, header a")).toEqual([]);

  const graf = page.getByTestId("graf");
  expect(Number(await graf.getAttribute("data-simpul"))).toBeGreaterThan(40);
  expect(Number(await graf.getAttribute("data-sisi"))).toBeGreaterThan(40);
  await expect(page.getByTestId("cip-tampilan")).toContainText("Ikhtisar");

  // kanvas benar-benar digambar (bukan kotak kosong): ada cukup banyak piksel yang bukan latar
  const terisi = await page.evaluate(() => {
    const k = document.querySelector("canvas")!;
    const c = k.getContext("2d")!;
    const d = c.getImageData(0, 0, k.width, k.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n / (d.length / 4);
  });
  expect(terisi).toBeGreaterThan(0.004);

  expect(await melebar(page)).toBeLessThanOrEqual(0);
  expect(await tanpaNama(page)).toEqual([]);
  expect(galat).toEqual([]);
});

test("ringkasan sektor menampilkan angka dari data", async ({ page }) => {
  await bukaKonsol(page);
  if (ponsel(page)) await page.getByTestId("pegang-lembar").click();
  const panel = berkas(page);
  await expect(panel.getByTestId("ringkasan-sektor")).toBeVisible();
  await expect(panel.getByText("44.092")).toBeVisible();
  await expect(panel.getByText(/Rp 298,3 T/).first()).toBeVisible();
  await expect(panel.getByText(/dari HPS/)).toBeVisible();
  await expect(panel.getByRole("button", { name: /PT Permata Sigma Perkasa/ }).first()).toBeVisible();
  expect(await melebar(page)).toBeLessThanOrEqual(0);
});

test("tautan dalam membuka berkas vendor dan memusatkan graf", async ({ page }) => {
  const galat = pantauGalat(page);
  await bukaKonsol(page, "/#sel=v:0&fokus=v:0");
  const panel = berkas(page);
  await expect(panel.getByTestId("berkas-vendor")).toBeVisible();
  await expect(panel.getByTestId("judul-berkas")).toHaveText("PT Permata Sigma Perkasa");
  await expect(page.getByTestId("cip-tampilan")).toContainText("Fokus");
  await expect(panel.getByText("Total menang")).toBeVisible();
  await expect(panel.getByText("Dibeli oleh")).toBeVisible();
  await expect(panel.getByTestId("tabel-paket").locator("tbody tr").first()).toBeVisible();
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  await expect.poll(() => terpotong(page, "[data-uji=berkas-vendor] header button")).toEqual([]);
  expect(galat).toEqual([]);
});

test("hash ngawur tidak merusak halaman", async ({ page }) => {
  const galat = pantauGalat(page);
  await bukaKonsol(page, "/#sel=v:99999999&fokus=<script>alert(1)</script>&th=1800-9999&pola=x&in=y");
  await expect(page.getByTestId("cip-tampilan")).toContainText("Ikhtisar");
  expect(galat).toEqual([]);
});

test("dialog Data & metode: alur pipeline, gerbang kualitas, batasan", async ({ page }) => {
  await bukaKonsol(page);
  await page.getByRole("banner").getByRole("button", { name: /Data (&|dan) metode/ }).first().click();
  const dialog = page.getByRole("dialog", { name: /Dari 1,3 juta baris/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByText("1.301.212")).toBeVisible();
  await expect(dialog.getByText("Gerbang kualitas")).toBeVisible();
  await expect(dialog.getByText("Kode tender unik")).toBeVisible();
  await expect(dialog.getByText("Entity resolution vendor")).toBeVisible();
  await expect(dialog.getByText(/semua angka adalah batas bawah/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Opentender/ })).toHaveAttribute("href", /data\.open-contracting\.org/);
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  expect(await tanpaNama(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("bantuan jadi dialog, fokus pindah ke panel, Esc menutup", async ({ page }) => {
  await bukaKonsol(page);
  await page.getByRole("button", { name: "Bantuan dan pintasan" }).click();
  const dialog = page.getByRole("dialog", { name: "Cara membaca graf ini" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expect(dialog.getByText(/bukan tuduhan/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
