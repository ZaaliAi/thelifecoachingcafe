
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Lightbulb, Heart, Linkedin, Facebook } from 'lucide-react';
import Image from 'next/image';

export default function AboutUsPage() {
  return (
    <div className="space-y-12 py-8">
      <section className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-primary">About The Life Coaching Cafe: Your Partner in Personal Development</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Welcome to The Life Coaching Cafe, your premier online life coach directory for finding and connecting with certified life coaches who can help you unlock your potential and achieve your goals in personal development, career, and mental wellness.
        </p>
      </section>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Lightbulb className="mr-3 h-7 w-7 text-accent" />
            Our Mission
          </CardTitle>
        </CardHeader>
        <CardContent className="text-foreground/90 space-y-4">
          <p>
            At The Life Coaching Cafe, our mission is to bridge the gap between individuals seeking guidance for personal growth and skilled life coaches ready to make a difference. We believe everyone deserves access to quality, transformational coaching that can inspire growth, foster resilience, and lead to a more fulfilling life.
          </p>
          <p>
            We leverage technology, including our innovative CoachMatch AI, to provide personalized coach suggestions, making it easier than ever to find a mental wellness coach or personal development coach whose expertise aligns with your unique needs and aspirations.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Heart className="mr-2 h-6 w-6 text-destructive" />
              Our Values: Clarity and Purpose Coaching
            </CardTitle>
          </CardHeader>
          <CardContent className="text-foreground/80">
            <ul className="list-disc list-inside space-y-2">
              <li><span className="font-semibold">Empowerment:</span> We empower individuals to take control of their personal and professional development.</li>
              <li><span className="font-semibold">Connection:</span> We foster meaningful connections between clients and certified life coaches.</li>
              <li><span className="font-semibold">Integrity:</span> We operate with transparency and uphold the highest ethical standards in coaching.</li>
              <li><span className="font-semibold">Innovation:</span> We embrace AI technology to enhance the coach matching experience.</li>
              <li><span className="font-semibold">Growth:</span> We are committed to continuous learning and fostering a growth mindset for ourselves and our users.</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                    <Users className="mr-2 h-6 w-6 text-primary" />
                    Our Community of Coaches and Seekers
                </CardTitle>
            </CardHeader>
            <CardContent className="text-foreground/80 space-y-3">
                <p>
                    The Life Coaching Cafe is more than just a life coach directory; it's a vibrant community of seekers, learners, and expert coaches. We provide resources, life coaching blog articles, and a supportive platform for both coaches to grow their practice and users to embark on transformative journeys toward achieving clarity and purpose.
                </p>
                 <div className="relative aspect-video rounded-lg overflow-hidden mt-4">
                    <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/Untitled%20design%20(10).png?alt=media&token=6fc2b32f-cff0-4083-9329-30f1e7142a11" 
                        alt="Diverse group of people collaborating on personal development" 
                        fill
                        className="object-cover"
                        data-ai-hint="team collaboration" 
                    />
                </div>
            </CardContent>
        </Card>
      </div>

      <section className="text-center py-8 bg-card rounded-lg shadow-inner">
        <h2 className="text-2xl font-semibold mb-4">Connect With Us</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Follow our journey and join the conversation on our social media platforms.
        </p>
        <div className="flex justify-center gap-8">
          <a href="https://www.linkedin.com/company/the-life-coaching-cafe/" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors">
            <Linkedin className="h-10 w-10" />
            <span className="mt-2 text-sm font-medium">LinkedIn</span>
          </a>
          <a href="https://www.facebook.com/thelifecoachingcafeglobal" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors">
            <Facebook className="h-10 w-10" />
            <span className="mt-2 text-sm font-medium">Facebook</span>
          </a>
        </div>
      </section>
      
      <section className="text-center py-8">
        <h2 className="text-2xl font-semibold mb-4">Join Us on This Journey to Find a Life Coach</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Whether you're looking to find a life coach for personal development or you're a certified life coach wanting to expand your reach, The Life Coaching Cafe is here to support you.
        </p>
      </section>
    </div>
  );
}
