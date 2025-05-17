
// This type is used by the AuthContext and represents the authenticated user's basic info.
// More detailed profiles (especially for coaches) would be fetched from Firestore.
export type UserRole = 'user' | 'coach' | 'admin';

export interface User {
  id: string; // Firebase Auth UID
  email: string | null; // Email can be null from Firebase
  role: UserRole;
  name?: string;
  profileImageUrl?: string;
}

// This type represents the detailed Coach profile, often fetched from Firestore
// and extending the basic User type or linked by ID.
export interface Coach {
  id: string; // Should match Firebase Auth UID if the coach is a user
  name: string;
  email?: string; // Contact email, may differ from auth email
  bio: string;
  specialties: string[];
  keywords: string[];
  profileImageUrl?: string;
  dataAiHint?: string; // For placeholder image generation
  certifications?: string[];
  socialLinks?: { platform: string; url: string }[];
  location?: string;
  availability?: string;
  subscriptionTier: 'free' | 'premium';
  websiteUrl?: string; // Premium
  introVideoUrl?: string; // Premium
  // createdAt and updatedAt would be Timestamps in Firestore, converted to string for frontend
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  dataSource?: string; // For debugging data source
}

// This type is primarily for frontend display and components.
// Data fetched from Firestore (FirestoreBlogPost) will be mapped to this.
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string; // Markdown content
  excerpt?: string;
  authorId: string;
  authorName: string; // Denormalized for easier display
  createdAt: string; // ISO date string (converted from Firestore Timestamp)
  updatedAt: string; // ISO date string (converted from Firestore Timestamp)
  status: 'draft' | 'pending_approval' | 'published' | 'rejected';
  tags?: string[];
  featuredImageUrl?: string;
  dataAiHint?: string; // For placeholder image generation
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
  imageUrl?: string;
  dataAiHint?: string;
  designation?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string; // ISO date string (converted from Firestore Timestamp)
  read: boolean;
}
