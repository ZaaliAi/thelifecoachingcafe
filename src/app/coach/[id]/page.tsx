
import { getUserProfile, getAllCoachIds } from "@/lib/firestore";
import CoachProfile from "@/components/CoachProfile";
import type { Coach, FirestoreTimestamp, Testimonial } from "@/types";
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

function isFirestoreTimestamp(value: any): value is FirestoreTimestamp {
  return value && typeof value.toDate === 'function';
}

export default async function Page({ params }: PageProps) {
  let coachData: Coach | null = null;
  
  try {
    coachData = await getUserProfile(params.id);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
  }

  if (!coachData) {
    notFound(); 
  }

  const serializableCoachData = JSON.parse(JSON.stringify(coachData, (key, value) => {
    if (value && value.seconds !== undefined) {
      return new Date(value.seconds * 1000).toISOString();
    }
    return value;
  }));

  let testimonials: Testimonial[] = [];
  if (coachData && coachData.subscriptionTier === 'premium') {
    try {
      const appURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const testimonialsResponse = await fetch(`${appURL}/api/coachtestimonials?coachId=${params.id}`, { cache: 'no-store' });
      if (testimonialsResponse.ok) {
        testimonials = await testimonialsResponse.json();
      } else {
        console.error(`Failed to fetch testimonials. Status: ${testimonialsResponse.status}, Body: ${await testimonialsResponse.text()}`);
      }
    } catch (error) {
      console.error("Error fetching testimonials:", error);
    }
  }

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": coachData.name,
    "url": `https://thelifecoachingcafe.com/coach/${coachData.id}`,
    "image": coachData.profileImageUrl && coachData.profileImageUrl.startsWith('http') ? coachData.profileImageUrl : `https://thelifecoachingcafe.com${coachData.profileImageUrl || '/preview.jpg'}`,
    "jobTitle": "Life Coach",
    "description": coachData.bio ? coachData.bio.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 250) + '...' : '',
    "knowsAbout": coachData.specialties || [],
    "sameAs": [
      ...(coachData.websiteUrl ? [coachData.websiteUrl] : []),
      ...(coachData.socialLinks ? coachData.socialLinks.map(link => link.url) : [])
    ].filter(Boolean)
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://thelifecoachingcafe.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Coaches",
        "item": "https://thelifecoachingcafe.com/browse-coaches"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": coachData.name.replace(/"/g, '"'),
        "item": `https://thelifecoachingcafe.com/coach/${coachData.id}`
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <CoachProfile coachData={serializableCoachData} coachId={params.id} testimonials={testimonials} />
    </>
  );
}
