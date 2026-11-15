import Konsol from "@/components/Konsol";

export default function Halaman() {
  return (
    <>
      {/* judul + ringkasan ikut di HTML server, jadi mesin pencari dan pembaca layar tetap dapat isinya */}
      <h1 className="sr-only">Garuda Ledger: graf investigasi tender pertahanan dan keamanan Indonesia</h1>
      <p className="sr-only">
        Vendor, satker, paket, dan pemilik dari data pengadaan terbuka (LKPP lewat Opentender) dalam satu graf yang bisa
        diklik. Pola statistik seperti harga mepet HPS atau vendor langganan ditampilkan sebagai angka, bukan tuduhan.
      </p>
      <Konsol />
    </>
  );
}
