// Learning loop d'Apunt: mesures per saber si l'app aprèn de la tutora.
// - keptRatio: quina part de l'esborrany de la IA conserva la tutora a la versió final (per paraules).
//   Si el loop funciona, ha de pujar d'un informe a l'altre: la tutora necessita corregir menys.

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}'’·-]+/u)
    .filter(Boolean);
}

/** Longitud de la subseqüència comuna més llarga entre dues llistes de paraules. */
export function lcsLength(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Proporció de paraules de l'esborrany que es mantenen a la versió final (0-1), sumant totes les àrees.
 * drafts i finals van per id d'àrea. Una àrea que la tutora ha esborrat compta com a 0 conservat.
 */
export function keptRatio(drafts: Record<string, string>, finals: Record<string, string>): number | null {
  let total = 0;
  let kept = 0;
  for (const [id, draft] of Object.entries(drafts)) {
    const d = words(draft);
    total += d.length;
    kept += lcsLength(d, words(finals[id] ?? ""));
  }
  return total ? kept / total : null;
}

export function percent(r: number | null | undefined): string {
  return r === null || r === undefined ? "—" : `${Math.round(r * 100)} %`;
}
