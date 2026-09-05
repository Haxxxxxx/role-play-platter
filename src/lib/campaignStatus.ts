import type { CampaignStatus } from '@/types/database'

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  setup: 'En préparation',
  active: 'En cours',
  completed: 'Terminée',
}

export const CAMPAIGN_STATUS_BADGE_CLASS: Record<CampaignStatus, string> = {
  setup: 'border-arcane-500/50 text-arcane-500',
  active: 'border-emerald-500/50 text-emerald-400',
  completed: 'border-ink-700 text-parchment-200/50',
}
