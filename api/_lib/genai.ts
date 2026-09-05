import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai'

// Gemini's free tier (a key from aistudio.google.com/apikey, no credit card)
// is what this app runs on instead of a paid key. Flash is the
// fast/cheap-eligible model — plenty for structured extraction like this.
export const GEMINI_MODEL = 'gemini-3.6-flash'

// Image generation ("Nano Banana 2"). This one is NOT on the free tier —
// every image model returns limit: 0 without billing enabled on the Google
// Cloud project — so generate-portrait.ts translates the resulting 429 into
// a clear "enable billing" message rather than a cryptic failure.
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'

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

/** Plain freeform text generation on the free-tier text model. */
export async function generateText(params: { systemInstruction: string; prompt: string }): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    config: { systemInstruction: params.systemInstruction },
  })
  const text = response.text?.trim()
  if (!text) throw new Error('Gemini returned no text.')
  return text
}

/**
 * One image out of the image model. Billing-only (see GEMINI_IMAGE_MODEL) —
 * the caller is expected to catch the quota error and explain it. Returns
 * the raw bytes plus the mime type the model chose.
 */
export async function generateImage(prompt: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseModalities: ['IMAGE'] },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    const inline = part.inlineData
    if (inline?.data) {
      return { bytes: Buffer.from(inline.data, 'base64'), mimeType: inline.mimeType ?? 'image/png' }
    }
  }
  throw new Error('Gemini did not return an image.')
}
