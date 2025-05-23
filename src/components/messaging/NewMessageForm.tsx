"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, MessageSquare, ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getCoachById } from '@/lib/firestore'; // We will no longer call sendFirestoreMessage directly from here
import type { Coach } from '@/types';
import Link from 'next/link';

const messageSchema = z.object({
  content: z.string().min(10, 'Message must be at least 10 characters long.').max(2000, 'Message is too long.'),
});

type MessageFormData = z.infer<typeof messageSchema>;

export default function NewMessageForm() {
  const [isSending, setIsSending] = useState(false);
  const [recipientCoach, setRecipientCoach] = useState<Coach | null>(null);
  const [isLoadingCoach, setIsLoadingCoach] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, getFirebaseAuthToken } = useAuth(); // Added getFirebaseAuthToken
  const coachId = searchParams.get('coachId');

  useEffect(() => {
    if (!coachId) {
      toast({ title: "Error", description: "No coach specified.", variant: "destructive" });
      router.push('/browse-coaches');
      return;
    }

    const fetchCoachDetails = async () => {
      setIsLoadingCoach(true);
      try {
        const coach = await getCoachById(coachId);
        if (coach) {
          setRecipientCoach(coach);
        } else {
          toast({ title: "Coach Not Found", description: "The specified coach could not be found.", variant: "destructive" });
          router.push('/browse-coaches');
        }
      } catch (error) {
        console.error("Error fetching coach details for new message:", error);
        toast({ title: "Error", description: "Could not load coach details.", variant: "destructive" });
        router.push('/browse-coaches');
      } finally {
        setIsLoadingCoach(false);
      }
    };

    fetchCoachDetails();
  }, [coachId, router, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please log in to send a message.", variant: "destructive" });
      // Ensure the redirect URL is correctly encoded
      const redirectUrl = `/messages/new?coachId=${encodeURIComponent(coachId || '')}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [user, authLoading, router, toast, coachId]);


  const { register, handleSubmit, formState: { errors }, reset } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
  });

  const onSubmit: SubmitHandler<MessageFormData> = async (data) => {
    if (!user || !recipientCoach) {
      toast({ title: "Error", description: "Cannot send message. User or Recipient missing.", variant: "destructive" });
      return;
    }
    if (user.id === recipientCoach.id) {
      toast({ title: "Error", description: "You cannot send a message to yourself.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      // Get the user's ID token
      const idToken = await getFirebaseAuthToken(); // Use the new function

      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not verify your session. Please log in again.", variant: "destructive" });
        setIsSending(false);
        // Optional: Redirect to login
        const redirectUrl = `/messages/new?coachId=${encodeURIComponent(coachId || '')}`;
        router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include the ID token in the Authorization header
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientId: recipientCoach.id,
          content: data.content,
          // Do NOT send senderId, senderName from the client.
          // The backend will get the senderId from the verified ID token.
          // The backend can fetch senderName from the database if needed, or you can pass it
          // to the API and trust it for *display purposes only* on the backend,
          // but the senderId MUST come from the verified token.
          // For simplicity here, we'll let the backend handle getting senderName.
        }),
      });

      if (!response.ok) {
        // Attempt to read error message from the backend response
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Assuming the backend returns success or the new message ID upon success
      // const result = await response.json(); // If your API returns something on success

      toast({
        title: "Message Sent!",
        description: `Your message to ${recipientCoach.name} has been sent successfully.`
      });
      reset(); // Clear the form

      // Navigate to the specific conversation page
      const conversationId = [user.id, recipientCoach.id].sort().join('_');
      router.push(`/dashboard/messages/${conversationId}`);

    } catch (error: any) {
      console.error("Error sending message via API:", error);
      toast({
        title: "Send Error",
        description: error.message || "Could not send your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };


  if (authLoading || isLoadingCoach) {
    return (
      <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
        <Card className="max-w-xl mx-auto text-center py-12">
            <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
            <CardContent><p>You need to be logged in to send a message.</p><Button asChild className="mt-4"><Link href={`/login?redirect=${encodeURIComponent(`/messages/new?coachId=${encodeURIComponent(coachId || '')}`)}`}>Log In</Link></Button></CardContent>
        </Card>
    );
  }

  if (!recipientCoach) {
      return (
          <Card className="max-w-xl mx-auto text-center py-12">
            <CardHeader>
                <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
                <CardTitle className="text-destructive">Coach Not Found</CardTitle>
                <CardDescription>The coach you are trying to message could not be found.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline"><Link href="/browse-coaches">Browse Coaches</Link></Button>
            </CardContent>
          </Card>
      )
  }

  return (
    <Card className="max-w-xl mx-auto shadow-lg">
      <CardHeader>
          {/* Updated Link usage */}
          <Button variant="outline" size="sm" asChild className="w-fit mb-4">
              <Link href={coachId ? `/coach/${encodeURIComponent(coachId)}` : '/browse-coaches'}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to {recipientCoach.name ? `${recipientCoach.name.split(' ')[0]}'s Profile` : 'Coaches'}
              </Link>
          </Button>
          <CardTitle className="text-2xl flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" />
          Send a Message to {recipientCoach.name}
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
              placeholder={`Type your message to ${recipientCoach.name} here...`}
              className={errors.content ? 'border-destructive' : ''}
              />
              {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          </CardContent>
          <CardFooter className="pt-6 border-t">
          <Button type="submit" disabled={isSending} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSending ? (
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
