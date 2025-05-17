
"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, MessageSquare, ArrowLeft } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { mockCoaches } from '@/data/mock'; // To get coach name by ID
import Link from 'next/link';

const messageSchema = z.object({
  content: z.string().min(10, 'Message must be at least 10 characters long.'),
});

type MessageFormData = z.infer<typeof messageSchema>;

export default function NewMessagePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [coachName, setCoachName] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const coachId = searchParams.get('coachId');

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please log in to send a message.", variant: "destructive" });
      router.push(`/login?redirect=/messages/new?coachId=${coachId}`);
    }
    if (coachId) {
      const coach = mockCoaches.find(c => c.id === coachId);
      setCoachName(coach ? coach.name : "Selected Coach");
    } else {
        setCoachName("a Coach"); // Fallback if no ID
    }
  }, [coachId, user, authLoading, router, toast]);

  const { register, handleSubmit, formState: { errors } } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
  });

  const onSubmit: SubmitHandler<MessageFormData> = async (data) => {
    if (!user || !coachId) {
        toast({ title: "Error", description: "Cannot send message. User or Coach ID missing.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    console.log('Sending message:', { ...data, coachId, senderId: user.id });
    // Simulate API call to send message
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    toast({
      title: "Message Sent!",
      description: `Your message to ${coachName || 'the coach'} has been sent successfully.`,
    });
    // Redirect to messages overview or conversation thread
    router.push(user.role === 'user' ? '/dashboard/user/messages' : `/dashboard/coach/messages`); 
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading...</div>;
  }
  
  if (!coachId || !coachName) {
      return (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>Coach ID not specified or coach not found.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline"><Link href="/find-a-coach">Find a Coach</Link></Button>
            </CardContent>
          </Card>
      )
  }


  return (
    <Card className="max-w-xl mx-auto shadow-lg">
        <CardHeader>
            <Button variant="outline" size="sm" asChild className="w-fit mb-4">
                <Link href={coachId ? `/coach/${coachId}` : '/find-a-coach'}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to {coachName ? `Profile` : 'Coaches'}
                </Link>
            </Button>
            <CardTitle className="text-2xl flex items-center">
            <MessageSquare className="mr-3 h-7 w-7 text-primary" />
            Send a Message to {coachName}
            </CardTitle>
            <CardDescription>Compose your message below. The coach will be notified and can reply via the platform.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="content">Your Message</Label>
                <Textarea 
                id="content" 
                {...register('content')} 
                rows={8} 
                placeholder={`Type your message to ${coachName} here...`} 
                className={errors.content ? 'border-destructive' : ''} 
                />
                {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
            </div>
            </CardContent>
            <CardFooter className="pt-6 border-t">
            <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                </>
                ) : (
                <><Send className="mr-2 h-5 w-5" /> Send Message</>
                )}
            </Button>
            </CardFooter>
        </form>
    </Card>
  );
}

