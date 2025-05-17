
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, BookOpen, LogIn, UserPlus, UserCircle, LogOut, Menu, LayoutDashboard, ShieldAlert, Users, DollarSign, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/Logo';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/find-a-coach', label: 'CoachMatch AI', icon: Search },
  { href: '/browse-coaches', label: 'Browse Coaches', icon: Users },
  { href: '/blog', label: 'Blog', icon: BookOpen },
  { href: '/pricing', label: 'Pricing', icon: DollarSign },
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
    activeClasses = "bg-primary/20 text-primary"; // Updated active class for better visibility
    inactiveClasses = "text-foreground/70 hover:text-foreground hover:bg-muted";
  }


  return (
    <Link href={href} passHref legacyBehavior>
      <a
        onClick={onClick}
        className={cn(
          baseClasses,
          isActive ? activeClasses : inactiveClasses,
          variant === "primary" && inactiveClasses 
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </a>
    </Link>
  );
};


export function Header() {
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardLink = user ? `/dashboard/${user.role}` : '/login';
  const dashboardLabel = user ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard` : '';
  const DashboardIcon = user?.role === 'admin' ? ShieldAlert : user?.role === 'coach' ? LayoutDashboard : UserCircle;


  const closeMobileMenu = () => setMobileMenuOpen(false);

  const commonNavLinks = navLinks.map(link => (
    <NavLinkItem key={link.href} {...link} onClick={closeMobileMenu} />
  ));

  const authNavLinks = user ? (
    <>
      <NavLinkItem href={dashboardLink} label={dashboardLabel} icon={DashboardIcon} onClick={closeMobileMenu}/>
      <Button variant="ghost" onClick={() => { logout(); closeMobileMenu(); }} className="flex items-center gap-2 text-foreground/70 hover:text-foreground">
        <LogOut className="h-5 w-5" /> Logout
      </Button>
    </>
  ) : (
    <>
      <NavLinkItem href="/login" label="Login" icon={LogIn} onClick={closeMobileMenu}/>
      <NavLinkItem href="/signup" label="Sign Up" icon={UserPlus} onClick={closeMobileMenu}/>
      <Button asChild variant="outline" onClick={closeMobileMenu} className="border-primary text-primary hover:bg-primary/10 hover:text-primary">
        <Link href="/register-coach">
          Register as a Coach
        </Link>
      </Button>
    </>
  );
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="CoachConnect Home">
          <Logo className="h-8 w-auto" />
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {commonNavLinks}
          {!loading && authNavLinks}
        </nav>

        {/* Mobile Navigation Trigger */}
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-6">
              <div className="flex flex-col space-y-4">
                <Link href="/" className="flex items-center gap-2 mb-4" onClick={closeMobileMenu}>
                  <Logo className="h-8 w-auto" />
                </Link>
                {commonNavLinks}
                <hr className="my-2 border-border" />
                {!loading && (
                  user ? (
                    <>
                      <NavLinkItem href={dashboardLink} label={dashboardLabel} icon={DashboardIcon} onClick={closeMobileMenu}/>
                      <Button variant="ghost" onClick={() => { logout(); closeMobileMenu(); }} className="flex items-center gap-2 text-foreground/70 hover:text-foreground justify-start px-3 py-2">
                        <LogOut className="h-5 w-5" /> Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <NavLinkItem href="/login" label="Login" icon={LogIn} onClick={closeMobileMenu}/>
                      <NavLinkItem href="/signup" label="Sign Up" icon={UserPlus} onClick={closeMobileMenu}/>
                      <Button asChild variant="outline" onClick={closeMobileMenu} className="border-primary text-primary hover:bg-primary/10 hover:text-primary w-full justify-start px-3 py-2">
                        <Link href="/register-coach">
                           Register as a Coach
                        </Link>
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
