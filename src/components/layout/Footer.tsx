
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="flex justify-center space-x-4 mb-2">
          <Link href="/about" className="hover:text-primary transition-colors">
            About Us
          </Link>
          <Link href="/blog" className="hover:text-primary transition-colors">
            Blog
          </Link>
          <Link href="/pricing" className="hover:text-primary transition-colors">
            Pricing
          </Link>
          {/* Add other footer links here if needed, e.g., Contact, Terms, Privacy */}
        </div>
        <p>&copy; {new Date().getFullYear()} CoachConnect. All rights reserved.</p>
        <p className="mt-1">
          Built with passion to connect you with your ideal life coach.
        </p>
      </div>
    </footer>
  );
}
