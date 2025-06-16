
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/dashboard/DeleteAccountDialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to delete your account.', variant: 'destructive' });
        return;
    }

    setIsDeleting(true);
    toast({ title: 'Deleting Account...', description: 'This may take a moment. Please wait.' });
    
    try {
      const functions = getFunctions();
      const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
      await deleteUserAccount();
      
      toast({ title: 'Account Deleted', description: 'Your account has been successfully deleted.' });
      // The auth state should change, leading to a redirect, but we can also push manually.
      router.push('/');
    } catch (error: any) {
      console.error("Error calling deleteUserAccount function:", error);
      toast({
        title: 'Error Deleting Account',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldAlert className="mr-2 text-destructive" />
            Account Settings
          </CardTitle>
          <CardDescription>Manage your account settings and actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="font-semibold">Delete Account</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This action is irreversible.
              If you have a premium subscription, it will be cancelled automatically.
            </p>
            <Button
              variant="destructive"
              onClick={() => setIsDialogOpen(true)}
              disabled={isDeleting || !user}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>
      <DeleteAccountDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}
