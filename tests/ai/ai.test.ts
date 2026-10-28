import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getAiConfig, resolveModel, type AiConfig } from "@/lib/ai/config";
import { estimateCostEur, estimateMaxCostEur, priceFor } from "@/lib/ai/pricing";
import { runAiStep } from "@/lib/ai/run-step";
import {
  AiBudgetError,
  AiConfigError,
  AiProviderError,
  AiRefusalError,
  AiValidationError,
  type AiCallParams,
  type AiProvider,
} from "@/lib/ai/types";

const config: AiConfig = {
  apiKey: "test-key-not-real-0987654321",
  models: { capable: "claude-opus-5-5", cheap: "claude-haiku-5-5" },
  maxRunsPerHour: 3,
  maxCostPerRunEur: 1,
  maxCostPerDemoEur: 2,
  usdEurRate: 0.92,
};

const schema = z.object({ antwort: z.string() });

function fakeSupabase(callsLastHour: number | null) {
  const inserted: { table: string; row: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({
        like: () => ({
          gte: async () =>
            callsLastHour === null
              ? { count: null, error: { message: "kaputt" } }
              : { count: callsLastHour, error: null },
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, row });
        return { error: null };
      },
    }),
  };
  return { inserted, client: client as never };
}

const base = (supabase: never, provider: AiProvider, overrides = {}) => ({
  supabase,
  userId: "user-1",
  step: "test",
  entityType: "lead",
  entityId: "lead-1",
  tier: "capable" as const,
  system: "System",
  userText: "Frage",
  schema,
  config,
  provider,
  ...overrides,
});

const ok = (usage = { tokensIn: 1000, tokensOut: 200 }): AiProvider => ({
  call: async <T,>(params: AiCallParams<T>) => ({
    output: { antwort: "ja" } as T,
    model: params.model,
    ...usage,
  }),
});

describe("Preise", () => {
  it("kennt aktuelle Modelle und findet datierte Varianten per Präfix", () => {
    expect(priceFor("claude-opus-5-5")).toEqual({ input: 4, output: 20 });
    expect(priceFor("claude-haiku-5-5")).toEqual({ input: 0.1, output: 0.5 });
    expect(priceFor("claude-opus-5-5-20261001")).toEqual({ input: 4, output: 20 });
  });

  it("wählt für Modelle mit gemeinsamem Präfix den längsten Treffer", () => {
    expect(priceFor("claude-opus-5")).toEqual({ input: 5, output: 25 });
    expect(priceFor("claude-opus-5-5")).not.toEqual(priceFor("claude-opus-5"));
  });

  it("setzt unbekannte Modelle auf den höchsten bekannten Preis", () => {
    expect(priceFor("irgendein-neues-modell")).toEqual({ input: 10, output: 50 });
  });

  it("rechnet Token in Euro um", () => {
    // 1 Mio. Eingabe + 1 Mio. Ausgabe auf Opus 5.5 = 4 + 20 = 24 USD → 22,08 EUR
    expect(estimateCostEur("claude-opus-5-5", { tokensIn: 1e6, tokensOut: 1e6 }, 0.92)).toBeCloseTo(22.08, 5);
  });

  it("schätzt den teuersten Fall inklusive Bilder und voller Ausgabe", () => {
    const cost = estimateMaxCostEur({ model: "claude-opus-5-5", textChars: 30_000, imageCount: 1, maxTokens: 4000, usdEurRate: 1 });
    // Eingabe 10.000 + 2.000 Token · 4 $/M + 4.000 Ausgabe · 20 $/M = 0,048 + 0,08
    expect(cost).toBeCloseTo(0.128, 5);
  });
});

