
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/about" className="hover:text-primary transition-colors">
            About Us
          </Link>
          <Link href="/blog" className="hover:text-primary transition-colors">
            Blog
          </Link>
          <Link href="/pricing" className="hover:text-primary transition-colors">
            Pricing
          </Link>
           <Link href="/faq" className="hover:text-primary transition-colors">
            FAQ
          </Link>
          <Link href="/contact-us" className="hover:text-primary transition-colors">
            Contact Us
          </Link>
          <Link href="/privacy-policy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-and-conditions" className="hover:text-primary transition-colors">
            Terms & Conditions
          </Link>
        </div>
        <p>&copy; {new Date().getFullYear()} The Life Coaching Cafe. All rights reserved.</p>
        <p className="mt-1">
          Built with passion to connect you with your ideal life coach.
        </p>
      </div>
    </footer>
  );
}
