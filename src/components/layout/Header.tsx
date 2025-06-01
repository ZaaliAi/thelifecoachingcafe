"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Search, BookOpen, LogIn, UserPlus, UserCircle, LogOut, Menu, LayoutDashboard, ShieldAlert, Users, Tag, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { getUserUnreadMessageCount } from '@/lib/firestore';

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/find-a-coach', label: 'CoachMatch AI', icon: Search },
  { href: '/browse-coaches', label: 'Browse Coaches', icon: Users },
  { href: '/blog', label: 'Blog', icon: BookOpen },
  // { href: '/pricing', label: 'Pricing', icon: Tag }, // Removed pricing link
];

const NavLinkItem = ({ href, label, icon: Icon, onClick, variant = "default" }: { href: string; label: string; icon: React.ElementType; onClick?: () => void, variant?: "default" | "ghost" | "primary" }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  const baseClasses = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors";
  let activeClasses = "";
  let inactiveClasses = "";

  if (variant === "primary") {
    activeClasses = "bg-primary text-primary-foreground"; 
    inactiveClasses = "bg-primary text-primary-foreground hover:bg-primary/90";
  } else {
    activeClasses = "bg-primary/20 text-primary";
    inactiveClasses = "text-foreground/70 hover:text-foreground hover:bg-muted";
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        baseClasses,
        isActive ? activeClasses : inactiveClasses,
        variant === "primary" && inactiveClasses
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
};

export function Header() {
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  const dashboardLink = user ? `/dashboard/${user.role}` : '/login';
  const dashboardLabel = user ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard` : '';
  const DashboardIcon = user?.role === 'admin' ? ShieldAlert : user?.role === 'coach' ? LayoutDashboard : UserCircle;
  
  const messagesPageLink = user 
    ? user.role === 'coach' ? '/dashboard/coach/messages' 
    : user.role === 'user' ? '/dashboard/user/messages' 
    : user.role === 'admin' ? '/dashboard/admin/messages'
    : '/login'
    : '/login';

  useEffect(() => {
    if (user && user.id) {
      getUserUnreadMessageCount(user.id)
        .then(count => {
          setUnreadCount(count);
        })
        .catch(error => {
          console.error("Failed to fetch unread message count:", error);
        });
    } else {
      setUnreadCount(0);
    }
  }, [user, pathname]);

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/coachconnect-897af.firebasestorage.app/o/aaadb032-0d6f-4c06-a8a5-6a6064b4fb06_removalai_preview.png?alt=media&token=0c82d001-1e15-440d-bded-37de001e2d31";

  const closeMobileMenu = () => setMobileMenuOpen(false);
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="The Life Coaching Cafe Home">
          <Image src={logoUrl} alt="The Life Coaching Cafe Logo" width={160} height={40} priority className="object-contain" style={{ height: 'auto' }}/>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {navLinks.filter(link => link.href !== '/').map(link => (
            <NavLinkItem key={link.href} href={link.href} label={link.label} icon={link.icon} />
          ))}
          {!loading && (
            user ? (
              <>
                {unreadCount > 0 && (
                  <Link href={messagesPageLink} className="relative p-2 text-foreground/70 hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                      {unreadCount}
                    </span>
                  </Link>
                )}
                <NavLinkItem href={dashboardLink} label={dashboardLabel} icon={DashboardIcon} />
                <Button variant="ghost" onClick={logout} className="flex items-center gap-2 text-foreground/70 hover:text-foreground">
                  <LogOut className="h-5 w-5" /> Logout
                </Button>
              </>
            ) : (
              <>
                <NavLinkItem href="/login" label="Login" icon={LogIn} />
                <NavLinkItem href="/signup" label="User Sign Up" icon={UserPlus} /> {/* MODIFIED HERE */}
                <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary">
                  <a href="/pricing">
                    Register as a Coach
                  </a>
                </Button>
              </>
            )
          )}
        </nav>

        {/* Mobile Navigation Trigger */}
        <div className="md:hidden flex items-center">
          {!loading && user && unreadCount > 0 && (
            <Link href={messagesPageLink} className="relative p-2 mr-2 text-foreground/70 hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {unreadCount}
              </span>
            </Link>
          )}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-6">
              <SheetHeader>
                <SheetTitle className="sr-only">Main Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-4 mt-4">
                <Link href="/" className="flex items-center mb-4" onClick={closeMobileMenu} aria-label="The Life Coaching Cafe Home">
                  <Image src={logoUrl} alt="The Life Coaching Cafe Logo" width={160} height={40} priority className="object-contain" style={{ height: 'auto' }}/>
                </Link>
                {navLinks.map(link => ( 
                    (<NavLinkItem key={link.href} {...link} onClick={closeMobileMenu} />)
                ))}
                <hr className="my-2 border-border" />
                {!loading && (
                  user ? (
                    <>
                      {unreadCount > 0 && (
                        <Link href={messagesPageLink} onClick={closeMobileMenu} className="relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-foreground/70 hover:text-foreground hover:bg-muted">
                          <Bell className="h-5 w-5" />
                          <span>Messages</span>
                          <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                            {unreadCount}
                          </span>
                        </Link>
                      )}
                      <NavLinkItem href={dashboardLink} label={dashboardLabel} icon={DashboardIcon} onClick={closeMobileMenu} />
                      <Button variant="ghost" onClick={() => { logout(); closeMobileMenu(); }} className="flex items-center gap-2 text-foreground/70 hover:text-foreground justify-start px-3 py-2 w-full">
                        <LogOut className="h-5 w-5" /> Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <NavLinkItem href="/login" label="Login" icon={LogIn} onClick={closeMobileMenu} />
                      <NavLinkItem href="/signup" label="User Sign Up" icon={UserPlus} onClick={closeMobileMenu} /> {/* MODIFIED HERE */}
                      <Button asChild variant="outline" onClick={closeMobileMenu} className="border-primary text-primary hover:bg-primary/10 hover:text-primary w-full justify-start px-3 py-2">
                        <a href="/pricing">
                           Register as a Coach
                        </a>
                      </Button>
                    </>
                  )
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
