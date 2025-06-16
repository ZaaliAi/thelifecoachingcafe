import type { Metadata } from 'next';
import PricingClientContent from '@/components/pricing/PricingClientContent';

export function generateMetadata(): Metadata {
  return {
    title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
    description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
      description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/pricing', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
      description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function PricingPage() {
  return <PricingClientContent />;
}
