
"use client";

"use client";

// import Link from 'next/link'; // Duplicate, remove if not directly used by layout
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
// Button and ScrollArea are not used in this file anymore after sidebar removal
// import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area';
// Icons for navItems are now in navConfig.ts. Keep only icons used directly in THIS file.
import { Loader2 } from 'lucide-react'; // LogOut was also removed as it was part of sidebar
import React, { useEffect } from 'react';
import { navItems } from '../../config/navConfig'; // Import from new location
// NavItem interface is also now in navConfig.ts, not needed here directly
// No longer importing individual icons like UserCircle, LayoutDashboard etc.

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); // usePathname is used for accessibleNavItems logic below if that stays
  const { user, firebaseUser, loading } = useAuth(); // Removed logout as it was part of sidebar
  const router = useRouter();

  useEffect(() => {
    // Redirect only when loading is complete and we are certain there is no authenticated user
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  // Show a loading screen while the auth state is being determined or the user profile is being fetched.
  // The `!user` check handles the case where auth is complete but the profile is still loading.
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const accessibleNavItems = navItems.filter(item => {
    if (!item.roles.includes(user.role)) {
      return false;
    }
    if (item.requiresPremium) {
      return user.subscriptionTier === 'premium';
    }
    return true;
  });

  return (
    // <SidebarProvider> REMOVED
      <div className="flex mt-16 min-h-[calc(100vh-theme(spacing.16)-theme(spacing.16)-2px)]">
        {/* Mobile Sidebar Trigger REMOVED */}
        {/* <div className="md:hidden fixed top-28 left-4 z-50"> ... </div> */}

        {/* Sidebar component and its children REMOVED */}
        {/* <Sidebar> ... </Sidebar> */}

        <main className="flex-1 p-6 min-w-0"> {/* md:ml-64 REMOVED */}
          {children}
        </main>
      </div>
    // </SidebarProvider> REMOVED
  );
}
