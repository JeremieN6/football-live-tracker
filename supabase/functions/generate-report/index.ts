import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchRow {
  id: string
  home_team: string
  away_team: string
  competition: string
  date: string
}

interface EventRow {
  type: string
  minute: number
  half: number
  zone_x: string | null
  zone_y: string | null
  player_in: string | null
  player_out: string | null
}

interface MatchStats {
  goalsFor: number
  goalsAgainst: number
  shotsOnTarget: number
  shotsOffTarget: number
  clearChances: number
  cornersFor: number
  cornersAgainst: number
  freeKicksFor: number
  freeKicksAgainst: number
  dangersSuffered: number
  yellowCards: number
  redCards: number
  substitutions: number
  totalEvents: number
}

type UnknownRecord = Record<string, unknown>
interface ReportContent {
  summary: string
  offensive: string
  defensive: string
  tactical: string
  improvements: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStats(events: EventRow[]): MatchStats {
  const count = (type: string) => events.filter((e) => e.type === type).length
  return {
    goalsFor: count("GOAL_FOR"),
    goalsAgainst: count("GOAL_AGAINST"),
    shotsOnTarget: count("SHOT_ON_TARGET"),
    shotsOffTarget: count("SHOT_OFF_TARGET"),
    clearChances: count("CHANCE_CLEAR"),
    cornersFor: count("CORNER_FOR"),
    cornersAgainst: count("CORNER_AGAINST"),
    freeKicksFor: count("FREE_KICK_FOR"),
    freeKicksAgainst: count("FREE_KICK_AGAINST"),
    dangersSuffered: count("DANGER_SUFFERED"),
    yellowCards: count("YELLOW_CARD"),
    redCards: count("RED_CARD"),
    substitutions: count("SUBSTITUTION"),
    totalEvents: events.length,
  }
}

function buildPrompt(match: MatchRow, stats: MatchStats, events: EventRow[]): string {
  const subLines = events
    .filter((e) => e.type === "SUBSTITUTION" && e.player_in && e.player_out)
    .map((e) => `  - ${e.minute}' : ${e.player_in} remplace ${e.player_out}`)
    .join("\n") || "  Aucun remplacement"

  const score = `${stats.goalsFor} - ${stats.goalsAgainst}`

  return `Tu es un analyste tactique de football. Analyse ce match amateur et génère un rapport structuré en JSON.

MATCH : ${match.home_team} vs ${match.away_team}
Compétition : ${match.competition}
Date : ${match.date}
Score final : ${score}

STATISTIQUES :
- Tirs cadrés : ${stats.shotsOnTarget}
- Tirs non cadrés : ${stats.shotsOffTarget}
- Occasions nettes : ${stats.clearChances}
- Corners (pour/contre) : ${stats.cornersFor} / ${stats.cornersAgainst}
- Coups francs (pour/contre) : ${stats.freeKicksFor} / ${stats.freeKicksAgainst}
- Dangers subis : ${stats.dangersSuffered}
- Cartons jaunes : ${stats.yellowCards}
- Cartons rouges : ${stats.redCards}
- Remplacements :
${subLines}

CONTRAINTES DE RÉPONSE :
- Répondre UNIQUEMENT en JSON valide avec exactement ces 5 clés
- Langue : français
- Ton : coach professionnel, direct et constructif
- Longueur : summary ~3 phrases, chaque section ~2-3 phrases, 3 axes d'amélioration

FORMAT JSON ATTENDU :
{
  "summary": "Résumé global du match en 3 phrases",
  "offensive": "Analyse du jeu offensif en 2-3 phrases",
  "defensive": "Analyse du jeu défensif en 2-3 phrases",
  "tactical": "Lecture tactique globale en 2-3 phrases",
  "improvements": ["Axe d'amélioration 1", "Axe d'amélioration 2", "Axe d'amélioration 3"]
}`
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as UnknownRecord).message
    if (typeof message === "string" && message.length > 0) return message
  }
  return fallback
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function normalizeImprovements(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 5)
}

function buildFallbackReport(match: MatchRow, stats: MatchStats): ReportContent {
  const summary =
    `${match.home_team} termine le match sur un score de ${stats.goalsFor}-${stats.goalsAgainst}. ` +
    `L'equipe a produit ${stats.shotsOnTarget + stats.shotsOffTarget} tirs dont ${stats.shotsOnTarget} cadres. ` +
    `La base de donnees d'evenements est exploitable, mais il faut enrichir le tracking pour une analyse plus fine.`

  const offensive =
    `L'animation offensive montre ${stats.shotsOnTarget} tirs cadres et ${stats.clearChances} occasion(s) nette(s). ` +
    `Avec ${stats.cornersFor} corner(s) obtenu(s), la production existe mais peut gagner en constance dans le dernier tiers.`

  const defensive =
    `Defensivement, l'equipe concède ${stats.goalsAgainst} but(s) et ${stats.cornersAgainst} corner(s). ` +
    `Le volume de dangers subis (${stats.dangersSuffered}) reste contenu, ce qui suggere une structure globalement stable.`

  const tactical =
    `Le rapport tactique est base sur ${stats.totalEvents} evenement(s) saisi(s). ` +
    `Pour augmenter la precision des recommandations, il faut tracer davantage les sequences defensives/offensives et les coups de pied arretes.`

  const improvements = [
    "Augmenter le volume de tirs cadres en travaillant la derniere passe et la qualite de finition.",
    "Documenter plus d'evenements de transition pour affiner la lecture tactique du rapport.",
    "Structurer les phases arretees (corners/coups francs) pour gagner en regularite offensive.",
  ]

  return { summary, offensive, defensive, tactical, improvements }
}

