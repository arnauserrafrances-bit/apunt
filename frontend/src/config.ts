// Nom de l'aplicació: canvia'l només aquí (i a core/config.py a la part de Python).
export const APP_NAME = "Apunt";

export const TERMS: Record<number, string> = {
  1: "1r trimestre",
  2: "2n trimestre",
  3: "3r trimestre",
};

/** Àrees que es proposen a una classe nova (la tutora les pot canviar). */
export const DEFAULT_AREAS = [
  "Llengua catalana i literatura",
  "Llengua castellana i literatura",
  "Llengua estrangera (anglès)",
  "Matemàtiques",
  "Coneixement del medi natural, social i cultural",
  "Educació artística",
  "Educació física",
];

export const STUDENT_CODE_PREFIX = "A-";
export const STUDENT_CODE_DIGITS = 2;

export const STORAGE_KEY = "apunt-v2";
