import type { CampaignStatus } from '@/types/database'

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  setup: 'En préparation',
  active: 'En cours',
  completed: 'Terminée',
}

export const CAMPAIGN_STATUS_BADGE_VARIANT: Record<CampaignStatus, 'arcane' | 'success' | 'neutral'> = {
  setup: 'arcane',
  active: 'success',
  completed: 'neutral',
}
