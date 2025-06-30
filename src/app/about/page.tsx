
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Lightbulb, Heart, Linkedin, Facebook, UserPlus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: "About The Life Coaching Cafe | Our Mission, Values & Community",
    description: "Learn about The Life Coaching Cafe: our mission to connect you with life coaches, our core values, and our commitment to your personal development and mental wellness journey.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), 
    openGraph: {
      title: "About The Life Coaching Cafe | Our Mission, Values & Community",
      description: "Learn about The Life Coaching Cafe: our mission to connect you with life coaches, our core values, and our commitment to your personal development and mental wellness journey.",
      images: ['/preview.jpg'], 
      url: 'https://thelifecoachingcafe.com/about', 
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: "About The Life Coaching Cafe | Our Mission, Values & Community",
      description: "Learn about The Life Coaching Cafe: our mission to connect you with life coaches, our core values, and our commitment to your personal development and mental wellness journey.",
      images: ['/preview.jpg'],
    },
  };
}

export default function AboutUsPage() {
  return (
    <div className="space-y-16 py-12">
      {/* Hero Section */}
      <section className="relative text-center py-20 rounded-lg shadow-lg overflow-hidden bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            About <span className="text-primary">The Life Coaching Cafe</span>
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
            Your premier online directory for finding and connecting with Llfe coaches who can help you unlock your potential and achieve your goals.
          </p>
        </div>
      </section>
      
      {/* Mission and Video Section */}
      <section className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
              {/* Left Column: Video */}
              <div className="w-full rounded-lg shadow-2xl overflow-hidden border">
                <video
                  src="https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/See%20CoachMatch%20AI%20in%20Action_free.mp4?alt=media&token=b0ef720a-9aba-4250-9c3a-01c13727d826"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Right Column: Mission and Values */}
              <div className="space-y-8">
                <div className="p-6 bg-card rounded-lg shadow-lg border border-border/40">
                  <div className="flex items-start">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                          <Lightbulb className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-semibold mb-2">Our Mission</h3>
                          <p className="text-muted-foreground">To bridge the gap between individuals seeking guidance for personal growth and skilled life coaches ready to make a difference. We believe everyone deserves access to quality coaching that inspires resilience and fulfillment.</p>
                      </div>
                  </div>
                </div>

                <div className="p-6 bg-card rounded-lg shadow-lg border border-border/40">
                  <div className="flex items-start">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                          <Heart className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-semibold mb-2">Our Values</h3>
                          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li><span className="font-semibold text-foreground">Empowerment:</span> We empower individuals to take control of their personal development.</li>
                            <li><span className="font-semibold text-foreground">Connection:</span> We foster meaningful connections between clients and coaches.</li>
                            <li><span className="font-semibold text-foreground">Innovation:</span> We embrace technology to enhance the coach matching experience.</li>
                          </ul>
                      </div>
                  </div>
                </div>
              </div>
          </div>
      </section>

      {/* Community Section */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Users className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-3xl font-bold mb-4">Our Community of Coaches and Seekers</h2>
              <p className="text-lg text-muted-foreground mb-6">
                The Life Coaching Cafe is more than just a directory; it's a vibrant community. We provide resources, blog articles, and a supportive platform for both coaches to grow their practice and users to embark on transformative journeys.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg">
                  <Link href="/browse-coaches">Browse Coaches</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/blog">Read Our Blog</Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
              <Image 
                src="https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/Untitled%20design%20(10).png?alt=media&token=6fc2b32f-cff0-4083-9329-30f1e7142a11" 
                alt="Diverse group of people collaborating on personal development" 
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Connect With Us Section */}
      <section className="container mx-auto px-4 text-center py-12">
        <h2 className="text-3xl font-bold mb-4">Connect With Us</h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Follow our journey and join the conversation on our social media platforms.
        </p>
        <div className="flex justify-center gap-8">
          <a href="https://www.linkedin.com/company/the-life-coaching-cafe/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <Linkedin className="h-10 w-10" />
            <span className="sr-only">LinkedIn</span>
          </a>
          <a href="https://www.facebook.com/thelifecoachingcafeglobal" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <Facebook className="h-10 w-10" />
            <span className="sr-only">Facebook</span>
          </a>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-primary/10 py-20">
        <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Join Us on This Journey</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Whether you're looking to find a life coach for personal development or you're a life coach wanting to expand your reach, The Life Coaching Cafe is here to support you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/signup">
                        <>
                            <UserPlus className="mr-2 h-5 w-5" /> Sign Up as a User
                        </>
                    </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                    <Link href="/register-coach">Become a Coach</Link>
                </Button>
            </div>
        </div>
      </section>
    </div>
  );
}
