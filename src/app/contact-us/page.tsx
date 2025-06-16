import type { Metadata } from 'next';
import ContactUsClientContent from '@/components/contact/ContactUsClientContent';

export function generateMetadata(): Metadata {
  return {
    title: "Contact Us | The Life Coaching Cafe | Get in Touch",
    description: "Reach out to The Life Coaching Cafe for any questions, feedback, or inquiries. Contact us via email or connect on social media.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Contact Us | The Life Coaching Cafe | Get in Touch",
      description: "Reach out to The Life Coaching Cafe for any questions, feedback, or inquiries. Contact us via email or connect on social media.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/contact-us', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Contact Us | The Life Coaching Cafe | Get in Touch",
      description: "Reach out to The Life Coaching Cafe for any questions, feedback, or inquiries. Contact us via email or connect on social media.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function ContactUsPage() {
  return <ContactUsClientContent />;
}
