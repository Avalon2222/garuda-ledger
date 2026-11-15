import type { MetadataRoute } from "next";
import { URL_SITUS } from "@/lib/situs";

// situsnya satu halaman; tampilan lain (vendor terpilih, filter) disimpan di hash URL, jadi cukup satu entri
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: URL_SITUS, changeFrequency: "weekly", priority: 1 }];
}
