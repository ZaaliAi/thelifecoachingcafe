import Link from 'next/link';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input'; // Removed Input import
import { CoachCard } from '@/components/CoachCard';
import { TestimonialCard } from '@/components/TestimonialCard';
// import type { Testimonial } from '@/types'; // Testimonial type will be inferred from getTestimonials
import { getFeaturedCoaches, getTestimonials } from '@/lib/firestore';
import { Search, Users, UserPlus, MessageCircle, Sparkles } from 'lucide-react'; // Added MessageCircle for testimonials icon


export default async function HomePage() {
  const featuredCoaches = await getFeaturedCoaches(3);
  const testimonials = await getTestimonials(3); // Fetch 3 testimonials
  // console.log('Featured Coaches Data (HomePage):', JSON.stringify(featuredCoaches, null, 2));
  // console.log('Testimonials Data (HomePage):', JSON.stringify(testimonials, null, 2));

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
                  <Search className="mr-2 h-5 w-5" /> Get Matched Now
                </>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works / Platform Intro */}
      <section className="py-16 bg-gradient-to-b from-background to-muted/50 rounded-lg shadow-xl">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              See how our AI-Powered matching works
            </h2>
            <div className="flex justify-center mt-3">
              <div className="w-24 h-1 bg-primary rounded-full"></div>
            </div>
          </div>

          {/* Animated Video Section */}
          <div className="flex flex-col items-center mb-12">
            <div className="w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden border">
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
          </div>

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
      
      {/* Testimonials Section */}
      <section>
        <div className="flex items-center justify-center mb-8">
          <MessageCircle className="h-8 w-8 text-accent mr-3" />
          <h2 className="text-3xl font-semibold text-center">What Our Users Say</h2>
        </div>
        {testimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No testimonials yet. Check back soon!</p>
        )}
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
              <Link href="/pricing">Become a Coach</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
