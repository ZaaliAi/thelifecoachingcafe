
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CoachCard } from '@/components/CoachCard';
import { TestimonialCard } from '@/components/TestimonialCard';
import { getFeaturedCoaches, getTestimonials } from '@/lib/firestore';
import { Search, Users, UserPlus, MessageCircle, HelpCircle } from 'lucide-react';
import HomePageClientContent from '@/components/home/HomePageClientContent';
import PremiumHighlight from '@/components/PremiumHighlight';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


export default async function HomePage() {
  const featuredCoaches = await getFeaturedCoaches(3);
  const testimonials = await getTestimonials(3);

  const faqs = [
    {
      question: "What is The Life Coaching Cafe?",
      answer: "The Life Coaching Cafe is a directory connecting users with certified life coaches. Our CoachMatch AI helps you find the perfect coach for your needs, whether for personal development or mental wellness. We also offer resources for aspiring and established coaches."
    },
    {
      question: "How does the CoachMatch AI work?",
      answer: "Our AI-powered assistant matches you with ideal life coaches based on your specific needs. Simply describe what you're looking for, and our tool will provide a list of suitable coaches, making it easy to find your perfect fit."
    },
    {
        question: "Is it free to search for a coach?",
        answer: "Yes, searching for and connecting with a life coach on our platform is completely free for users. You can browse profiles, use the CoachMatch AI, and message coaches at no cost. Coaching services themselves are priced by the individual coaches."
    },
    {
        question: "How do I become a coach on the platform?",
        answer: "Aspiring coaches can join our platform by subscribing to one of our membership tiers. We offer a free plan with basic features and premium plans with enhanced visibility and tools. Visit our pricing page to learn more and register."
    },
  ];

 return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative text-center py-12 md:py-20 rounded-lg shadow-sm overflow-hidden
                          bg-[url('https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/Untitled%20design%20(10).png?alt=media&token=6fc2b32f-cff0-4083-9329-30f1e7142a11')]
                          bg-cover bg-center">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black opacity-50"></div>

        <div className="container mx-auto px-4 relative z-10">

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white">
            Find Your Perfect Life Coach with <span className="text-primary">CoachMatch AI<sup className="text-sm md:text-base align-super">&trade;</sup></span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 text-gray-300">
            Discover life coaches across a range of specialties. Get personalised recommendations with our free AI-powered CoachMatch assistant for your personal development journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button asChild size="lg" className="h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/find-a-coach">
                <>
                   Get Matched Now
                </>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <HomePageClientContent />

      {/* How it works / Platform Intro */}
      <section className="py-16 bg-gradient-to-b from-background to-muted/50 rounded-lg shadow-xl">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold">
                See How Our <span className="text-primary">AI-Powered</span> Matching Works            </h2>
            <p className="text-lg mt-2 text-muted-foreground">In just a few simple steps, you can find the perfect coach for you.</p>
            <div className="flex justify-center mt-3">
              <div className="w-24 h-1 bg-primary rounded-full"></div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left Column: The 3 Steps */}
            <div className="space-y-8">
                <div className="flex items-start p-6 bg-card rounded-lg shadow-lg border border-border/40">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                        <Search className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">1. Describe Your Coaching Needs</h3>
                        <p className="text-muted-foreground">Use our CoachMatch AI to tell us what you're looking for in a life coach for areas like career change, confidence, or mindset.</p>
                    </div>
                </div>

                <div className="flex items-start p-6 bg-card rounded-lg shadow-lg border border-border/40">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                         <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">2. Get Personalised Coach Recommendations</h3>
                        <p className="text-muted-foreground">Our AI provides personalised coach suggestions based on your input and our extensive coach directory.</p>
                    </div>
                </div>

                <div className="flex items-start p-6 bg-card rounded-lg shadow-lg border border-border/40">
                     <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                        <MessageCircle className="h-6 w-6 text-primary" />
                     </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-2">3. Connect with Your Ideal Life Coach & Grow</h3>
                        <p className="text-muted-foreground">Browse life coach profiles, message coaches, and start your transformational coaching journey.</p>
                    </div>
                </div>
            </div>

            {/* Right Column: Animated Video Section */}
            <div className="text-center">
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
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                <Button asChild variant="outline" size="lg">
                    <Link href="/signup">
                        <>
                        <UserPlus className="mr-2 h-5 w-5" /> Sign Up as a User
                        </>
                    </Link>
                </Button>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/register-coach">Register as a Coach</Link>
                </Button>
              </div>
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

      <PremiumHighlight />
      
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

      {/* FAQ Section */}
      <section className="py-16 rounded-lg">
          <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <HelpCircle className="mx-auto h-12 w-12 text-primary mb-4" />
                <h2 className="text-3xl font-semibold">Frequently Asked Questions</h2>
                <p className="text-lg mt-2 text-muted-foreground">
                    Have questions? We've got answers. If you don't find what you're looking for, feel free to <Link href="/contact-us" className="text-primary hover:underline">contact us</Link>.
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-lg font-medium">{faq.question}</AccordionTrigger>
                            <AccordionContent className="text-base text-muted-foreground">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
              </div>
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
              <Link href="/pricing">Register as a Coach</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
