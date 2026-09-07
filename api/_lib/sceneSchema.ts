import { z } from 'zod'
import { Type, type FunctionDeclaration } from './genai.js'

/**
 * A drafted scene for the GM to edit — original content in the campaign's
 * flavor, never a reproduction of a published adventure. Validated with zod
 * before anything touches the database.
 */
export const sceneSchema = z.object({
  title: z.string().min(1).max(120),
  readAloud: z.string().min(1).max(1200),
  gmNotes: z.string().min(1).max(1500),
  encounter: z.string().max(400).default(''),
})

export type GeneratedScene = z.infer<typeof sceneSchema>

export const RECORD_SCENE_TOOL: FunctionDeclaration = {
  name: 'record_scene',
  description:
    'Draft one scene of a tabletop RPG scenario from the GM\'s one-line premise and the campaign context. ' +
    'Original content in the genre and tone of the system — never reproduce a published adventure, named ' +
    'IP, or copyrighted text. Reuse the exact names of NPCs and locations already known to the campaign ' +
    'when the premise involves them.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A short evocative scene title.' },
      readAloud: {
        type: Type.STRING,
        description: 'Boxed text the GM reads aloud when the scene begins — 2-4 sentences, second person, present tense, sensory.',
      },
      gmNotes: {
        type: Type.STRING,
        description:
          'Secret prep for the GM only: what is really going on, what the NPCs want, hidden details, ' +
          'possible outcomes. 3-6 sentences.',
      },
      encounter: {
        type: Type.STRING,
        description: 'A one-line encounter if the scene calls for one (e.g. "Melric + 3 bandits, hostile"), else empty.',
      },
    },
    required: ['title', 'readAloud', 'gmNotes'],
  },
}
