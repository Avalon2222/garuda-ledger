/** Tanda Garuda Ledger: sepasang sayap yang tersusun dari simpul dan garis graf. */
export default function Logo({ ukuran = 22 }: { ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 25 4 9M16 25 28 9M16 25 10 7M16 25 22 7M16 25V12" stroke="#5aa2ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
      <circle cx="4" cy="9" r="2.4" fill="#31d0c0" />
      <circle cx="28" cy="9" r="2.4" fill="#31d0c0" />
      <circle cx="10" cy="7" r="2" fill="#a990ff" />
      <circle cx="22" cy="7" r="2" fill="#a990ff" />
      <circle cx="16" cy="11" r="2.6" fill="#ffd66b" />
      <circle cx="16" cy="25" r="3.4" fill="#5aa2ff" stroke="#080b10" strokeWidth="1.2" />
    </svg>
  );
}
