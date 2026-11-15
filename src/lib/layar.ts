import { useSyncExternalStore } from "react";

export type Layar = "ponsel" | "tablet" | "desktop";

const PONSEL = "(max-width: 767px)";
const TABLET = "(max-width: 1179px)";

function baca(): Layar {
  if (window.matchMedia(PONSEL).matches) return "ponsel";
  return window.matchMedia(TABLET).matches ? "tablet" : "desktop";
}

function langgan(panggil: () => void): () => void {
  const a = window.matchMedia(PONSEL);
  const b = window.matchMedia(TABLET);
  a.addEventListener("change", panggil);
  b.addEventListener("change", panggil);
  return () => {
    a.removeEventListener("change", panggil);
    b.removeEventListener("change", panggil);
  };
}

/** Golongan lebar layar: ponsel (lembar bawah + laci), tablet (panel kiri jadi laci), desktop (dua panel menempel). */
export function useLayar(): Layar {
  return useSyncExternalStore(langgan, baca, () => "desktop");
}
