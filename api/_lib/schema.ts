import { z } from 'zod'

/**
 * Shape Claude must fill via forced tool_use. Validated with zod before we
 * trust any of it — model output is untrusted input just like a client
 * request, so it gets the same structural validation before touching the
 * database.
 */
export const campaignUpdateSchema = z.object({
  narrativeRecap: z.string().min(1).max(2000),
  timelineEvents: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
        tags: z.array(z.string().max(30)).max(6).default([]),
        locationName: z.string().max(120).nullable().default(null),
      }),
    )
    .max(10)
    .default([]),
  npcs: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
        disposition: z.enum(['ally', 'neutral', 'enemy', 'unknown']).default('unknown'),
      }),
    )
    .max(10)
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
      }),
    )
    .max(10)
    .default([]),
  quests: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
        status: z.enum(['active', 'completed', 'failed']).default('active'),
      }),
    )
    .max(10)
    .default([]),
  itemChanges: z
    .array(
      z.object({
        characterName: z.string().min(1).max(120),
        itemName: z.string().min(1).max(120),
        quantityDelta: z.number().int().min(-99).max(99),
        action: z.enum(['add', 'remove', 'equip', 'unequip']),
        description: z.string().max(300).nullable().default(null),
      }),
    )
    .max(20)
    .default([]),
})

export type CampaignUpdate = z.infer<typeof campaignUpdateSchema>

export const RECORD_CAMPAIGN_UPDATE_TOOL = {
  name: 'record_campaign_update',
  description:
    'Record everything from this session note into the campaign chronicle: a short narrative recap, ' +
    'new/ongoing timeline events, NPCs encountered, locations discovered, quest progress, and any ' +
    'inventory changes for named party members. Only include entities actually mentioned in the note.',
  input_schema: {
    type: 'object' as const,
    properties: {
      narrativeRecap: {
        type: 'string',
        description: 'A short (2-4 sentence) narrated recap of this note, in an evocative campaign-log voice.',
      },
      timelineEvents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            locationName: { type: ['string', 'null'] },
          },
          required: ['title', 'description'],
        },
      },
      npcs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            disposition: { type: 'string', enum: ['ally', 'neutral', 'enemy', 'unknown'] },
          },
          required: ['name', 'description'],
        },
      },
      locations: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, description: { type: 'string' } },
          required: ['name', 'description'],
        },
      },
      quests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'failed'] },
          },
          required: ['title', 'description'],
        },
      },
      itemChanges: {
        type: 'array',
        description: 'Only for characters that already exist in the party roster given in context.',
        items: {
          type: 'object',
          properties: {
            characterName: { type: 'string' },
            itemName: { type: 'string' },
            quantityDelta: { type: 'number', description: 'Positive to add, negative to remove.' },
            action: { type: 'string', enum: ['add', 'remove', 'equip', 'unequip'] },
            description: { type: ['string', 'null'] },
          },
          required: ['characterName', 'itemName', 'quantityDelta', 'action'],
        },
      },
    },
    required: ['narrativeRecap', 'timelineEvents', 'npcs', 'locations', 'quests', 'itemChanges'],
  },
}
