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
  keywords: z.array(z.string()).describe('Relevant keywords for the coach.'),
  specialties: z
    .array(z.string())
    .describe('Suggested specialties for the coach.'),
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
  prompt: `You are an AI assistant helping life coaches create their profiles.

  Based on the coach's bio, suggest relevant keywords and specialties that the coach can use in their profile.
  The specialties should be selected from a pre-populated list of common coaching specialties.

  Bio: {{{bio}}}
  Output format: JSON`, // Specify JSON output for structured results
});

const suggestCoachSpecialtiesFlow = ai.defineFlow(
  {
    name: 'suggestCoachSpecialtiesFlow',
    inputSchema: SuggestCoachSpecialtiesInputSchema,
    outputSchema: SuggestCoachSpecialtiesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
