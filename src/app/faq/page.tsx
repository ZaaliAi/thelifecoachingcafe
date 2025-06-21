
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: "FAQ | The Life Coaching Cafe | Answers to Your Questions",
    description: "Find answers to frequently asked questions about The Life Coaching Cafe, our CoachMatch AI, how to find a coach, and how to join as a coach.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "FAQ | The Life Coaching Cafe | Answers to Your Questions",
      description: "Find answers to frequently asked questions about The Life Coaching Cafe, our CoachMatch AI, how to find a coach, and how to join as a coach.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/faq', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "FAQ | The Life Coaching Cafe | Answers to Your Questions",
      description: "Find answers to frequently asked questions about The Life Coaching Cafe, our CoachMatch AI, how to find a coach, and how to join as a coach.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

const faqs = [
  {
    question: "What is The Life Coaching Cafe?",
    answer:
      "The Life Coaching Cafe is a platform designed to connect individuals seeking personal or professional growth with qualified life coaches. We use our innovative CoachMatch AI to help you find the perfect coach for your needs.",
  },
  {
    question: "How does the CoachMatch AI work?",
    answer:
      "You describe your coaching needs, goals, or challenges in your own words. Our AI analyses your input and compares it against our database of coach profiles, specialties, and keywords to provide you with a ranked list of suitable coaches.",
  },
  {
    question: "Is it free to search for a coach?",
    answer:
      "Yes, searching for and browsing coach profiles is completely free for users. You can also message coaches through our platform to inquire about their services.",
  },
  {
    question: "How do I become a coach on The Life Coaching Cafe?",
    answer:
      "You can register as a coach by signing up and completing our coach profile form. We offer different subscription tiers with various features to help you build your practice. Visit our 'Pricing' page for more details.",
  },
  {
    question: "What kind of life coaches can I find here?",
    answer:
      "We have a diverse range of life coaches specializing in various areas, including career coaching, personal development, wellness, leadership, relationships, and more. You can browse by specialty or use our CoachMatch AI for personalized recommendations.",
  },
  {
    question: "How is my personal information handled?",
    answer:
      "We take your privacy seriously. Please refer to our Privacy Policy for detailed information on how we collect, use, and protect your data.",
  },
];

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-10">
      <section className="text-center">
        <HelpCircle className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-muted-foreground">
          Find answers to common questions about The Life Coaching Cafe.
        </p>
      </section>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">General Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem value={`item-${index + 1}`} key={index}>
                <AccordionTrigger className="text-left text-base hover:text-accent transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-foreground/80 leading-relaxed pt-2">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <section className="text-center text-muted-foreground">
        <p>
          Can&apos;t find the answer you&apos;re looking for? Feel free to{" "}
          <a href="mailto:hello@thelifecoachingcafe.com" className="text-primary hover:underline">
            contact us
          </a>
          .
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(faq => ({
              "@type": "Question",
              "name": faq.question.replace(/"/g, '\\"'),
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer.replace(/"/g, '\\"')
              }
            }))
          })
        }}
      />
    </div>
  );
}
