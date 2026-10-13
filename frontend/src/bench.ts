// Pàgina de mesura (bench.html), fora de l'aplicació: quant triga Argon2id en un dispositiu real.
// S'obre amb `npm run dev -- --host` i http://<IP de l'ordinador>:5173/bench.html
import { deriveKeys, KDF_V1, ready, type KdfParams } from "./lib/crypto";

const MiB = 1024 * 1024;
const LIMIT_MS = 2000;

const CANDIDATES: { label: string; params: KdfParams; runs: number }[] = [
  { label: "v1: 3 passades, 64 MiB", params: KDF_V1, runs: 5 },
  { label: "Alternativa: 2 passades, 32 MiB", params: { opsLimit: 2, memLimitBytes: 32 * MiB }, runs: 3 },
  { label: "Alternativa: 4 passades, 19 MiB (mínim OWASP)", params: { opsLimit: 4, memLimitBytes: 19 * MiB }, runs: 3 },
];

const $ = (id: string) => document.getElementById(id)!;
const pause = () => new Promise((r) => setTimeout(r, 50)); // deixa pintar la pantalla
const fmt = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

$("device").textContent = `Dispositiu: ${navigator.userAgent}`;

async function measure(params: KdfParams, runs: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    await pause();
    const t = performance.now();
    await deriveKeys("mesura@apunt.test", `contrasenya de prova ${i}`, params);
    times.push(performance.now() - t);
  }
  return times.sort((a, b) => a - b);
}

$("start").addEventListener("click", async () => {
  const button = $("start") as HTMLButtonElement;
  button.disabled = true;
  $("results").innerHTML = "";
  $("summary").textContent = "";
  await ready();

  let v1Ok = false;
  for (const c of CANDIDATES) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${c.label}</td><td>…</td><td></td><td>Mesurant…</td>`;
    $("results").append(row);
    const cells = row.querySelectorAll("td");
    try {
      const times = await measure(c.params, c.runs);
      const median = times[Math.floor(times.length / 2)];
      const max = times[times.length - 1];
      const ok = max <= LIMIT_MS;
      if (c.params === KDF_V1) v1Ok = ok;
      cells[1].textContent = fmt(median);
      cells[2].textContent = fmt(max);
      cells[3].textContent = ok ? "Correcte" : "Massa lent";
      cells[3].className = ok ? "ok" : "warn";
    } catch (e) {
      cells[1].textContent = "—";
      cells[3].textContent = `Ha fallat (${e instanceof Error ? e.message : "error desconegut"})`;
      cells[3].className = "err";
    }
  }

  $("summary").textContent = v1Ok
    ? "Els paràmetres v1 van bé en aquest dispositiu."
    : "Els paràmetres v1 són massa lents o han fallat. Fes una captura d'aquesta pantalla i envia-la.";
  button.disabled = false;
  button.textContent = "Torna a mesurar";
});
