import { randomInt } from "node:crypto";

// Gut vorlesbare, eindeutige Wörter (ohne Umlaute, keine Verwechslungen). 128 Wörter hoch 3 plus drei Ziffern ergeben
// rund 31 Bit; zusammen mit der Drosselung der Datenbank (10 Versuche je 15 Minuten) ist das nicht durchprobierbar.
const WORDS = [
  "kupfer", "wiese", "falke", "anker", "birke", "brunnen", "dachs", "eiche", "fichte", "garten", "hafer", "igel",
  "jaeger", "kirsche", "laterne", "mühle", "nebel", "oase", "pappel", "quelle", "rabe", "salbei", "tulpe", "ufer",
  "vogel", "wolke", "zeder", "amsel", "bagger", "dorf", "ernte", "fahne", "gabel", "hafen", "insel", "kahn",
  "lampe", "marder", "nadel", "ofen", "pinsel", "quarz", "regen", "stern", "tafel", "uhu", "vase", "wald",
  "ziegel", "adler", "bohne", "distel", "elster", "farn", "gans", "hase", "iris", "kiesel", "linde", "mohn",
  "nelke", "otter", "pilz", "rose", "schaf", "tanne", "ulme", "veilchen", "weide", "ahorn", "biene", "clever",
  "diele", "esche", "forelle", "granit", "hummel", "jasmin", "kranich", "lerche", "meise", "nuss", "orchidee", "pfau",
  "quitte", "reh", "sonne", "taube", "umber", "wiesel", "zaun", "apfel", "birne", "dohle", "enzian", "fliege",
  "gerste", "hirse", "ilex", "klee", "lilie", "minze", "narzisse", "oliven", "petersilie", "rettich", "senf", "thymian",
  "wacholder", "zimt", "ampel", "brett", "dach", "estrich", "feile", "hammer", "kelle", "lot", "meissel", "nagel",
  "pumpe", "rohr", "saege", "tuer",
].map((w) => w.replace("ü", "ue"));

export function generatePassword(): string {
  const words = Array.from({ length: 3 }, () => WORDS[randomInt(WORDS.length)]);
  const digits = String(randomInt(1000)).padStart(3, "0");
  return `${words.join("-")}-${digits}`;
}

export const WORD_COUNT = WORDS.length;
