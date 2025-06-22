
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, UserCircle, Edit3, FileText, MessageSquare, Users, ShieldAlert, LogOut, Settings, Loader2, UserX, Heart, CreditCard, MessageSquareText, Menu } from 'lucide-react';
import React, { useEffect } from 'react';

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
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const accessibleNavItems = navItems.filter(item => {
    if (!item.roles.includes(user.role)) {
      return false;
    }
    if (item.requiresPremium) {
      // Assuming you have subscriptionTier on your user object from useAuth
      return (user as any).subscriptionTier === 'premium';
    }
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <aside className="fixed hidden md:block md:w-64 bg-gray-100 dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
        <ScrollArea className="h-full">
          <nav className="flex flex-col space-y-2">
            {accessibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-primary/10',
                  pathname === item.href && 'bg-primary/10 text-primary font-medium'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            <Button variant="ghost" onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-destructive hover:bg-destructive/10 justify-start mt-auto">
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </nav>
        </ScrollArea>
      </aside>
      <main className="flex-1 md:ml-64 p-6">
        {children}
      </main>
    </div>
  );
}
