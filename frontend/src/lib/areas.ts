const SHORT: Record<string, string> = {
  "Llengua catalana i literatura": "Català",
  "Llengua castellana i literatura": "Castellà",
  "Llengua estrangera (anglès)": "Anglès",
  "Matemàtiques": "Mates",
  "Coneixement del medi natural, social i cultural": "Medi",
  "Educació artística": "Artística",
  "Educació física": "Ed. física",
};

/** Nom curt per a taules i botons. */
export function shortAreaName(name: string): string {
  if (SHORT[name]) return SHORT[name];
  // «Àmbit lingüístic» → «Lingüístic»; «Adaptació al curs i actitud» → «Adaptació».
  let n = name.replace(/^(àmbit|àrea|area)\s+(de\s+(l['’]|la\s+|les\s+|els\s+)?)?/i, "").trim();
  n = n.split(/\s+(i|al|a la|del|de|amb)\s+|,\s*/i)[0].trim();
  n = n.charAt(0).toUpperCase() + n.slice(1);
  return n.length > 16 ? `${n.slice(0, 15)}…` : n || name;
}

/** Colors de les àrees (sistema de disseny): cada àrea, el seu, per ordre. Si n'hi ha més de 6, es repeteixen. */
const AREA_COLORS = [
  { dot: "#5FD3B3", bg: "#E3F7F1", ink: "#0F6B55" },
  { dot: "#8CCBF5", bg: "#E3F2FC", ink: "#1C5A86" },
  { dot: "#C3B2F7", bg: "#EEE8FD", ink: "#4B3A99" },
  { dot: "#FF8F70", bg: "#FFE9E2", ink: "#9A3412" },
  { dot: "#F5A3C7", bg: "#FDE7F1", ink: "#8C2B5C" },
  { dot: "#F2B33D", bg: "#FCEFD3", ink: "#7A4E00" },
];

export function areaColor(index: number): { dot: string; bg: string; ink: string } {
  return AREA_COLORS[((index % AREA_COLORS.length) + AREA_COLORS.length) % AREA_COLORS.length];
}

/** Inicials per a l'avatar d'un alumne. */
export function initials(firstName: string, lastName = ""): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? firstName.trim()[1] ?? "";
  return (a + b).toUpperCase();
}
