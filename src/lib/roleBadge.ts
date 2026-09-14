import type { MemberRole } from '@/stores/clubs.store'

// Styles des badges de rôle (voir handoff design, 01-tokens.md — valeurs normatives).
// Réutilisé partout où un rôle `club_members.role` est affiché (Home, Club, Membres).
export interface RoleBadgeStyle {
  label: string
  bg: string
  border: string
  fg: string
  icon: 'crown' | 'clipboard-list' | 'user-check' | 'landmark' | 'layers' | 'footprints' | 'user' | 'briefcase'
}

export const ROLE_BADGES: Record<MemberRole, RoleBadgeStyle> = {
  OWNER: { label: 'OWNER', bg: '#1e1033', border: '#7c3aed', fg: '#a78bfa', icon: 'crown' },
  COACH: { label: 'COACH', bg: '#052e16', border: '#166534', fg: '#4ADE80', icon: 'clipboard-list' },
  ADJOINT: { label: 'ADJOINT', bg: '#0c2340', border: '#1e40af', fg: '#60A5FA', icon: 'user-check' },
  PRESIDENT: { label: 'PRESIDENT', bg: '#1c1917', border: '#78716c', fg: '#d6d3d1', icon: 'landmark' },
  DIRIGEANT: { label: 'DIRIGEANT', bg: '#1c1917', border: '#78716c', fg: '#d6d3d1', icon: 'briefcase' },
  CATEGORY_MANAGER: { label: 'RESPONSABLE', bg: '#172554', border: '#1d4ed8', fg: '#93C5FD', icon: 'layers' },
  PLAYER: { label: 'JOUEUR', bg: '#1c1917', border: '#374151', fg: '#9CA3AF', icon: 'footprints' },
  OTHER: { label: 'AUTRE', bg: '#1c1917', border: '#374151', fg: '#6B7280', icon: 'user' },
}
