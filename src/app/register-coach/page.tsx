'''use client''';

import { Suspense } from 'react'; // Removed useEffect
import RegisterCoachForm from '@/components/auth/RegisterCoachForm';
import { Loader2 } from 'lucide-react';
// import { useAuth } from '@/lib/auth'; // No longer needed for page-level redirect
// import { useRouter } from 'next/navigation'; // No longer needed for page-level redirect
import { useSearchParams } from 'next/navigation'; // Added for reading query params

// It's good practice to wrap the component that uses useSearchParams in Suspense
// if it's rendered directly by a Server Component parent, or if parts of the page are static.
// Here, we'll ensure the main logic is in a client component that can use the hook.

function RegisterCoachPageContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');

  return <RegisterCoachForm planId={planId} />;
}

export default function RegisterCoachPage() {
  return (
    // Suspense is good practice when using useSearchParams in a child component
    // It allows streaming and prevents the whole page from being dynamic if not necessary
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <RegisterCoachPageContent />
    </Suspense>
  );
}
