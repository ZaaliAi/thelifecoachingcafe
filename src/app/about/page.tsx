
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Lightbulb, Heart } from 'lucide-react';
import Image from 'next/image';

export default function AboutUsPage() {
  return (
    <div className="space-y-12 py-8">
      <section className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-primary">About CoachConnect</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Welcome to CoachConnect, your premier destination for finding and connecting with life coaches who can help you unlock your potential and achieve your goals.
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
            At CoachConnect, our mission is to bridge the gap between individuals seeking guidance and skilled life coaches ready to make a difference. We believe that everyone deserves access to quality coaching that can inspire growth, foster resilience, and lead to a more fulfilling life.
          </p>
          <p>
            We leverage technology, including our innovative CoachMatch AI, to provide personalized recommendations, making it easier than ever to find a coach whose expertise aligns with your unique needs and aspirations.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Heart className="mr-2 h-6 w-6 text-destructive" />
              Our Values
            </CardTitle>
          </CardHeader>
          <CardContent className="text-foreground/80">
            <ul className="list-disc list-inside space-y-2">
              <li><span className="font-semibold">Empowerment:</span> We empower individuals to take control of their personal and professional development.</li>
              <li><span className="font-semibold">Connection:</span> We foster meaningful connections between clients and coaches.</li>
              <li><span className="font-semibold">Integrity:</span> We operate with transparency and uphold the highest ethical standards.</li>
              <li><span className="font-semibold">Innovation:</span> We embrace technology to enhance the coaching experience.</li>
              <li><span className="font-semibold">Growth:</span> We are committed to continuous learning and improvement for ourselves and our users.</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                    <Users className="mr-2 h-6 w-6 text-primary" />
                    Our Community
                </CardTitle>
            </CardHeader>
            <CardContent className="text-foreground/80 space-y-3">
                <p>
                    CoachConnect is more than just a directory; it's a vibrant community of seekers, learners, and expert coaches. We provide resources, insights through our blog, and a supportive platform for both coaches to grow their practice and users to embark on transformative journeys.
                </p>
                 <div className="relative aspect-video rounded-lg overflow-hidden mt-4">
                    <Image 
                        src="https://placehold.co/600x338.png" 
                        alt="Diverse group of people collaborating" 
                        fill
                        className="object-cover"
                        data-ai-hint="team collaboration" 
                    />
                </div>
            </CardContent>
        </Card>
      </div>

      <section className="text-center py-8">
        <h2 className="text-2xl font-semibold mb-4">Join Us on This Journey</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Whether you're looking to find a coach or you're a coach wanting to expand your reach, CoachConnect is here to support you.
        </p>
      </section>
    </div>
  );
}
