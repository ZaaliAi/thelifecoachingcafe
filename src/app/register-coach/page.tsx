'use client';

import { Suspense } from 'react';
import RegisterCoachForm from '@/components/auth/RegisterCoachForm';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function RegisterCoachPageContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');

  return <RegisterCoachForm planId={planId} />;
}

export default function RegisterCoachPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <RegisterCoachPageContent />
    </Suspense>
  );
}
