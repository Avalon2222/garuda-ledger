import type { NextConfig } from "next";
import { headerKeamanan } from "./src/lib/keamanan";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: headerKeamanan(process.env.NODE_ENV !== "production"),
      },
      {
        // data dibangun ulang paling cepat sehari sekali; browser boleh pakai salinan lama sambil mengecek yang baru
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
