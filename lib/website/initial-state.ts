import { DEFAULT_FEATURES, normalizeFeatures } from "./features";
import { normalizeOptions } from "./options";
import { restrictFeatures } from "./packages";
import type { RunState } from "./pipeline";

export interface DemoRequest {
  features?: string[];
  package?: string;
  style?: string | null;
  scheme?: string | null;
}

/** Zwischenstand zu Beginn eines Laufs. Bausteine, die das Paket nicht enthält, entfallen hier serverseitig. */
export function initialState(request: DemoRequest): RunState {
  const options = normalizeOptions({ package: request.package, style: request.style, scheme: request.scheme });
  const wanted = request.features === undefined ? DEFAULT_FEATURES : normalizeFeatures(request.features);
  return { options, features: restrictFeatures(wanted, options.package) };
}
