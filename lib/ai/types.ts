import type { z } from "zod";

export type AiTier = "capable" | "cheap";
export type AiEffort = "low" | "medium" | "high";

export interface AiImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface AiUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface AiCallParams<T> {
  model: string;
  system: string;
  userText: string;
  images?: AiImage[];
  schema: z.ZodType<T>;
  effort: AiEffort;
  maxTokens: number;
}

export interface AiCallResult<T> extends AiUsage {
  output: T;
  /** Tatsächlich ausführendes Modell (kann bei einem Fallback vom angefragten abweichen) */
  model: string;
}

export interface AiProvider {
  call<T>(params: AiCallParams<T>): Promise<AiCallResult<T>>;
}

export class AiConfigError extends Error {}
export class AiBudgetError extends Error {}
export class AiProviderError extends Error {}
export class AiRefusalError extends Error {}

/** Antwort war nicht im geforderten Format — löst genau einen Korrektur-Versuch aus. */
export class AiValidationError extends Error {
  constructor(
    message: string,
    readonly usage?: AiUsage,
  ) {
    super(message);
  }
}
