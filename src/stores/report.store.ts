import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportContent {
  summary: string
  offensive: string
  defensive: string
  tactical: string
  improvements: string[]
}

export interface Report {
  id: string
  matchId: string
  content: ReportContent
  createdBy: string
  createdAt: string
}

export interface ReportStats {
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function parseReportContent(raw: unknown): ReportContent {
  const fallback: ReportContent = {
    summary: 'Analyse indisponible pour le moment.',
    offensive: 'Analyse indisponible pour le moment.',
    defensive: 'Analyse indisponible pour le moment.',
    tactical: 'Analyse indisponible pour le moment.',
    improvements: ['Relancer la génération du rapport pour obtenir les axes d\'amélioration.'],
  }

  let parsed: unknown = raw

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return fallback
  }

  const content = parsed as Record<string, unknown>
  const improvements = Array.isArray(content.improvements)
    ? content.improvements
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
    : []

  return {
    summary: nonEmptyString(content.summary) || fallback.summary,
    offensive: nonEmptyString(content.offensive) || fallback.offensive,
    defensive: nonEmptyString(content.defensive) || fallback.defensive,
    tactical: nonEmptyString(content.tactical) || fallback.tactical,
    improvements: improvements.length > 0 ? improvements : fallback.improvements,
  }
}

function rowToReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    content: parseReportContent(row.content),
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

async function extractFunctionErrorMessage(err: unknown): Promise<string> {
  if (err instanceof Error) {
    const maybeWithContext = err as Error & {
      context?: {
        json?: () => Promise<unknown>
        text?: () => Promise<string>
      }
    }

    if (maybeWithContext.context?.json) {
      try {
        const payload = await maybeWithContext.context.json()
        if (payload && typeof payload === 'object' && 'error' in payload) {
          const fnError = (payload as { error?: unknown }).error
          if (typeof fnError === 'string' && fnError.length > 0) {
            return fnError
          }
        }
      } catch {
        // Fallback sur message natif
      }
    }

    if (maybeWithContext.context?.text) {
      try {
        const text = await maybeWithContext.context.text()
        if (text && text.length > 0) {
          return text
        }
      } catch {
        // Fallback sur message natif
      }
    }

    return err.message
  }

  return 'Erreur lors de la génération du rapport.'
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useReportStore = defineStore('report', () => {
  const report = ref<Report | null>(null)
  const loading = ref(false)
  const generating = ref(false)
  const error = ref<string | null>(null)

  async function fetchReport(matchId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('reports')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle()
      if (sbError) throw sbError
      report.value = data ? rowToReport(data as Record<string, unknown>) : null
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du rapport.'
    } finally {
      loading.value = false
    }
  }

  async function generateReport(matchId: string): Promise<ReportStats | null> {
    generating.value = true
    error.value = null
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        report: Record<string, unknown>
        stats: ReportStats
      }>('generate-report', {
        body: { matchId },
      })
      if (fnError) throw fnError
      if (!data) throw new Error('Réponse vide de la fonction.')
      report.value = rowToReport(data.report)
      return data.stats
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err)
      error.value = message
      throw new Error(message)
    } finally {
      generating.value = false
    }
  }

  function reset() {
    report.value = null
    error.value = null
  }

  return { report, loading, generating, error, fetchReport, generateReport, reset }
})
