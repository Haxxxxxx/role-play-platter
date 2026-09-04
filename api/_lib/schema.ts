import { z } from 'zod'
import { Type, type FunctionDeclaration } from './genai.js'

/**
 * Shape Gemini must fill via a forced function call. Validated with zod before we
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

export const RECORD_CAMPAIGN_UPDATE_TOOL: FunctionDeclaration = {
  name: 'record_campaign_update',
  description:
    'Record everything from this session note into the campaign chronicle: a short narrative recap, ' +
    'new/ongoing timeline events, NPCs encountered, locations discovered, quest progress, and any ' +
    'inventory changes for named party members. Only include entities actually mentioned in the note.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      narrativeRecap: {
        type: Type.STRING,
        description: 'A short (2-4 sentence) narrated recap of this note, in an evocative campaign-log voice.',
      },
      timelineEvents: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            locationName: { type: Type.STRING, nullable: true },
          },
          required: ['title', 'description'],
        },
      },
      npcs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            disposition: { type: Type.STRING, enum: ['ally', 'neutral', 'enemy', 'unknown'] },
          },
          required: ['name', 'description'],
        },
      },
      locations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
          required: ['name', 'description'],
        },
      },
      quests: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['active', 'completed', 'failed'] },
          },
          required: ['title', 'description'],
        },
      },
      itemChanges: {
        type: Type.ARRAY,
        description: 'Only for characters that already exist in the party roster given in context.',
        items: {
          type: Type.OBJECT,
          properties: {
            characterName: { type: Type.STRING },
            itemName: { type: Type.STRING },
            quantityDelta: { type: Type.NUMBER, description: 'Positive to add, negative to remove.' },
            action: { type: Type.STRING, enum: ['add', 'remove', 'equip', 'unequip'] },
            description: { type: Type.STRING, nullable: true },
          },
          required: ['characterName', 'itemName', 'quantityDelta', 'action'],
        },
      },
    },
    required: ['narrativeRecap', 'timelineEvents', 'npcs', 'locations', 'quests', 'itemChanges'],
  },
}
