
// This type is used by the AuthContext and represents the authenticated user's basic info.
export type UserRole = 'user' | 'coach' | 'admin';

export interface User {
  id: string; // Firebase Auth UID
  email: string; // Should always be a string from Firebase Auth
  role: UserRole;
  name?: string;
  profileImageUrl?: string | null; // Explicitly allow null
}

// Updated Availability Structure
export type CoachAvailability = Array<{
  day: string;
  time: string;
}>;

// Firestore specific user profile structure
export type CoachStatus = 'pending_approval' | 'approved' | 'rejected';

export interface FirestoreUserProfile {
  id: string; // Firebase Auth UID. This is the document ID in Firestore.
  name: string;
  email: string; // User's email, should match Auth email.
  role: UserRole;
  createdAt: any; // Firestore Timestamp on server, Date on client after fetch
  updatedAt: any; // Firestore Timestamp on server, Date on client after fetch
  bio?: string;
  specialties?: string[];
  keywords?: string[];
  profileImageUrl?: string | null; // URL from Firebase Storage or null
  certifications?: string[];
  location?: string | null;
  websiteUrl?: string | null; // Premium feature
  introVideoUrl?: string | null; // Premium feature
  socialLinks?: { platform: string; url: string }[]; // Premium feature
  subscriptionTier?: 'free' | 'premium';
  status?: CoachStatus; // For coach approval by admin
  dataAiHint?: string;
  availability?: CoachAvailability; // Uses the new array-based type
  isFeatured?: boolean; 
  favoriteCoachIds?: string[]; // Added for favoriting coaches
  enableNotifications?: boolean; // For user settings
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
  location?: string | null;
  availability?: CoachAvailability; // Uses the new array-based type
  subscriptionTier: 'free' | 'premium';
  websiteUrl?: string | null;
  introVideoUrl?: string | null;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  status?: CoachStatus;
  dataSource?: string;
  isFeatured?: boolean;
  matchScore?: number;
  averageRating?: number;
  reviewCount?: number;
  tagline?: string;
}

// Type for Firestore Timestamps or JS Date objects (for flexibility)
type FirebaseTimestampOrDate = any; // Simplification, ideally import firebase.firestore.Timestamp

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
  featuredImageUrl?: string | null; // Allow null
  dataAiHint?: string;
}


// Distinct type for Homepage Testimonials (managed by Admin)
export interface HomepageTestimonial {
  id: string;
  name: string;  // The name of the person giving the testimonial
  text: string;  // The content of the testimonial
  createdAt: string | null;
  updatedAt?: string | null;
}

// Renamed to CoachTestimonial for clarity
export interface CoachTestimonial {
  id: string;
  coachId: string;
  clientName: string;
  testimonialText: string;
  createdAt: string | null; 
  updatedAt?: string | null;
  dataAiHint?: string;
}

// For application use (timestamp is ISO string)
export interface Message {
  id: string;
  senderId: string;
  senderName?: string; // Denormalized for display
  recipientId: string; // Changed from receiverId for consistency
  recipientName?: string; // Denormalized for display
  content: string;
  timestamp: string; // ISO date string
  read: boolean;
  conversationId: string; // Added field
  // For UI display, not stored in Firestore directly on this object usually
  otherPartyName?: string;
  otherPartyAvatar?: string | null;
  dataAiHint?: string;
}

// For Firestore storage (timestamp is Firestore Timestamp)
export interface FirestoreMessage {
  id?: string; // Firestore document ID
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: FirebaseTimestampOrDate; // Firestore Server Timestamp
  read: boolean;
  conversationId: string; // Added field
}
