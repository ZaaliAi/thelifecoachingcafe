
'use server';

/**
 * @fileOverview Suggests relevant keywords and specialties based on a coach's bio.
 *
 * - suggestCoachSpecialties - A function that handles the suggestion of coach specialties.
 * - SuggestCoachSpecialtiesInput - The input type for the suggestCoachSpecialties function.
 * - SuggestCoachSpecialtiesOutput - The return type for the suggestCoachSpecialties function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCoachSpecialtiesInputSchema = z.object({
  bio: z.string().describe('The bio of the coach.'),
});
export type SuggestCoachSpecialtiesInput = z.infer<
  typeof SuggestCoachSpecialtiesInputSchema
>;

const SuggestCoachSpecialtiesOutputSchema = z.object({
  keywords: z.array(z.string()).describe('A list of 3-5 concise and relevant keywords derived from the bio, suitable for search and tagging.'),
  specialties: z
    .array(z.string())
    .describe('A list of 2-4 coach specialties derived directly from the services or approaches described in the bio.'),
});
export type SuggestCoachSpecialtiesOutput = z.infer<
  typeof SuggestCoachSpecialtiesOutputSchema
>;

export async function suggestCoachSpecialties(
  input: SuggestCoachSpecialtiesInput
): Promise<SuggestCoachSpecialtiesOutput> {
  console.log("AI Flow: suggestCoachSpecialties called with bio:", input.bio.substring(0, 100) + "...");
  const result = await suggestCoachSpecialtiesFlow(input);
  console.log("AI Flow: suggestCoachSpecialties result:", result);
  return result;
}

const prompt = ai.definePrompt({
  name: 'suggestCoachSpecialtiesPrompt',
  input: {schema: SuggestCoachSpecialtiesInputSchema},
  output: {schema: SuggestCoachSpecialtiesOutputSchema},
  prompt: `You are an AI assistant helping life coaches enhance their profiles by analyzing their biography.

Coach's Biography:
"{{{bio}}}"

Based *solely and exclusively* on the provided Coach's Biography above:
1. Identify and suggest a list of 3-5 concise and relevant "keywords" that accurately reflect the main themes, skills, or target audience mentioned *in the bio*. These keywords should be suitable for search and tagging. Do not invent keywords not supported by the text.
2. Identify and suggest a list of 2-4 "specialties" that the coach seems to focus on, derived *directly* from the services, problems solved, or approaches described *in the bio*. Do not invent specialties not supported by the text.

Your entire response MUST be a single, valid JSON object matching the output schema, containing a 'keywords' array of strings and a 'specialties' array of strings.
Example of expected JSON output format if the bio discussed career changes and leadership:
{
  "keywords": ["career transition", "leadership development", "executive presence", "public speaking"],
  "specialties": ["Career Coaching", "Executive Coaching", "Communication Skills"]
}
If the bio is too short or uninformative to derive meaningful keywords or specialties, return empty arrays for both. Ensure your response is only the JSON object and nothing else.`,
});

const suggestCoachSpecialtiesFlow = ai.defineFlow(
  {
    name: 'suggestCoachSpecialtiesFlow',
    inputSchema: SuggestCoachSpecialtiesInputSchema,
    outputSchema: SuggestCoachSpecialtiesOutputSchema,
  },
  async input => {
    console.log("suggestCoachSpecialtiesFlow: Input bio:", input.bio.substring(0, 100) + "...");
    const {output, usage} = await prompt(input);
    console.log("suggestCoachSpecialtiesFlow: Raw LLM output:", output);
    console.log("suggestCoachSpecialtiesFlow: LLM usage:", usage);

    if (!output || !output.keywords || !output.specialties) {
        console.warn("AI suggestion flow returned malformed or incomplete output for bio:", input.bio.substring(0,50) + "...");
        return { keywords: [], specialties: [] };
    }
    // Ensure results are arrays, even if empty
    const keywords = Array.isArray(output.keywords) ? output.keywords.filter(k => typeof k === 'string' && k.trim() !== "") : [];
    const specialties = Array.isArray(output.specialties) ? output.specialties.filter(s => typeof s === 'string' && s.trim() !== "") : [];

    return { keywords, specialties };
  }
);

