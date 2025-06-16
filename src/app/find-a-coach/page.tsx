import type { Metadata } from 'next';
import FindACoachClientContent from '@/components/find-a-coach/FindACoachClientContent';

export function generateMetadata(): Metadata {
  return {
    title: "Find Your Perfect Life Coach | CoachMatch AI | The Life Coaching Cafe",
    description: "Use our CoachMatch AI to find your ideal life coach. Describe your needs for personal development or mental wellness and get personalized suggestions.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Find Your Perfect Life Coach | CoachMatch AI | The Life Coaching Cafe",
      description: "Use our CoachMatch AI to find your ideal life coach. Describe your needs for personal development or mental wellness and get personalized suggestions.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/find-a-coach', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Find Your Perfect Life Coach | CoachMatch AI | The Life Coaching Cafe",
      description: "Use our CoachMatch AI to find your ideal life coach. Describe your needs for personal development or mental wellness and get personalized suggestions.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function FindACoachPage() {
  return <FindACoachClientContent />;
}
