import { getUserProfile } from "@/lib/firestore";
import { mockCoaches } from "@/data/mock";
import CoachProfile from "@/components/CoachProfile"; // Import the new client component
import type { Coach } from "@/types";
import { notFound } from 'next/navigation';

// Function to generate static params
export async function generateStaticParams() {
  return mockCoaches.map((coach) => ({
    id: coach.id,
  }));
}

interface PageProps {
  params: { id: string };
}

export default async function Page({ params }: PageProps) {
  const { id } = params;
  let coachData: Coach | null | undefined = null;

  try {
    coachData = await getUserProfile(id);
  } catch (error) {
    console.error("Failed to fetch profile from Firestore:", error);
    // Log error but proceed to try mock data
  }

  if (!coachData) {
    // Fallback to mock data if live profile not found or fetch failed
    coachData = mockCoaches.find(c => c.id === id) || null;
  }

  if (!coachData) {
    // If still no coach data (e.g., ID doesn't exist in mockCoaches either),
    // return a 404 page or a custom not found component.
    notFound(); // This will render the nearest not-found.tsx or a default Next.js 404 page
    // return <div>Coach profile not found.</div>; // Or a simpler message
  }

  return <CoachProfile coachData={coachData} coachId={id} />;
}
