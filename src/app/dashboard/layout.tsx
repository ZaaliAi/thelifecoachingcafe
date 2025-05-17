
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, UserCircle, Edit3, FileText, MessageSquare, Users, ShieldAlert, LogOut, Settings, Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('user' | 'coach' | 'admin')[];
}

const navItems: NavItem[] = [
  // User specific
  { href: '/dashboard/user', label: 'My Profile', icon: UserCircle, roles: ['user'] },
  { href: '/dashboard/user/messages', label: 'My Messages', icon: MessageSquare, roles: ['user'] },
  { href: '/dashboard/user/settings', label: 'Settings', icon: Settings, roles: ['user'] },
  // Coach specific
  { href: '/dashboard/coach', label: 'Overview', icon: LayoutDashboard, roles: ['coach'] },
  { href: '/dashboard/coach/profile', label: 'Edit Profile', icon: Edit3, roles: ['coach'] },
  { href: '/dashboard/coach/blog', label: 'My Blog Posts', icon: FileText, roles: ['coach'] },
  { href: '/dashboard/coach/messages', label: 'Client Messages', icon: MessageSquare, roles: ['coach'] },
  { href: '/dashboard/coach/settings', label: 'Settings', icon: Settings, roles: ['coach'] },
  // Admin specific
  { href: '/dashboard/admin', label: 'Admin Overview', icon: ShieldAlert, roles: ['admin'] },
  { href: '/dashboard/admin/coaches', label: 'Manage Coaches', icon: Users, roles: ['admin'] },
  { href: '/dashboard/admin/blogs', label: 'Manage Blogs', icon: FileText, roles: ['admin'] },
  { href: '/dashboard/admin/messages', label: 'Message Logs', icon: MessageSquare, roles: ['admin'] },
  { href: '/dashboard/admin/settings', label: 'Platform Settings', icon: Settings, roles: ['admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const accessibleNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16)-theme(spacing.16)-2px)]"> {/* Adjust based on header/footer height */}
      <aside className="w-64 border-r bg-muted/40 p-4 hidden md:block">
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
      <div className="flex-1 p-6">
        {/* Mobile Nav can be added here using a Sheet if needed */}
        {children}
      </div>
    </div>
  );
}
