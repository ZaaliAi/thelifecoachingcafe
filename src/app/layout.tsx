
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth';
import AnnouncementBar from '@/components/AnnouncementBar'; // Added import
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'The Life Coaching Cafe - Find Your Perfect Life Coach',
  description: 'AI-powered coach matching to find the right life coach for your needs. Connect with certified life coaches, and discover resources for personal development and mental wellness.',
  metadataBase: new URL('https://thelifecoachingcafe.com'), // Replace with your actual domain
  openGraph: {
    title: 'The Life Coaching Cafe - Find Your Perfect Life Coach',
    description: 'AI-powered coach matching. Connect with top-rated life coaches today.',
    images: ['/preview.jpg'], // Replace with a link to a great preview image
    url: 'https://thelifecoachingcafe.com', // Replace with your actual domain
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Life Coaching Cafe - Find Your Perfect Life Coach',
    description: 'AI-powered coach matching. Connect with top-rated life coaches today.',
    images: ['/preview.jpg'], // Must be an absolute URL
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-V6RRT1QKXE"
        />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-V6RRT1QKXE');
          `}
        </Script>
        <link rel="icon" href="/favicon.ico" />
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "name": "The Life Coaching Cafe",
                  "url": "https://thelifecoachingcafe.com",
                  "logo": "https://thelifecoachingcafe.com/preview.jpg",
                  "sameAs": [
                    "https://www.linkedin.com/company/the-life-coaching-cafe/",
                    "https://www.facebook.com/thelifecoachingcafeglobal"
                  ]
                },
                {
                  "@type": "WebSite",
                  "name": "The Life Coaching Cafe",
                  "url": "https://thelifecoachingcafe.com",
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://thelifecoachingcafe.com/browse-coaches?search={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            }
          `}
        </script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <AuthProvider>
          <AnnouncementBar /> {/* Added AnnouncementBar component */}
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
          <Toaster />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
