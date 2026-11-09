// Telemetrie de couts vers Sassify Ops (pilotage) pour les Edge Functions Supabase.
// Adaptation de ops/clients/ops-cost.ts (copie canonique) : Anthropic uniquement, sans circuit breaker (les isolats sont courts).
//
// Secrets Supabase a definir (sans effet si absents) : OPS_URL (ex: https://pilotage.sassify.fr) et OPS_INGEST_KEY.
// Regle d'or : ne jamais casser ni ralentir la fonction. Aucune erreur ne remonte, timeout de 3 s ; l'appelant peut
// attendre la promesse en fin de requete (un isolat peut etre arrete des que la reponse est envoyee).

export type OpsConfig = { url?: string | null; key?: string | null }

type Obj = Record<string, unknown>
const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {})
const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined)

/** Construit l'evenement de cout d'une reponse Anthropic /v1/messages ; null pour une erreur ou un corps vide. */
export function anthropicCostEvent(project: string, message: unknown, meta?: Record<string, unknown>) {
  const body = obj(message)
  if (!message || typeof message !== "object" || body.type === "error" || body.error !== undefined) {
    return null
  }
  const usage = obj(body.usage)
  const model = str(body.model) ?? "unknown"
  const llm = Object.keys(usage).length === 0
    ? { model }
    : {
      model,
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      cacheReadTokens: num(usage.cache_read_input_tokens),
      cacheWriteTokens: num(usage.cache_creation_input_tokens),
    }
  return { project, provider: "anthropic", llm, meta }
}

/** Envoie l'usage d'une reponse Anthropic a Sassify Ops. Ne leve jamais d'erreur. */
export async function trackAnthropicUsage(
  config: OpsConfig,
  project: string,
  message: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const url = (config.url ?? "").trim()
    const key = (config.key ?? "").trim()
    if (!url || !key) return
    const event = anthropicCostEvent(project, message, meta)
    if (!event) return
    await fetch(`${url.replace(/\/$/, "")}/api/ingest/cost`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ops-key": key },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // la telemetrie n'a jamais le droit de casser la fonction
  }
}
