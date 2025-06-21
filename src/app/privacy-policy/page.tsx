
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: "Privacy Policy | The Life Coaching Cafe",
    description: "Read the Privacy Policy for The Life Coaching Cafe to understand how we collect, use, and protect your personal information.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Privacy Policy | The Life Coaching Cafe",
      description: "Read the Privacy Policy for The Life Coaching Cafe to understand how we collect, use, and protect your personal information.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/privacy-policy', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Privacy Policy | The Life Coaching Cafe",
      description: "Read the Privacy Policy for The Life Coaching Cafe to understand how we collect, use, and protect your personal information.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function PrivacyPolicyPage() {
  const companyName = "The Life Coaching Cafe";
  const companyUrl = "www.thelifecoachingcafe.com";
  const companyEmail = "hello@thelifecoachingcafe.com";

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary">Privacy Policy</CardTitle>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              Welcome to our platform, operated by {companyName} ("we", "our", "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website {companyUrl} and use our services (collectively, the "Services"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            <p>
              We may collect personal information from you in a variety of ways, including when you register on the site, create a profile, use our AI matching services, subscribe to our newsletter, respond to a survey, fill out a form, or communicate with us. The types of personal information we may collect include:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Identity Data: Name, email address, username or similar identifier.</li>
              <li>Contact Data: Billing address, delivery address, email address, and telephone numbers.</li>
              <li>Profile Data: Information you provide for your coach or user profile, such as bio, specialties, keywords, coaching needs, feedback, and survey responses.</li>
              <li>Technical Data: Internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
              <li>Usage Data: Information about how you use our website and Services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p>
              Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Services to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Create and manage your account.</li>
              <li>Provide and improve our Services, including personalized coach matching.</li>
              <li>Process your transactions and send you related information, including purchase confirmations and invoices.</li>
              <li>Communicate with you, including responding to your comments, questions, and requests, and providing customer service.</li>
              <li>Send you technical notices, updates, security alerts, and support and administrative messages.</li>
              <li>Monitor and analyse trends, usage, and activities in connection with our Services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Disclosure of Your Information</h2>
            <p>
              We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>By Law or to Protect Rights: If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
              <li>Third-Party Service Providers: We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
              <li>Business Transfers: We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
            </ul>
             <p className="mt-2">
              If you are a coach, some of your profile information will be publicly visible to users of the platform.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold">5. Data Security</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your personal data. To exercise these rights, please contact us at {companyEmail}.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold">7. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at:
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
