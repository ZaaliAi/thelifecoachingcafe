
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link'; // Keep Link, it might be used by accessibleNavItems if they are rendered directly on pages
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
// Button and ScrollArea might be used by accessibleNavItems if rendered directly on pages, keep for now.
// If not, they can be removed when those pages are implemented.
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, UserCircle, Edit3, FileText, MessageSquare, Users, ShieldAlert, LogOut, Settings, Loader2, UserX, Heart, CreditCard, MessageSquareText } from 'lucide-react'; // Removed Menu
import React, { useEffect } from 'react';
// Removed Sidebar imports

// ... (navItems array remains the same)
const navItems: NavItem[] = [
  // User specific
  { href: '/dashboard/user', label: 'My Profile', icon: UserCircle, roles: ['user'] },
  { href: '/dashboard/user/messages', label: 'My Messages', icon: MessageSquare, roles: ['user'] },
  { href: '/dashboard/user/favorites', label: 'My Favorites', icon: Heart, roles: ['user'] },
  { href: '/dashboard/user/settings', label: 'Settings', icon: Settings, roles: ['user'] },
  // Coach specific
  { href: '/dashboard/coach', label: 'Overview', icon: LayoutDashboard, roles: ['coach'] },
  { href: '/dashboard/coach/profile', label: 'Edit Profile', icon: Edit3, roles: ['coach'] },
  { href: '/dashboard/coach/blog', label: 'My Blog Posts', icon: FileText, roles: ['coach'] },
  { href: '/dashboard/coach/testimonials', label: 'My Testimonials', icon: MessageSquareText, roles: ['coach'], requiresPremium: true },
  { href: '/dashboard/coach/messages', label: 'Client Messages', icon: MessageSquare, roles: ['coach'] },
  { href: '/dashboard/coach/billing', label: 'Billing', icon: CreditCard, roles: ['coach'] },
  { href: '/dashboard/coach/settings', label: 'Settings', icon: Settings, roles: ['coach'] },
  // Admin specific
  { href: '/dashboard/admin', label: 'Admin Overview', icon: ShieldAlert, roles: ['admin'] },
  { href: '/dashboard/admin/coaches', label: 'Manage Coaches', icon: Users, roles: ['admin'] },
  { href: '/dashboard/admin/users', label: 'Manage Users', icon: UserX, roles: ['admin'] }, 
  { href: '/dashboard/admin/blogs', label: 'Manage Blogs', icon: FileText, roles: ['admin'] },
  { href: '/dashboard/admin/testimonials', label: 'Testimonials', icon: FileText, roles: ['admin'] },
  { href: '/dashboard/admin/messages', label: 'Message Logs', icon: MessageSquare, roles: ['admin'] },
  { href: '/dashboard/admin/settings', label: 'Platform Settings', icon: Settings, roles: ['admin'] },
];

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('user' | 'coach' | 'admin')[];
  requiresPremium?: boolean;
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, firebaseUser, loading, logout } = useAuth(); // Use firebaseUser for auth check
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
