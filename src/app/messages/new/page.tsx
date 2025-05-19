import { Suspense } from 'react';
import NewMessageForm from '@/components/messaging/NewMessageForm';
import { Loader2 } from 'lucide-react';

// A simple fallback UI for Suspense
function LoadingFallback() {
  return (
    <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <span className="ml-2">Loading Page...</span>
    </div>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NewMessageForm />
    </Suspense>
  );
}
