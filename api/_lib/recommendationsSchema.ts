import { z } from 'zod'
import { Type, type FunctionDeclaration } from './genai.js'

/**
 * Not a chat — a pushed batch of suggestions. The GM clicks one button and
 * gets a short, prioritized list of things to consider before/during the
 * next session, generated from the campaign's actual current state (recent
 * timeline, active quests, known NPCs, party). No back-and-forth, no
 * memory of a conversation — every call is a fresh read of the live state.
 */
export const recommendationCategorySchema = z.enum(['quest', 'npc', 'pacing', 'worldbuilding', 'combat'])

export const recommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        category: recommendationCategorySchema,
        title: z.string().min(1).max(100),
        detail: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(6),
})

export type Recommendations = z.infer<typeof recommendationsSchema>

export const RECORD_RECOMMENDATIONS_TOOL: FunctionDeclaration = {
  name: 'record_recommendations',
  description:
    'Record 3-6 concrete, prioritized recommendations for the GM ahead of the next session, based only on ' +
    'the campaign state given in context. Favor specific, actionable suggestions over generic advice — ' +
    'reference actual NPCs, quests, and locations by name.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      recommendations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ['quest', 'npc', 'pacing', 'worldbuilding', 'combat'],
              description:
                'quest = advance/complicate an active quest, npc = bring back or develop a known NPC, ' +
                'pacing = session-structure advice, worldbuilding = new detail/hook for the setting, ' +
                'combat = an encounter idea.',
            },
            title: { type: Type.STRING, description: 'A short, scannable headline (< 10 words).' },
            detail: { type: Type.STRING, description: '1-3 sentences, specific and actionable.' },
          },
          required: ['category', 'title', 'detail'],
        },
      },
    },
    required: ['recommendations'],
  },
}
