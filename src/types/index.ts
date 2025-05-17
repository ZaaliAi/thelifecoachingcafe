
export interface Coach {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  keywords: string[];
  profileImageUrl?: string;
  certifications?: string[];
  socialLinks?: { platform: string; url: string }[];
  location?: string; 
  availability?: string; 
  email?: string;
  subscriptionTier: 'free' | 'premium';
  websiteUrl?: string;
  introVideoUrl?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string; // Denormalized for easier display
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  status: 'draft' | 'pending_approval' | 'published' | 'rejected';
  tags?: string[];
  featuredImageUrl?: string;
  excerpt?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
  imageUrl?: string;
  designation?: string; // e.g., "User of CoachConnect" or "Client of Coach X"
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string; // ISO date string
  read: boolean;
}

export type UserRole = 'user' | 'coach' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string; // Optional name
  profileImageUrl?: string; // For users as well
}