function normalizeReportContent(parsed: unknown, match: MatchRow, stats: MatchStats): ReportContent {
  const fallback = buildFallbackReport(match, stats)
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as UnknownRecord

  // Accepte quelques variantes de cles possibles renvoyees par le modele.
  const summary =
    nonEmptyString(obj.summary) ??
    nonEmptyString(obj.resume) ??
    fallback.summary

  const offensive =
    nonEmptyString(obj.offensive) ??
    nonEmptyString(obj.attack) ??
    nonEmptyString(obj.offense) ??
    fallback.offensive

  const defensive =
    nonEmptyString(obj.defensive) ??
    nonEmptyString(obj.defense) ??
    fallback.defensive

  const tactical =
    nonEmptyString(obj.tactical) ??
    nonEmptyString(obj.tactique) ??
    nonEmptyString(obj.strategy) ??
    fallback.tactical

  const improvements = normalizeImprovements(obj.improvements)
  const finalImprovements = improvements.length > 0 ? improvements : fallback.improvements

  return {
    summary,
    offensive,
    defensive,
    tactical,
    improvements: finalImprovements,
  }
}

async function fetchAvailableAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
  })

  if (!res.ok) {
    return []
  }

  const payload = await res.json() as {
    data?: Array<{ id?: unknown }>
  }

  return (payload.data ?? [])
    .map((m) => (typeof m.id === "string" ? m.id : null))
    .filter((id): id is string => Boolean(id))
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { matchId } = await req.json() as { matchId: string }
    if (!matchId) throw new Error("matchId requis")

    // Client admin (contourne RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Vérifier l'utilisateur authentifié
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Non autorisé")

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) throw new Error("Non autorisé")

    // Vérifier que le match appartient à l'utilisateur
    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, home_team, away_team, competition, date")
      .eq("id", matchId)
      .eq("created_by", user.id)
      .single()
    if (matchError || !match) {
      throw new Error(toErrorMessage(matchError, "Match introuvable"))
    }

    // Récupérer les événements
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("events")
      .select("type, minute, half, zone_x, zone_y, player_in, player_out")
      .eq("match_id", matchId)
      .order("minute", { ascending: true })
    if (eventsError) throw new Error(toErrorMessage(eventsError, "Erreur chargement evenements"))

    // Construire les stats et le prompt
    const stats = buildStats((events ?? []) as EventRow[])
    const prompt = buildPrompt(match as MatchRow, stats, (events ?? []) as EventRow[])

    // Appel Claude (Anthropic)
    // Priorite: secret ANTHROPIC_MODEL, puis fallback sur modeles courants.
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY non configurée dans les secrets Supabase")

    const configuredModel = Deno.env.get("ANTHROPIC_MODEL")
    const preferredModels = [
      configuredModel,
      // Modeles observes comme disponibles sur ce projet Anthropic
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-opus-4-5-20251101",
      "claude-opus-4-6",
      "claude-opus-4-7",
    ].filter((m): m is string => Boolean(m))

    const availableModels = await fetchAvailableAnthropicModels(anthropicKey)
    const modelsToTry = availableModels.length > 0
      ? preferredModels.filter((m) => availableModels.includes(m))
      : preferredModels

    if (modelsToTry.length === 0) {
      const availablePreview = availableModels.length > 0
        ? availableModels.slice(0, 8).join(", ")
        : "Aucun modele liste via /v1/models"
      throw new Error(`Aucun modele compatible trouve. Modeles disponibles: ${availablePreview}`)
    }

    let claudeRes: Response | null = null
    let lastErrorText = ""

    for (const model of modelsToTry) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (res.ok) {
        claudeRes = res
        break
      }

      const errText = await res.text()
      lastErrorText = `Anthropic error ${res.status} (model ${model}): ${errText}`

      // Si le modele est introuvable, on tente le suivant.
      if (res.status === 404) {
        continue
      }

      throw new Error(lastErrorText)
    }

    if (!claudeRes) {
      throw new Error(lastErrorText || "Aucun modele Anthropic valide disponible")
    }

    const claudeData = await claudeRes.json() as {
      content: Array<{ type: string; text: string }>
    }
    const rawText = claudeData.content[0].text
    // Extraire le JSON (Claude peut ajouter du texte autour dans de rares cas)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Réponse Claude invalide : JSON introuvable")
    const parsedContent = JSON.parse(jsonMatch[0])
    const content = normalizeReportContent(parsedContent, match as MatchRow, stats)

    // Sauvegarder le rapport (insert ou update si existe déjà)
    const { data: existingReport } = await supabaseAdmin
      .from("reports")
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle()

    let savedReport
    if (existingReport) {
      const { data, error } = await supabaseAdmin
        .from("reports")
        .update({ content })
        .eq("match_id", matchId)
        .select()
        .single()
      if (error) throw new Error(toErrorMessage(error, "Erreur update report"))
      savedReport = data
    } else {
      const { data, error } = await supabaseAdmin
        .from("reports")
        .insert({ match_id: matchId, content })
        .select()
        .single()
      if (error) throw new Error(toErrorMessage(error, "Erreur insert report"))
      savedReport = data
    }

    return new Response(JSON.stringify({ report: savedReport, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    console.error("generate-report error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
