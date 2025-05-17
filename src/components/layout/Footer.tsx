
export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} CoachConnect. All rights reserved.</p>
        <p className="mt-1">
          Built with passion to connect you with your ideal life coach.
        </p>
      </div>
    </footer>
  );
}
