import { z } from 'zod'
import { Type, type FunctionDeclaration } from './genai.js'

/**
 * A starting point for character creation, not a transcription of a
 * rulebook — every name/description here must be Gemini's own original
 * wording in the spirit of the named system, never copied rules text. See
 * the system instruction in generate-system-reference.ts for the actual
 * constraint; this is just the shape it's forced into.
 */
export const systemReferenceSchema = z.object({
  classes: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(20),
  skills: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(30),
})

export type SystemReference = z.infer<typeof systemReferenceSchema>

export const RECORD_SYSTEM_REFERENCE_TOOL: FunctionDeclaration = {
  name: 'record_system_reference',
  description:
    'Record a genre-appropriate character class list and skill list for this campaign\'s RPG system, to seed ' +
    'character creation. Original wording only — never reproduce copyrighted rulebook text, class features, ' +
    'or exact skill lists verbatim; invent flavor-appropriate names and short descriptions instead.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      classes: {
        type: Type.ARRAY,
        description: '8-15 character classes/archetypes fitting this system\'s genre and tone.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: 'One short original sentence.' },
          },
          required: ['name', 'description'],
        },
      },
      skills: {
        type: Type.ARRAY,
        description: '12-24 skills characters in this system could plausibly have.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: 'One short original sentence.' },
          },
          required: ['name', 'description'],
        },
      },
    },
    required: ['classes', 'skills'],
  },
}
