
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: "Terms and Conditions | The Life Coaching Cafe",
    description: "Review the Terms and Conditions for using The Life Coaching Cafe website and services. Understand your rights and responsibilities.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Terms and Conditions | The Life Coaching Cafe",
      description: "Review the Terms and Conditions for using The Life Coaching Cafe website and services. Understand your rights and responsibilities.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/terms-and-conditions', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Terms and Conditions | The Life Coaching Cafe",
      description: "Review the Terms and Conditions for using The Life Coaching Cafe website and services. Understand your rights and responsibilities.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function TermsAndConditionsPage() {
  const companyName = "The Life Coaching Cafe";
  const companyUrl = "www.thelifecoachingcafe.com";
  const companyEmail = "hello@thelifecoachingcafe.com";

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary">Terms and Conditions</CardTitle>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Agreement to Terms</h2>
            <p>
              These Terms and Conditions ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and {companyName} ("we," "us," or "our"), concerning your access to and use of the {companyUrl} website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto (collectively, the "Site" or "Services"). You agree that by accessing the Site, you have read, understood, and agreed to be bound by all of these Terms. IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SITE AND YOU MUST DISCONTINUE USE IMMEDIATELY.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Use of Our Services</h2>
            <p>
              Our Services provide a platform for individuals seeking life coaching services ("Users") to connect with life coaches ("Coaches"). We are not a party to any agreement entered into between Users and Coaches. We do not endorse any User or Coach and make no guarantees about the quality, safety, or legality of the services provided by Coaches or the truth or accuracy of User or Coach listings.
            </p>
            <p>
              You agree to use the Services only for lawful purposes and in accordance with these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p>
              To access certain features of the Site, you may be required to register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold">4. User Content</h2>
            <p>
              You may be able to create, post, or share content, such as profile information, blog posts, messages, and reviews ("User Content"). You are solely responsible for your User Content and any consequences of posting or publishing it. You retain all of your ownership rights in your User Content. However, by submitting User Content to the Site, you grant us a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the User Content in connection with the Services and our business.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Intellectual Property Rights</h2>
            <p>
              Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Disclaimers</h2>
            <p>
              THE SITE AND SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SITE AND OUR SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SITE AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
             <p>
              We make no warranties or representations about the accuracy or completeness of the Site's content or the content of any websites linked to the Site and we will assume no liability or responsibility for any (1) errors, mistakes, or inaccuracies of content and materials, (2) personal injury or property damage, of any nature whatsoever, resulting from your access to and use of the site, ...
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
            <p>
              IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SITE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Governing Law</h2>
            <p>
              These Terms and your use of the Site are governed by and construed in accordance with the laws of the jurisdiction in which {companyName} is established, without regard to its conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will post the revised Terms on the Site and update the "Last updated" date. Your continued use of the Site after such posting constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Contact Us</h2>
            <p>
              To resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at:
            </p>
            <p>
              {companyName}<br />
              Email: <Link
              href={`mailto:${companyEmail}`}
              className="text-primary hover:underline"
              >{companyEmail}</Link><br />
              Website: <Link
              href={`https://${companyUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              >{companyUrl}</Link>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
