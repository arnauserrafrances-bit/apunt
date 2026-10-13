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
  return SHORT[name] ?? (name.length > 12 ? `${name.slice(0, 11)}…` : name);
}
