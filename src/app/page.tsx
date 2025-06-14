import Link from 'next/link';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input'; // Removed Input import
import { CoachCard } from '@/components/CoachCard';
import { TestimonialCard } from '@/components/TestimonialCard';
import type { Testimonial } from '@/types';
import { getFeaturedCoaches } from '@/lib/firestore';
import { Search, Users, UserPlus } from 'lucide-react';

// Testimonials are static for now
const mockTestimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah L.',
    text: "The Life Coaching Cafe helped me find the perfect life coach who understood my needs. The AI matching was spot on!",
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'happy person',
    // designation: 'User of The Life Coaching Cafe',
  },
  {
    id: '2',
    name: 'John B.',
    text: "As a coach, registering on The Life Coaching Cafe was easy, and I love the platform's modern design and features for finding clients seeking online life coaching.",
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'professional person',
    // designation: 'Life Coach on The Life Coaching Cafe',
  },
  {
    id: '3',
    name: 'Maria G.',
    text: "The blog section is full of insightful articles. It's a great resource for anyone interested in personal development and self-coaching techniques.",
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'thoughtful person',
    // designation: 'Reader & User',
  },
];


export default async function HomePage() {
  const featuredCoaches = await getFeaturedCoaches(3);
  // console.log('Featured Coaches Data (HomePage):', JSON.stringify(featuredCoaches, null, 2)); // Commented out console.log

 return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative text-center py-12 md:py-20 rounded-lg shadow-sm overflow-hidden
                          bg-[url('https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/Untitled%20design%20(10).png?alt=media&token=6fc2b32f-cff0-4083-9329-30f1e7142a11')]
                          bg-cover bg-center">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black opacity-50"></div> {/* Adjust color and opacity as needed */}

        <div className="container mx-auto px-4 relative z-10"> {/* Added relative z-10 */}

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white"> {/* Changed text color for better contrast */}
            Find Your Perfect Life Coach with <span className="text-primary">CoachMatch AI<sup className="text-sm md:text-base align-super">&trade;</sup></span>
          </h1>
          {/* Corrected Paragraph */}
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 text-gray-300">
            Discover certified life coaches across a range of specialties. Get personalised recommendations with our free AI-powered CoachMatch assistant for your personal development journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            {/* Input field removed */}
            <Button asChild size="lg" className="h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
              {/* Assuming /find-a-coach is your CoachMatch AI page. Update if different. */}
              <Link href="/find-a-coach">
                <>
                  <Search className="mr-2 h-5 w-5" /> Try CoachMatch AI
                </>
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* Featured Coaches Section */}
      <section>
        <div className="flex items-center mb-8">
          <Users className="h-8 w-8 text-accent mr-3" />
          <h2 className="text-3xl font-semibold">Our Featured Certified Life Coaches</h2>
        </div>
        {featuredCoaches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCoaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No featured coaches available at the moment. Check back soon for updates to our life coach directory.</p>
        )}
        <div className="text-center mt-8">
          <Button asChild variant="outline" size="lg">
            <Link href="/browse-coaches">View All Coaches</Link>
          </Button>
        </div>
      </section>
      {/* How it works / Platform Intro */}
      <section className="py-16 bg-gradient-to-b from-background to-muted/50 rounded-lg shadow-xl">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-semibold text-center mb-12">How Our AI-Powered Coach Matching Works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="p-8 bg-card rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-2xl">
              <Search className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">1. Describe Your Coaching Needs</h3>
              <p className="text-muted-foreground">Use our CoachMatch AI to tell us what you're looking for in a life coach for areas like career change, confidence, or mindset.</p>
            </div>
            <div className="p-6 bg-card rounded-lg shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mx-auto mb-4 h-12 w-12"><path d="M15.5 2H8.5C7.67 2 7 2.67 7 3.5V14.5C7 15.33 7.67 16 8.5 16H15.5C16.33 16 17 15.33 17 14.5V3.5C17 2.67 16.33 2 15.5 2ZM12 18.5C10.07 18.5 8.5 16.93 8.5 15H15.5C15.5 16.93 13.93 18.5 12 18.5ZM12 5.5C10.34 5.5 9 6.84 9 8.5H15C15 6.84 13.66 5.5 12 5.5Z"/></svg>
              <h3 className="text-xl font-medium mb-2">2. Get Personalised Coach Recommendations</h3>
              <p className="text-muted-foreground">Our AI provides personalised coach suggestions based on your input and our extensive coach directory.</p>
            </div>
            <div className="p-8 bg-card rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-2xl">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">3. Connect with Your Ideal Life Coach & Grow</h3>
              <p className="text-muted-foreground">Browse certified life coach profiles, message coaches, and start your transformational coaching journey.</p>
            </div>
          </div>
        </div>
      </section>
      {/* Testimonials Section */}
      <section>
        <h2 className="text-3xl font-semibold text-center mb-8">What Our Users Say About Finding Their Coach</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockTestimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      </section>
      {/* Call to Action Section */}
      <section className="py-12 bg-primary/10 rounded-lg shadow-sm">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold mb-6">Ready to Begin Your Coaching Journey?</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Join our community to find your ideal life coach or expand your reach as a certified professional. Your path to personal development and mental wellness starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/signup">
                <>
                  <UserPlus className="mr-2 h-5 w-5" /> Sign Up as a User
                </>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register-coach">Become a Coach</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
