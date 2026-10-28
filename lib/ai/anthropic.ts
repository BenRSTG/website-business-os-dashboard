import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AiProviderError,
  AiRefusalError,
  AiValidationError,
  type AiCallParams,
  type AiCallResult,
  type AiProvider,
} from "./types";

function describeApiError(error: unknown): AiProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiProviderError("Der KI-Zugang wurde abgelehnt. Bitte den ANTHROPIC_API_KEY prüfen.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiProviderError("Die KI ist gerade überlastet oder das Kontingent ist erschöpft. Bitte später erneut versuchen.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiProviderError("Das konfigurierte KI-Modell wurde nicht gefunden. Bitte AI_MODEL_CAPABLE/AI_MODEL_CHEAP prüfen.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiProviderError(`Die KI-Anfrage wurde abgelehnt: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    return new AiProviderError(`Die KI antwortet mit einem Fehler (${error.status ?? "unbekannt"}).`);
  }
  return new AiProviderError("Die KI konnte nicht erreicht werden.");
}

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });

  return {
    async call<T>(params: AiCallParams<T>): Promise<AiCallResult<T>> {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(params.images ?? []).map(
          (image): Anthropic.Beta.BetaContentBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          }),
        ),
        { type: "text", text: params.userText },
      ];

      let response;
      try {
        response = await client.beta.messages.parse({
          model: params.model,
          max_tokens: params.maxTokens,
          // Eine abgelehnte Anfrage läuft serverseitig auf dem empfohlenen Ausweichmodell erneut.
          // Wo ein Modell das nicht unterstützt, läuft sie einfach auf dem gewählten Modell.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: params.system,
          messages: [{ role: "user", content }],
          output_config: { format: zodOutputFormat(params.schema), effort: params.effort },
        });
      } catch (error) {
        throw describeApiError(error);
      }

      const usage = {
        tokensIn:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        tokensOut: response.usage.output_tokens,
      };

      if (response.stop_reason === "refusal") {
        throw new AiRefusalError(
          "Die KI hat diese Anfrage aus Sicherheitsgründen abgelehnt. Bitte die Eingaben des Leads prüfen.",
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new AiValidationError("Die Antwort wurde abgeschnitten.", usage);
      }
      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AiValidationError("Die Antwort entsprach nicht dem geforderten Format.", usage);
      }

      return { output: response.parsed_output as T, model: response.model, ...usage };
    },
  };
}
