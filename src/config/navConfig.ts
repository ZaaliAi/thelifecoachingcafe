import type { ElementType } from 'react';
import {
  LayoutDashboard,
  UserCircle,
  Edit3,
  FileText,
  MessageSquare,
  Users,
  ShieldAlert,
  // LogOut, // LogOut is not part of navItems, it was a separate button
  Settings,
  UserX,
  Heart,
  CreditCard,
  MessageSquareText
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  roles: ('user' | 'coach' | 'admin')[];
  requiresPremium?: boolean;
}

export const navItems: NavItem[] = [
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
