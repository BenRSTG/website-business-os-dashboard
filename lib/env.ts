import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .refine((v) => !v.includes("/rest/v1"), {
      message: "Basis-URL ohne /rest/v1/ angeben",
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

// NEXT_PUBLIC_*-Variablen müssen einzeln referenziert werden, damit Next.js sie
// in den Client-Bundle einsetzt — daher kein `process.env` als Ganzes.
export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
