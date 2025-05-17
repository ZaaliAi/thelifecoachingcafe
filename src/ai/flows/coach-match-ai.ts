// CoachMatchAiSearch Flow implementation
'use server';

/**
 * @fileOverview AI flow for matching users with suitable life coaches based on their needs.
 *
 * - coachMatchAiSearch - A function that takes user input and returns a ranked list of coaches.
 * - CoachMatchAiSearchInput - The input type for the coachMatchAiSearch function.
 * - CoachMatchAiSearchOutput - The return type for the coachMatchAiSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CoachMatchAiSearchInputSchema = z.object({
  userInput: z
    .string()
    .describe('The user input describing their coaching needs.'),
});
export type CoachMatchAiSearchInput = z.infer<typeof CoachMatchAiSearchInputSchema>;

const CoachMatchAiSearchOutputSchema = z.object({
  rankedCoachList: z.array(
    z.object({
      coachId: z.string().describe('The unique identifier of the coach.'),
      coachName: z.string().describe('The name of the coach.'),
      matchScore: z
        .number()
        .describe('A score indicating how well the coach matches the user needs.'),
      specialties: z.array(z.string()).describe('List of coach specialties'),
    })
  ).describe('A ranked list of coaches based on how well they match the user needs.'),
});
export type CoachMatchAiSearchOutput = z.infer<typeof CoachMatchAiSearchOutputSchema>;

export async function coachMatchAiSearch(input: CoachMatchAiSearchInput): Promise<CoachMatchAiSearchOutput> {
  return coachMatchAiSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coachMatchAiSearchPrompt',
  input: {schema: CoachMatchAiSearchInputSchema},
  output: {schema: CoachMatchAiSearchOutputSchema},
  prompt: `You are an AI assistant designed to match users with life coaches.

  Given the user's description of their coaching needs, analyze the input and provide a ranked list of coaches.
  Each coach in the list should include the coach's ID, name, a match score (higher is better), and their specialties.

  User Needs: {{{userInput}}}`,
});

const coachMatchAiSearchFlow = ai.defineFlow(
  {
    name: 'coachMatchAiSearchFlow',
    inputSchema: CoachMatchAiSearchInputSchema,
    outputSchema: CoachMatchAiSearchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