describe("Konfiguration", () => {
  const env = {
    ANTHROPIC_API_KEY: "test-key-not-real-1234567890",
    AI_MODEL_CAPABLE: "claude-opus-5-5",
    AI_MODEL_CHEAP: "claude-haiku-5-5",
  };

  it("liest Modelle und Standardlimits aus der Umgebung", () => {
    const cfg = getAiConfig(env);
    expect(resolveModel("capable", cfg)).toBe("claude-opus-5-5");
    expect(resolveModel("cheap", cfg)).toBe("claude-haiku-5-5");
    expect(cfg.maxRunsPerHour).toBe(20);
    expect(cfg.maxCostPerRunEur).toBe(1);
  });

  it("behandelt leere optionale Werte wie nicht gesetzt", () => {
    expect(getAiConfig({ ...env, AI_MAX_RUNS_PER_HOUR: "", AI_MAX_COST_PER_RUN_EUR: " " }).maxRunsPerHour).toBe(20);
  });

  it("nennt fehlende Variablen beim Namen", () => {
    expect(() => getAiConfig({ AI_MODEL_CAPABLE: "x-modell" })).toThrow(AiConfigError);
    expect(() => getAiConfig({ AI_MODEL_CAPABLE: "x-modell" })).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("runAiStep", () => {
  it("liefert das Ergebnis und protokolliert Modell, Kosten und Eingabe im audit_log", async () => {
    const { client, inserted } = fakeSupabase(0);
    const result = await runAiStep(base(client, ok()));
    expect(result.output).toEqual({ antwort: "ja" });
    expect(result.model).toBe("claude-opus-5-5");
    expect(result.costEur).toBeGreaterThan(0);

    expect(inserted).toHaveLength(1);
    const row = inserted[0].row;
    expect(inserted[0].table).toBe("audit_log");
    expect(row).toMatchObject({
      actor: "SYSTEM_AI",
      user_id: "user-1",
      action_type: "ai.test",
      entity_type: "lead",
      entity_id: "lead-1",
      model_used: "claude-opus-5-5",
      requires_approval: false,
    });
    expect(row.cost_estimate).toBe(result.costEur);
    expect(row.output).toEqual({ antwort: "ja" });
    expect((row.input as { attempts: number }).attempts).toBe(1);
  });

  it("wählt das Modell aus dem Tier", async () => {
    const { client } = fakeSupabase(0);
    const seen: string[] = [];
    const provider: AiProvider = {
      call: async <T,>(p: AiCallParams<T>) => {
        seen.push(p.model);
        return { output: { antwort: "x" } as T, model: p.model, tokensIn: 1, tokensOut: 1 };
      },
    };
    await runAiStep(base(client, provider, { tier: "cheap" }));
    expect(seen).toEqual(["claude-haiku-5-5"]);
  });

  it("lehnt ab, wenn das Stunden-Limit erreicht ist, ohne die KI aufzurufen", async () => {
    const { client, inserted } = fakeSupabase(3);
    const call = vi.fn();
    await expect(runAiStep(base(client, { call }))).rejects.toThrow(AiBudgetError);
    expect(call).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("lehnt ab, wenn das Limit nicht geprüft werden kann", async () => {
    const { client } = fakeSupabase(null);
    const call = vi.fn();
    await expect(runAiStep(base(client, { call }))).rejects.toThrow(AiBudgetError);
    expect(call).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn der teuerste Fall den Kostendeckel überschreitet", async () => {
    const { client } = fakeSupabase(0);
    const call = vi.fn();
    const strict = { ...config, maxCostPerRunEur: 0.01 };
    await expect(runAiStep(base(client, { call }, { config: strict }))).rejects.toThrow(/Kostendeckel/);
    expect(call).not.toHaveBeenCalled();
  });

  it("wiederholt bei ungültigem Format genau einmal mit Korrekturhinweis und addiert die Kosten", async () => {
    const { client, inserted } = fakeSupabase(0);
    const texts: string[] = [];
    let n = 0;
    const provider: AiProvider = {
      call: async <T,>(p: AiCallParams<T>) => {
        texts.push(p.userText);
        if (++n === 1) throw new AiValidationError("kein JSON", { tokensIn: 500, tokensOut: 50 });
        return { output: { antwort: "ok" } as T, model: p.model, tokensIn: 500, tokensOut: 50 };
      },
    };
    const result = await runAiStep(base(client, provider));
    expect(result.output).toEqual({ antwort: "ok" });
    expect(texts[0]).toBe("Frage");
    expect(texts[1]).toContain("nicht verwertbar");
    expect((inserted[0].row.input as { attempts: number }).attempts).toBe(2);
    // beide Versuche kosten Geld
    expect(result.costEur).toBeCloseTo(estimateCostEur("claude-opus-5-5", { tokensIn: 1000, tokensOut: 100 }, 0.92), 8);
  });

  it("bricht nach dem zweiten ungültigen Ergebnis ab und protokolliert den Fehler", async () => {
    const { client, inserted } = fakeSupabase(0);
    const call = vi.fn(async () => {
      throw new AiValidationError("kaputt", { tokensIn: 100, tokensOut: 10 });
    });
    await expect(runAiStep(base(client, { call }))).rejects.toThrow(AiValidationError);
    expect(call).toHaveBeenCalledTimes(2);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].row.output).toEqual({ error: "kaputt" });
    expect(inserted[0].row.cost_estimate).toBeGreaterThan(0);
  });

  it("wiederholt Ablehnungen und Anbieterfehler nicht, protokolliert sie aber", async () => {
    for (const error of [new AiRefusalError("abgelehnt"), new AiProviderError("Netz weg")]) {
      const { client, inserted } = fakeSupabase(0);
      const call = vi.fn(async () => {
        throw error;
      });
      await expect(runAiStep(base(client, { call }))).rejects.toThrow(error.message);
      expect(call).toHaveBeenCalledTimes(1);
      expect(inserted[0].row.output).toEqual({ error: error.message });
    }
  });

  it("kürzt sehr lange Eingaben im Protokoll", async () => {
    const { client, inserted } = fakeSupabase(0);
    await runAiStep(base(client, ok(), { userText: "a".repeat(50_000), config: { ...config, maxCostPerRunEur: 100 } }));
    expect((inserted[0].row.input as { user: string }).user.length).toBe(8000);
  });
});
