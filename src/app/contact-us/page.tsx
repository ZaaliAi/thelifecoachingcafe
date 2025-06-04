"use client";

import { Mail, MessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase'; // <--- CHANGED THIS LINE
import { useToast } from "@/hooks/use-toast";

export default function ContactUsPage() {
  const { toast } = useToast();
  const companyEmail = "hello@thelifecoachingcafe.com";
  const companyPhone = "+1 (555) 123-4567"; // Placeholder - will be removed from display

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">Contact Us</h1>
        <p className="mt-4 text-lg leading-6 text-muted-foreground">
          We&apos;d love to hear from you! Please reach out with any questions, feedback, or inquiries.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-semibold text-primary mb-6 text-center">Get in Touch Directly</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <Mail className="mr-3 h-6 w-6 text-primary" /> Email Us
              </h3>
              <p className="text-muted-foreground mb-1">
                For general inquiries, support, or feedback:
              </p>
              <a href={`mailto:${companyEmail}`} className="text-primary hover:underline break-all font-medium">
                {companyEmail}
              </a>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-semibold mb-3 flex items-center">
                <MessageSquare className="mr-3 h-6 w-6 text-primary" /> Live Chat Support <span className="text-sm text-muted-foreground ml-2">(Coming Soon)</span>
              </h3>
              <p className="text-muted-foreground mb-4">
                Need immediate assistance? Chat with our support team.
              </p>
              <button
                type="button"
                disabled // Placeholder: enable when live chat is implemented
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-70"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-primary mb-6 text-center">Send Us a Message</h2>
          <form
            className="space-y-6 bg-card p-8 rounded-lg shadow-lg"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              setStatusMessage(null); // Clear previous status

              try {
                // Use firebaseApp here as it's the imported name
                const functions = getFunctions(firebaseApp); 
                const sendContactMessage = httpsCallable(functions, 'sendContactMessage');

                const result = await sendContactMessage({ name, email, subject, message });

                // Assuming the callable function returns a success indicator in result.data
                if (result.data && (result.data as any).success) {
                  setStatusMessage("Message sent successfully! We will get back to you shortly.");
                  toast({ title: "Success", description: "Your message has been sent.", variant: "default" });
                  // Reset form fields
                  setName('');
                  setEmail('');
                  setSubject('');
                  setMessage('');
                } else {
                   // Handle errors returned by the callable function
                  const errorMessage = (result.data as any)?.error || "Failed to send message. Please try again.";
                  setStatusMessage(`Error: ${errorMessage}`);
                  toast({ title: "Error", description: errorMessage, variant: "destructive" });
                }
              } catch (error: any) {
                console.error("Error calling sendContactMessage callable function:", error);
                setStatusMessage(`Error sending message: ${error.message || "An unexpected error occurred."}`);
                toast({ title: "Error", description: error.message || "An unexpected error occurred while sending your message.", variant: "destructive" });
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Your Full Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-1">Subject</label>
              <input
                type="text"
                name="subject"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="How can we help?"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">Message</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Your message..."
              ></textarea>
            </div>
            {statusMessage && (
              <p className={`text-center text-sm ${statusMessage.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {statusMessage}
              </p>
            )}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary py-2.5 px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Message'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}