import { expect, test } from "@playwright/test";

test.describe("server", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "cukup dijalankan sekali");

  test("header keamanan terpasang di halaman dan data", async ({ request }) => {
    for (const jalur of ["/", "/data/status.json"]) {
      const h = (await request.get(jalur)).headers();
      expect(h["content-security-policy"], jalur).toContain("default-src 'self'");
      expect(h["content-security-policy"], jalur).toContain("frame-ancestors 'self'");
      expect(h["x-frame-options"], jalur).toBe("SAMEORIGIN");
      expect(h["x-content-type-options"], jalur).toBe("nosniff");
      expect(h["referrer-policy"], jalur).toBe("strict-origin-when-cross-origin");
    }
  });

  test("data disajikan dengan cache dan isinya konsisten", async ({ request }) => {
    const ledger = await request.get("/data/ledger.json");
    expect(ledger.status()).toBe(200);
    expect(ledger.headers()["cache-control"]).toContain("max-age=3600");
    const status = (await (await request.get("/data/status.json")).json()) as { sidik: string; tender: number; vendor: number };
    const isi = (await ledger.json()) as { meta: { sidik: string }; tender: { id: string[] }; vendor: unknown[] };
    expect(isi.meta.sidik).toBe(status.sidik);
    expect(isi.tender.id.length).toBe(status.tender);
    expect(isi.vendor.length).toBe(status.vendor);
  });

  test("halaman memuat judul dan ringkasan di HTML server", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("<title>Garuda Ledger");
    expect(html).toContain("graf investigasi tender pertahanan");
    expect(html).toContain('lang="id"');
  });

  test("robots.txt dan sitemap.xml tersedia", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://garuda-ledger.vercel.app/sitemap.xml");
    expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://garuda-ledger.vercel.app</loc>");
  });
});
