
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
  return suggestCoachSpecialtiesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCoachSpecialtiesPrompt',
  input: {schema: SuggestCoachSpecialtiesInputSchema},
  output: {schema: SuggestCoachSpecialtiesOutputSchema},
  prompt: `You are an AI assistant helping life coaches enhance their profiles by analyzing their biography.

Coach's Biography:
"{{{bio}}}"

Based *only* on the provided Coach's Biography:
1. Suggest a list of 3-5 concise and relevant "keywords" that accurately reflect the main themes, skills, or target audience mentioned in the bio. These keywords should be suitable for search and tagging.
2. Suggest a list of 2-4 "specialties" that the coach seems to focus on, derived directly from the services, problems solved, or approaches described in the bio. Do not invent specialties not supported by the text.

Your entire response must be a single JSON object matching the output schema, containing a 'keywords' array of strings and a 'specialties' array of strings.
Example of expected JSON output format:
{
  "keywords": ["career transition", "leadership development", "executive presence", "public speaking"],
  "specialties": ["Career Coaching", "Executive Coaching", "Communication Skills"]
}
Ensure your response is only the JSON object.`,
});

const suggestCoachSpecialtiesFlow = ai.defineFlow(
  {
    name: 'suggestCoachSpecialtiesFlow',
    inputSchema: SuggestCoachSpecialtiesInputSchema,
    outputSchema: SuggestCoachSpecialtiesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        // Handle cases where the AI might return an empty or malformed response
        console.warn("AI suggestion flow returned no output for bio:", input.bio);
        return { keywords: [], specialties: [] };
    }
    return output;
  }
);
