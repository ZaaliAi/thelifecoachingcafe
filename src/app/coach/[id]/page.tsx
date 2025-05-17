
import Image from 'next/image';
import Link from 'next/link';
import { mockCoaches, mockBlogPosts } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, MapPin, MessageSquare, Star, Link as LinkIcon, CheckCircle2, BookOpen, ArrowLeft, Crown, Globe, Video } from 'lucide-react';
import type { Coach } from '@/types';
import { notFound } from 'next/navigation';
import { BlogPostCard } from '@/components/BlogPostCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

async function getCoachDetails(id: string): Promise<Coach | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  return mockCoaches.find(coach => coach.id === id);
}

export default async function CoachProfilePage({ params }: { params: { id: string } }) {
  const coach = await getCoachDetails(params.id);

  if (!coach) {
    notFound();
  }

  const coachBlogPosts = mockBlogPosts.filter(post => post.authorId === coach.id && post.status === 'published').slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-12">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/browse-coaches"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Coaches</Link>
        </Button>
      {/* Coach Header */}
      <section className="flex flex-col md:flex-row items-center md:items-start gap-8 p-6 bg-card rounded-lg shadow-xl">
        <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-primary relative">
          <AvatarImage src={coach.profileImageUrl} alt={coach.name} data-ai-hint={coach.dataAiHint as string || "professional portrait"} />
          <AvatarFallback className="text-4xl">{coach.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          {coach.subscriptionTier === 'premium' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-full border-2 border-card">
                    <Crown className="h-5 w-5 text-yellow-300 fill-yellow-400" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Premium Coach</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold">{coach.name}</h1>
          {coach.location && (
            <p className="text-lg text-muted-foreground flex items-center justify-center md:justify-start mt-1">
              <MapPin className="h-5 w-5 mr-2 text-primary" /> {coach.location}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
            {coach.specialties.map(specialty => (
              <Badge key={specialty} variant="secondary" className="text-sm px-3 py-1">{specialty}</Badge>
            ))}
          </div>
          {coach.subscriptionTier === 'premium' && coach.websiteUrl && (
            <Button variant="outline" asChild size="sm" className="mt-3 mr-2">
              <a href={coach.websiteUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="mr-2 h-4 w-4"/> Visit Website
              </a>
            </Button>
          )}
          {coach.subscriptionTier === 'premium' && coach.introVideoUrl && (
             <Button variant="outline" asChild size="sm" className="mt-3">
              <a href={coach.introVideoUrl} target="_blank" rel="noopener noreferrer">
                <Video className="mr-2 h-4 w-4"/> Watch Intro
              </a>
            </Button>
          )}
          <Button asChild size="lg" className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
            <Link href={`/messages/new?coachId=${coach.id}`}>
              <MessageSquare className="mr-2 h-5 w-5" /> Message {coach.name.split(' ')[0]}
            </Link>
          </Button>
        </div>
      </section>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">About {coach.name.split(' ')[0]}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none text-foreground/90">
          <p>{coach.bio}</p>
        </CardContent>
      </Card>

      {/* Specialties & Keywords */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-6 w-6 text-primary" /> Specialties</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              {coach.specialties.map(s => <li key={s}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Star className="mr-2 h-6 w-6 text-primary" /> Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {coach.keywords.map(k => <Badge key={k} variant="outline">{k}</Badge>)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Credentials & Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Credentials & Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {coach.certifications && coach.certifications.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500"/>Certifications</h3>
              <ul className="list-disc list-inside space-y-1 text-foreground/80">
                {coach.certifications.map(cert => <li key={cert}>{cert}</li>)}
              </ul>
            </div>
          )}
          {coach.subscriptionTier === 'premium' && coach.socialLinks && coach.socialLinks.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-blue-500"/>Social Media</h3>
              <div className="flex flex-wrap gap-4">
                {coach.socialLinks.map(link => (
                  <Button key={link.platform} variant="link" asChild className="p-0 h-auto">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="capitalize">
                      {link.platform} Profile
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          )}
           {coach.subscriptionTier === 'free' && (
             <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-muted-foreground"/>Social Media</h3>
                <p className="text-sm text-muted-foreground">Social media links are available for Premium coaches. <Link href="/pricing" className="text-primary hover:underline">Upgrade now</Link>.</p>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Recent Blog Posts by Coach */}
      {coachBlogPosts.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-6 flex items-center"><BookOpen className="mr-3 h-7 w-7 text-primary"/>Recent Articles by {coach.name.split(' ')[0]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {coachBlogPosts.map(post => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

export async function generateStaticParams() {
  return mockCoaches.map(coach => ({ id: coach.id }));
}
