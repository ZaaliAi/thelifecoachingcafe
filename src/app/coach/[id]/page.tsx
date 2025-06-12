
import { getUserProfile } from "@/lib/firestore";
import { mockCoaches } from "@/data/mock";
import CoachProfile from "@/components/CoachProfile"; // Import the new client component
import type { Coach, FirestoreTimestamp } from "@/types"; // Assuming FirestoreTimestamp is defined in your types
import { notFound } from 'next/navigation';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking
import { getAllCoachIds } from "@/lib/firestore";

export const revalidate = 3600; // Revalidate every hour

// Function to generate static params
export async function generateStaticParams() {
  const coachIds = await getAllCoachIds();
  return coachIds.map((id) => ({
    id,
  }));
}

interface PageProps {
  params: { id: string };
}

// Helper function to check if a value is a Firestore Timestamp
function isFirestoreTimestamp(value: any): value is FirestoreTimestamp {
  return value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds') && typeof value.toDate === 'function';
}

export default async function Page({ params: paramsProp }: PageProps) {
  const resolvedParams = await paramsProp;
  const { id } = resolvedParams;
  
  console.log("[CoachPage] paramsProp (can be a Promise):", paramsProp);
  console.log("[CoachPage] resolvedParams:", resolvedParams);
  console.log("[CoachPage] Using id:", id);

  let coachData: Coach | null | undefined = null;

  try {
    coachData = await getUserProfile(id);
    console.log("[CoachPage] Fetched coachData from Firestore for id:", id);
  } catch (error) {
    console.error("[CoachPage] Failed to fetch profile from Firestore for id:", id, error);
  }

  if (!coachData) {
    console.log("[CoachPage] No data from Firestore, falling back to mockCoaches for id:", id);
    coachData = mockCoaches.find(c => c.id === id) || null;
    if (coachData) {
      console.log("[CoachPage] Found coachData in mockCoaches for id:", id);
    }
  }

  if (!coachData) {
    console.log("[CoachPage] Coach data not found for id:", id, ". Triggering notFound().");
    notFound(); 
  }

  // Serialize coachData before passing to Client Component
  const serializableCoachData: any = { ...coachData };

  if (coachData && isFirestoreTimestamp(coachData.createdAt)) {
    serializableCoachData.createdAt = coachData.createdAt.toDate().toISOString();
  }
  if (coachData && isFirestoreTimestamp(coachData.updatedAt)) {
    serializableCoachData.updatedAt = coachData.updatedAt.toDate().toISOString();
  }
  // You might need to do this for other date fields if they exist e.g. availability
  // For example, if availability is an array of objects with date/time strings, it might already be serializable.
  // If availability contains Date objects or Timestamps, they also need serialization.
  // The current log shows availability as an array of objects with string 'day' and 'time', which is fine.

  console.log("[CoachPage] Serializable coachData:", serializableCoachData);

  return <CoachProfile coachData={serializableCoachData as Coach} coachId={id} />;
}
