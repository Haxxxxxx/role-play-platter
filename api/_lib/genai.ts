import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai'

// Gemini's free tier (a key from aistudio.google.com/apikey, no credit card)
// is what this app runs on instead of a paid key. Flash is the
// fast/cheap-eligible model — plenty for structured extraction like this.
export const GEMINI_MODEL = 'gemini-2.5-flash'

export { Type }
export type { FunctionDeclaration }

/**
 * Forces exactly one function call and returns its (already-parsed) args.
 * Every caller still runs the result through its own zod schema before
 * trusting it — model output is untrusted input regardless of provider.
 */
export async function generateForcedFunctionCall(params: {
  systemInstruction: string
  prompt: string
  functionDeclaration: FunctionDeclaration
}): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    config: {
      systemInstruction: params.systemInstruction,
      tools: [{ functionDeclarations: [params.functionDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [params.functionDeclaration.name!],
        },
      },
    },
  })

  const call = response.functionCalls?.[0]
  if (!call || !call.args) {
    throw new Error('Gemini did not return a structured function call.')
  }
  return call.args
}
