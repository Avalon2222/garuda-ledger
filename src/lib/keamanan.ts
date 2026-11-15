/**
 * Header keamanan untuk semua halaman (dipasang lewat next.config.ts).
 * Kalau browser perlu mengambil sesuatu dari host baru, tambahkan host-nya di SUMBER_LUAR;
 * kalau tidak, permintaan itu diblokir Content-Security-Policy.
 */

export const SUMBER_LUAR = {
  /** fetch dari browser: status dan ledger harian di cabang `data` */
  sambung: ["https://raw.githubusercontent.com"],
};

export function kebijakanKonten(dev = false): string {
  const aturan: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // Next menyisipkan skrip inline untuk hidrasi; mode dev butuh eval untuk hot reload
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", ...SUMBER_LUAR.sambung, ...(dev ? ["ws:"] : [])]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
  ];
  return aturan.map(([nama, nilai]) => `${nama} ${nilai.join(" ")}`).join("; ");
}

export function headerKeamanan(dev = false): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: kebijakanKonten(dev) },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
}
