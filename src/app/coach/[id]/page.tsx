
import { getUserProfile, getAllCoachIds } from "@/lib/firestore";
import { mockCoaches } from "@/data/mock";
import CoachProfile from "@/components/CoachProfile";
import type { Coach } from "@/types";
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 3600;

export async function generateStaticParams() {
  const coachIds = await getAllCoachIds();
  return coachIds.map((id) => ({ id }));
}

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const coach = await getUserProfile(params.id);

  if (!coach) {
    return {
      title: "Coach Not Found",
      description: "The coach you are looking for could not be found.",
    };
  }

  const title = `${coach.name} - Life Coach | The Life Coaching Cafe`;
  const description = coach.specialties?.length
    ? `Expert in ${coach.specialties.join(', ')}. ${coach.bio?.substring(0, 120)}...`
    : `${coach.bio?.substring(0, 155)}...`;

  const imageUrl = coach.profileImageUrl || '/preview.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl],
      type: 'profile',
      profile: {
        firstName: coach.name.split(' ')[0],
        lastName: coach.name.split(' ').slice(1).join(' '),
      },
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function Page({ params }: PageProps) {
  let coachData: Coach | null = null;

  try {
    coachData = await getUserProfile(params.id);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
  }

  if (!coachData) {
    coachData = mockCoaches.find(c => c.id === params.id) || null;
  }
  
  if (!coachData) {
    notFound();
  }

  const serializableCoachData = JSON.parse(JSON.stringify(coachData));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: coachData.name,
    jobTitle: 'Life Coach',
    image: coachData.profileImageUrl,
    url: `https://thelifecoachingcafe.com/coach/${coachData.id}`,
    description: coachData.bio,
    knowsAbout: coachData.specialties,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CoachProfile coachData={serializableCoachData} coachId={params.id} />
    </>
  );
}
