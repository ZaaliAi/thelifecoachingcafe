"use client";

import { Mail, Phone, MapPin as MapPinIcon, MessageSquare } from 'lucide-react'; // Added MessageSquare

export default function ContactUsPage() {
  const companyEmail = "hello@thelifecoachingcafe.com";
  const companyPhone = "+1 (555) 123-4567";    // Placeholder - will be removed from display
  // const companyAddress = "123 Coaching Lane, Suite 100, Knowledgetown, USA 12345"; // Placeholder - companyAddress is not used anymore

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

        {/* Removed Visit Our Office Section */}
        
        <section>
          <h2 className="text-2xl font-semibold text-primary mb-6 text-center">Send Us a Message</h2>
          <form className="space-y-6 bg-card p-8 rounded-lg shadow-lg">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Full Name</label>
              <input 
                type="text" 
                name="name" 
                id="name" 
                autoComplete="name" 
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
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Your message..."
              ></textarea>
            </div>
            <div>
              <button 
                type="submit"
                disabled // Disabled for now as it's a placeholder
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary py-2.5 px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
              >
                Send Message
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
