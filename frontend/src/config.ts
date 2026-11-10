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

/**
 * Comptes i sincronització (Supabase, regió UE). Aquests dos valors són públics per disseny:
 * van dins de la web i només permeten el que deixen les regles RLS (cada usuari, les seves files).
 * Si són buits, l'app funciona només en aquest dispositiu, com abans.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://jjxggzewgbqovyirpcyp.supabase.co";
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_BBg9d31caebblQ3UavQDhw_GgZxkGg0";

/** Llargada mínima de la contrasenya del compte. */
export const MIN_PASSWORD = 10;
