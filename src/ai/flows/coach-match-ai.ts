// CoachMatchAiSearch Flow implementation
'use server';

/**
 * @fileOverview AI flow for matching users with suitable life coaches based on their needs,
 * using actual coach data from Firestore.
 *
 * - coachMatchAiSearch - A function that takes user input and returns a ranked list of real coaches.
 * - CoachMatchAiSearchInput - The input type for the coachMatchAiSearch function.
 * - CoachMatchAiSearchOutput - The return type for the coachMatchAiSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getAllCoaches } from '@/lib/firestore'; // To fetch actual coach data
import type { Coach } from '@/types';

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
        .describe('A score (0-100) indicating how well the coach matches the user needs. Higher is better.'),
      specialties: z.array(z.string()).describe('List of coach specialties relevant to the match.'),
    })
  ).describe('A ranked list of coaches based on how well they match the user needs.'),
});
export type CoachMatchAiSearchOutput = z.infer<typeof CoachMatchAiSearchOutputSchema>;


// Internal schema for the data passed to the AI prompt
const InternalPromptInputSchema = z.object({
  userInput: z.string().describe('The user input describing their coaching needs.'),
  availableCoaches: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      bioSummary: z.string().describe("A summary of the coach's bio."),
      specialtiesString: z.string().describe("A comma-separated string of the coach's specialties."),
      keywordsString: z.string().describe("A comma-separated string of the coach's keywords."),
    })
  ).describe("A list of available coaches with their summarized details.")
});


export async function coachMatchAiSearch(input: CoachMatchAiSearchInput): Promise<CoachMatchAiSearchOutput> {
  return coachMatchAiSearchFlow(input);
}

const coachMatchPrompt = ai.definePrompt({
  name: 'coachMatchAiSearchPrompt',
  input: { schema: InternalPromptInputSchema }, // Uses the internal schema
  output: { schema: CoachMatchAiSearchOutputSchema },
  prompt: `You are an AI assistant designed to match users with life coaches from a provided list.

User's Coaching Needs:
"{{{userInput}}}"

Available Coaches:
{{#each availableCoaches}}
- Coach ID: {{id}}
  Name: {{name}}
  Bio Summary: {{bioSummary}}
  Specialties: {{specialtiesString}}
  Keywords: {{keywordsString}}
{{/each}}

Based *only* on the "Available Coaches" list provided above and the "User's Coaching Needs":
1. Analyse the user's needs carefully.
2. For each coach in the "Available Coaches" list, determine how well they match the user's needs.
3. Provide a ranked list of the top 3-5 most suitable coaches. If fewer than 3 coaches are a good match, list only those. If no coaches are a good match, return an empty list.
4. For each coach in your ranked list, include:
    - Their exact "Coach ID".
    - Their exact "Name".
    - A "matchScore" (a number between 0 and 100, where 100 is a perfect match) based on your analysis of their relevance to the user's needs.
    - A list of "specialties" (up to 3) from *their listed specialties* that are most relevant to this specific user's needs.
Your entire response must be a single JSON object matching the output schema.
`,
});

const coachMatchAiSearchFlow = ai.defineFlow(
  {
    name: 'coachMatchAiSearchFlow',
    inputSchema: CoachMatchAiSearchInputSchema, // External input schema
    outputSchema: CoachMatchAiSearchOutputSchema,
  },
  async (externalInput: CoachMatchAiSearchInput): Promise<CoachMatchAiSearchOutput> => {
    // 1. Fetch all coaches from Firestore
    const allCoachesFromDb: Coach[] = await getAllCoaches();

    if (!allCoachesFromDb || allCoachesFromDb.length === 0) {
        // console.warn("CoachMatchAiSearchFlow: No coaches found in Firestore. Returning empty list.");
        return { rankedCoachList: [] };
    }

    // 2. Prepare a summarized list of coach data for the prompt
    const preparedCoaches = allCoachesFromDb.map(coach => ({
      id: coach.id,
      name: coach.name,
      bioSummary: coach.bio ? coach.bio.substring(0, 400) + (coach.bio.length > 400 ? "..." : "") : "", // Added check for coach.bio
      specialtiesString: (Array.isArray(coach.specialties) ? coach.specialties : []).join(', ') || "Not specified", // Ensured array
      keywordsString: (Array.isArray(coach.keywords) ? coach.keywords : []).join(', ') || "Not specified", // Ensured array and fixed this line
    }));

    // 3. Construct the input for the AI prompt
    const promptInput = {
      userInput: externalInput.userInput,
      availableCoaches: preparedCoaches,
    };

    // 4. Call the AI prompt
    // console.log("CoachMatchAiSearchFlow: Calling AI with user input and prepared coaches list.");
    const { output } = await coachMatchPrompt(promptInput);
    
    if (!output || !output.rankedCoachList) {
        // console.warn("CoachMatchAiSearchFlow: AI did not return the expected output structure. Returning empty list.");
        return { rankedCoachList: [] };
    }
    
    // console.log("CoachMatchAiSearchFlow: AI returned ranked list:", JSON.stringify(output.rankedCoachList, null, 2));
    return output;
  }
);
