import { expect, test } from "@playwright/test";
import { berkas, bukaKonsol, melebar, pantauGalat, ponsel, posisiSimpul, terpotong } from "./bantu";

test("cari vendor lalu buka berkasnya", async ({ page }) => {
  const galat = pantauGalat(page);
  await bukaKonsol(page);
  await page.getByTestId("tombol-cari").click();
  const dialog = page.getByRole("dialog", { name: "Pencarian" });
  await expect(dialog).toBeVisible();
  const masukan = dialog.getByRole("combobox");
  await expect(masukan).toBeFocused();
  await masukan.fill("jasuindo tiga");
  await expect(dialog.getByRole("option").first()).toContainText("PT Jasuindo Tiga Perkasa");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);

  const panel = berkas(page);
  await expect(panel.getByTestId("judul-berkas")).toHaveText("PT Jasuindo Tiga Perkasa");
  await expect(page.getByTestId("cip-tampilan")).toContainText("Fokus");
  await expect(page).toHaveURL(/#sel=v%3A\d+&fokus=v%3A\d+/);
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  expect(galat).toEqual([]);
});

test("pencarian: panah memilih, tanpa hasil diberi tahu, Esc menutup", async ({ page }) => {
  await bukaKonsol(page);
  await page.getByTestId("tombol-cari").click();
  const dialog = page.getByRole("dialog", { name: "Pencarian" });
  const masukan = dialog.getByRole("combobox");
  await masukan.fill("korlantas");
  await expect(dialog.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await masukan.fill("zzzqqqxxx");
  await expect(dialog.getByText(/Tidak ada yang cocok/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("klik simpul di kanvas membuka berkasnya, klik latar melepas pilihan", async ({ page }) => {
  await bukaKonsol(page);
  const titik = await posisiSimpul(page, "i:1");
  await page.mouse.click(titik.x, titik.y);
  const panel = berkas(page);
  await expect(panel.getByTestId("berkas-instansi")).toBeVisible();
  await expect(panel.getByTestId("judul-berkas")).toHaveText("Kepolisian Negara Republik Indonesia");
  await expect(page).toHaveURL(/sel=i%3A1/);
});

test("klik dua kali memusatkan graf, tombol kembali memulihkan ikhtisar", async ({ page }) => {
  test.skip(ponsel(page), "klik ganda diuji dengan mouse; di ponsel pakai tombol Fokus");
  await bukaKonsol(page);
  const titik = await posisiSimpul(page, "i:0");
  await page.mouse.dblclick(titik.x, titik.y);
  await expect(page.getByTestId("cip-tampilan")).toContainText("Fokus");
  await expect(page.getByTestId("cip-tampilan")).toContainText("Kemhan/TNI");
  await page.getByRole("main").getByRole("button", { name: "Kembali ke tampilan sebelumnya" }).click();
  await expect(page.getByTestId("cip-tampilan")).toContainText("Ikhtisar");
});

test("berkas vendor → satker → paket, lalu tombol Fokus dan Perluas", async ({ page }) => {
  const galat = pantauGalat(page);
  await bukaKonsol(page, "/#sel=v:0&fokus=v:0");
  const panel = berkas(page);
  if (ponsel(page)) await page.getByTestId("pegang-lembar").click(); // setengah -> penuh
  await expect(panel.getByTestId("berkas-vendor")).toBeVisible();

  await panel.getByRole("button", { name: /SLOG POLRI/ }).first().click();
  await expect(panel.getByTestId("berkas-satker")).toBeVisible();
  await expect(panel.getByTestId("judul-berkas")).toHaveText("SLOG POLRI");
  await expect(panel.getByText("Konsentrasi (HHI)")).toBeVisible();

  const sebelum = Number(await page.getByTestId("graf").getAttribute("data-simpul"));
  await panel.getByRole("button", { name: "Perluas" }).click();
  await expect.poll(async () => Number(await page.getByTestId("graf").getAttribute("data-simpul"))).toBeGreaterThan(sebelum);

  await panel.getByTestId("tabel-paket").locator("tbody tr").first().click();
  await expect(panel.getByTestId("berkas-tender")).toBeVisible();
  await expect(panel.getByText("Nilai pemenang")).toBeVisible();
  await expect(panel.getByText("Pola di paket ini")).toBeVisible();
  await expect(page).toHaveURL(/sel=t%3A\d+/);

  await panel.getByRole("button", { name: /^PT |^CV /, exact: false }).first().click();
  await expect(panel.getByTestId("berkas-vendor")).toBeVisible();
  await panel.getByRole("button", { name: "Fokus", exact: true }).click();
  await expect(page.getByTestId("cip-tampilan")).toContainText("Fokus");
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  expect(galat).toEqual([]);
});

test("filter instansi dan pola mengubah angka, graf, dan URL", async ({ page }) => {
  await bukaKonsol(page);
  if (ponsel(page) || (page.viewportSize()?.width ?? 0) < 1180) await page.getByRole("button", { name: "Filter dan legenda" }).click();
  const filter = page.getByTestId("panel-saring");
  await expect(filter).toBeVisible();
  expect(await terpotong(page, "[data-uji=panel-saring] button", true)).toEqual([]);

  await filter.getByRole("checkbox", { name: /Bakamla/ }).click();
  await expect(filter.getByRole("checkbox", { name: /Bakamla/ })).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/in=bakamla/);
  await filter.getByRole("checkbox", { name: /Mepet HPS/ }).click();
  await expect(page).toHaveURL(/pola=mepet/);
  await expect(filter.getByRole("button", { name: "Atur ulang" })).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId("graf").getAttribute("data-simpul"))).toBeLessThan(60);

  await filter.getByRole("button", { name: "Pola ganda" }).click();
  await expect(page).toHaveURL(/lensa=1/);

  await filter.getByRole("button", { name: "Atur ulang" }).click();
  await expect(page).not.toHaveURL(/in=bakamla/);
  await expect(filter.getByRole("checkbox", { name: /Bakamla/ })).toHaveAttribute("aria-checked", "false");
});

test("linimasa: pilih satu tahun, lalu kembali ke semua tahun", async ({ page }) => {
  await bukaKonsol(page);
  if (ponsel(page)) await page.getByRole("button", { name: "Filter dan legenda" }).click();
  const linimasa = page.getByTestId("linimasa");
  await expect(linimasa).toBeVisible();
  await expect(linimasa.getByTestId("rentang-tahun")).toHaveText("2013–2023");
  const batang = linimasa.getByRole("button", { name: /^2021:/ });
  await batang.click();
  await expect(linimasa.getByTestId("rentang-tahun")).toHaveText("2021");
  await expect(page).toHaveURL(/th=2021-2021/);
  await linimasa.getByRole("button", { name: "Semua tahun" }).click();
  await expect(linimasa.getByTestId("rentang-tahun")).toHaveText("2013–2023");
  expect(await melebar(page)).toBeLessThanOrEqual(0);
});

test("pintasan papan ketik: / mencari, L lensa, M metode, Esc melepas pilihan", async ({ page }) => {
  test.skip(ponsel(page), "pintasan papan ketik hanya relevan di desktop");
  await bukaKonsol(page, "/#sel=v:3&fokus=v:3");
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "Pencarian" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  await expect(page).toHaveURL(/lensa=1/);
  await page.keyboard.press("m");
  await expect(page.getByTestId("panel-metode")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("panel-metode")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ringkasan-sektor")).toBeVisible();
  await page.keyboard.press("i");
  await expect(page.getByTestId("cip-tampilan")).toContainText("Ikhtisar");
});

test("salin tautan menaruh URL tampilan di papan klip", async ({ page }) => {
  test.skip(ponsel(page), "izin papan klip di emulasi ponsel tidak stabil");
  await bukaKonsol(page, "/#sel=v:1&fokus=v:1");
  await berkas(page).getByRole("button", { name: "Salin tautan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tautan disalin" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#sel=v%3A1&fokus=v%3A1$/);
});

test("ponsel: lembar bawah naik saat simpul dipilih, laci filter muat di layar", async ({ page }) => {
  test.skip(!ponsel(page), "khusus ponsel");
  await bukaKonsol(page);
  const lembar = page.getByTestId("lembar");
  await expect(lembar).toHaveAttribute("data-posisi", "intip");
  const titik = await posisiSimpul(page, "i:1");
  await page.touchscreen.tap(titik.x, titik.y);
  await expect(lembar).toHaveAttribute("data-posisi", "setengah");
  await expect(lembar.getByTestId("judul-berkas")).toHaveText("Kepolisian Negara Republik Indonesia");
  // lembar naik dengan transisi tinggi; tombolnya baru boleh dinilai setelah transisi selesai
  await expect.poll(() => terpotong(page, "[data-uji=lembar] header button")).toEqual([]);

  await page.getByTestId("pegang-lembar").click();
  await expect(lembar).toHaveAttribute("data-posisi", "penuh");
  await page.getByTestId("pegang-lembar").click();
  await expect(lembar).toHaveAttribute("data-posisi", "intip");

  await page.getByRole("button", { name: "Filter dan legenda" }).click();
  const laci = page.getByRole("dialog", { name: "Filter dan legenda" });
  await expect(laci).toBeVisible();
  const kotak = await laci.boundingBox();
  expect(kotak!.x).toBeGreaterThanOrEqual(0);
  expect(kotak!.x + kotak!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await laci.getByRole("button", { name: "Tutup filter" }).click();
  await expect(laci).toHaveCount(0);
  expect(await melebar(page)).toBeLessThanOrEqual(0);
});
