// USD je 1 Mio. Token (Stand 2026-10, Anthropic-API-Preise). Unbekannte Modelle werden bewusst
// mit dem höchsten bekannten Preis angesetzt, damit die Kostenbremse eher zu früh als zu spät greift.
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
const FALLBACK_PRICE = { input: 10, output: 50 };

export function priceFor(model: string) {
  const known = Object.keys(PRICES_USD_PER_MTOK)
    .filter((id) => model === id || model.startsWith(`${id}-`))
    .sort((a, b) => b.length - a.length)[0];
  return known ? PRICES_USD_PER_MTOK[known] : FALLBACK_PRICE;
}

export function estimateCostEur(
  model: string,
  usage: { tokensIn: number; tokensOut: number },
  usdEurRate: number,
): number {
  const price = priceFor(model);
  const usd = (usage.tokensIn * price.input + usage.tokensOut * price.output) / 1_000_000;
  return usd * usdEurRate;
}

const CHARS_PER_TOKEN = 3; // konservativ für deutschen Text
const TOKENS_PER_IMAGE = 2000;

/** Teuerster denkbarer Fall eines Aufrufs: geschätzte Eingabe + volle Ausgabe bis max_tokens. */
export function estimateMaxCostEur(params: {
  model: string;
  textChars: number;
  imageCount: number;
  maxTokens: number;
  usdEurRate: number;
}): number {
  const tokensIn = Math.ceil(params.textChars / CHARS_PER_TOKEN) + params.imageCount * TOKENS_PER_IMAGE;
  return estimateCostEur(params.model, { tokensIn, tokensOut: params.maxTokens }, params.usdEurRate);
}
