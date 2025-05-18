
// This type is used by the AuthContext and represents the authenticated user's basic info.
export type UserRole = 'user' | 'coach' | 'admin';

export interface User {
  id: string; // Firebase Auth UID
  email: string; // Should always be a string from Firebase Auth
  role: UserRole;
  name?: string;
  profileImageUrl?: string; // This will be a URL string from Firebase Storage or null
}

// Firestore specific user profile structure
export type CoachStatus = 'pending_approval' | 'approved' | 'rejected';

export interface FirestoreUserProfile {
  id: string; // Firebase Auth UID. This is the document ID in Firestore.
  name: string;
  email: string; // User's email, should match Auth email.
  role: UserRole;
  createdAt: FirebaseTimestampOrDate; // Firestore Timestamp on server, Date on client after fetch
  updatedAt: FirebaseTimestampOrDate; // Firestore Timestamp on server, Date on client after fetch
  bio?: string;
  specialties?: string[];
  keywords?: string[];
  profileImageUrl?: string | null; // URL from Firebase Storage or null
  certifications?: string[];
  location?: string;
  websiteUrl?: string | null; // Premium feature
  introVideoUrl?: string | null; // Premium feature
  socialLinks?: { platform: string; url: string }[]; // Premium feature
  subscriptionTier?: 'free' | 'premium';
  status?: CoachStatus; // For coach approval by admin
  // Any other fields specific to user settings or profile that aren't in the simpler User type.
  dataAiHint?: string; // for placeholder images if used
}

// This type represents the detailed Coach profile for frontend display,
// often mapped from FirestoreUserProfile.
export interface Coach {
  id: string;
  name: string;
  email?: string;
  bio: string;
  specialties: string[];
  keywords: string[];
  profileImageUrl?: string | null;
  dataAiHint?: string;
  certifications?: string[];
  socialLinks?: { platform: string; url: string }[];
  location?: string;
  availability?: string; // Example, not fully implemented
  subscriptionTier: 'free' | 'premium';
  websiteUrl?: string | null;
  introVideoUrl?: string | null;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  status?: CoachStatus;
  dataSource?: string;
}

// Type for Firestore Timestamps or JS Date objects (for flexibility)
type FirebaseTimestampOrDate = any; // Simplification, ideally import firebase.firestore.Timestamp

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
  updatedAt?: string; // ISO date string (converted from Firestore Timestamp)
  status: 'draft' | 'pending_approval' | 'published' | 'rejected';
  tags?: string[];
  featuredImageUrl?: string;
  dataAiHint?: string;
}

// Firestore specific blog post structure
export interface FirestoreBlogPost {
  id?: string; // Document ID, usually handled separately
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  authorName: string;
  createdAt: FirebaseTimestampOrDate;
  updatedAt?: FirebaseTimestampOrDate;
  status: 'draft' | 'pending_approval' | 'published' | 'rejected';
  tags?: string[];
  featuredImageUrl?: string;
  dataAiHint?: string;
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
