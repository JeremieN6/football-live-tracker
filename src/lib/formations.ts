export type FormationId = '4-4-2' | '4-3-3' | '3-5-2'
export type LineupRoleLetter = 'G' | 'D' | 'M' | 'A'

export interface FormationSlot {
  id: string
  label: string
  role: LineupRoleLetter
  x: number
  y: number
}

export const FORMATIONS: Record<FormationId, FormationSlot[]> = {
  '4-4-2': [
    { id: 'g', role: 'G', label: 'G', x: 50, y: 90 },
    { id: 'dg', role: 'D', label: 'DG', x: 15, y: 72 },
    { id: 'dcg', role: 'D', label: 'DC', x: 38, y: 76 },
    { id: 'dcd', role: 'D', label: 'DC', x: 62, y: 76 },
    { id: 'dd', role: 'D', label: 'DD', x: 85, y: 72 },
    { id: 'mg', role: 'M', label: 'MG', x: 15, y: 48 },
    { id: 'mcg', role: 'M', label: 'MC', x: 38, y: 52 },
    { id: 'mcd', role: 'M', label: 'MC', x: 62, y: 52 },
    { id: 'md', role: 'M', label: 'MD', x: 85, y: 48 },
    { id: 'ag', role: 'A', label: 'AT', x: 37, y: 20 },
    { id: 'ad', role: 'A', label: 'AT', x: 63, y: 20 },
  ],
  '4-3-3': [
    { id: 'g', role: 'G', label: 'G', x: 50, y: 90 },
    { id: 'dg', role: 'D', label: 'DG', x: 15, y: 72 },
    { id: 'dcg', role: 'D', label: 'DC', x: 38, y: 76 },
    { id: 'dcd', role: 'D', label: 'DC', x: 62, y: 76 },
    { id: 'dd', role: 'D', label: 'DD', x: 85, y: 72 },
    { id: 'mdef', role: 'M', label: 'MDC', x: 50, y: 58 },
    { id: 'mcg', role: 'M', label: 'MC', x: 28, y: 45 },
    { id: 'mcd', role: 'M', label: 'MC', x: 72, y: 45 },
    { id: 'ag', role: 'A', label: 'AG', x: 16, y: 22 },
    { id: 'av', role: 'A', label: 'BU', x: 50, y: 15 },
    { id: 'ad', role: 'A', label: 'AD', x: 84, y: 22 },
  ],
  '3-5-2': [
    { id: 'g', role: 'G', label: 'G', x: 50, y: 90 },
    { id: 'dcg', role: 'D', label: 'DC', x: 25, y: 76 },
    { id: 'dcc', role: 'D', label: 'DC', x: 50, y: 78 },
    { id: 'dcd', role: 'D', label: 'DC', x: 75, y: 76 },
    { id: 'pg', role: 'M', label: 'PG', x: 12, y: 55 },
    { id: 'mcg', role: 'M', label: 'MC', x: 33, y: 58 },
    { id: 'mcc', role: 'M', label: 'MC', x: 50, y: 50 },
    { id: 'mcd', role: 'M', label: 'MC', x: 67, y: 58 },
    { id: 'pd', role: 'M', label: 'PD', x: 88, y: 55 },
    { id: 'ag', role: 'A', label: 'AT', x: 37, y: 20 },
    { id: 'ad', role: 'A', label: 'AT', x: 63, y: 20 },
  ],
}

export const ROLE_COLORS: Record<LineupRoleLetter, { fg: string; bg: string; border: string }> = {
  G: { fg: '#FBBF24', bg: '#451a03', border: '#78716c' },
  D: { fg: '#60A5FA', bg: '#172554', border: '#1e40af' },
  M: { fg: '#4ADE80', bg: '#052e16', border: '#166534' },
  A: { fg: '#F87171', bg: '#450a0a', border: '#7f1d1d' },
}

export function isFormationId(value: string | null | undefined): value is FormationId {
  return value === '4-4-2' || value === '4-3-3' || value === '3-5-2'
}
