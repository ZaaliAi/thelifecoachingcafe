import type { Coach, BlogPost, Testimonial } from '@/types';

export const mockCoaches: Coach[] = [
  {
    id: '1',
    name: 'Dr. Eleanor Vance',
    bio: 'Experienced life coach specializing in career transitions and personal growth. Let me help you unlock your potential and find your true path.',
    specialties: ['Career Coaching', 'Personal Development', 'Mindfulness'],
    keywords: ['career change', 'growth mindset', 'stress management'],
    profileImageUrl: 'https://placehold.co/300x300.png',
    dataAiHint: 'professional woman',
    certifications: ['Certified Professional Coach (CPC)', 'ICF Accredited'],
    socialLinks: [{ platform: 'linkedin', url: 'https://linkedin.com/in/eleanorvance' }],
    location: 'New York, NY',
    subscriptionTier: 'premium',
    websiteUrl: 'https://eleanorvancecoaching.com',
    introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Example video
    isFeaturedOnHomepage: false, // New field
  },
  {
    id: '2',
    name: 'Marcus Chen',
    bio: 'Helping entrepreneurs and leaders build resilience and achieve peak performance. Over 10 years of experience in executive coaching.',
    specialties: ['Executive Coaching', 'Leadership', 'Business Strategy'],
    keywords: ['entrepreneurship', 'performance', 'resilience'],
    profileImageUrl: null, // Free tier coaches do not have a profile image
    dataAiHint: 'confident man',
    certifications: ['Maxwell Leadership Certified Coach'],
    location: 'San Francisco, CA',
    subscriptionTier: 'free',
    isFeaturedOnHomepage: false, // New field
    // No socialLinks, websiteUrl, or introVideoUrl for free tier
  },
  {
    id: '3',
    name: 'Aisha Khan',
    bio: 'Passionate about empowering individuals to overcome obstacles and live a more fulfilling life. Focus on wellness and relationship coaching.',
    specialties: ['Wellness Coaching', 'Relationship Coaching', 'Stress Management'],
    keywords: ['well-being', 'healthy relationships', 'anxiety relief'],
    profileImageUrl: 'https://placehold.co/300x300.png',
    dataAiHint: 'smiling woman',
    socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/aishakhancoach' }],
    location: 'London, UK',
    subscriptionTier: 'premium',
    websiteUrl: 'https://aishakhancoaching.com',
    isFeaturedOnHomepage: false, // New field
    // No introVideoUrl for this premium coach, to show it's optional
  },
];

export const mockBlogPosts: BlogPost[] = [
  {
    id: '1',
    slug: 'unlocking-your-potential-a-guide-to-personal-growth',
    title: 'Unlocking Your Potential: A Guide to Personal Growth',
    content: 'Detailed content about personal growth strategies...',
    excerpt: 'Discover key strategies to unlock your full potential and embark on a journey of continuous self-improvement.',
    authorId: '1',
    authorName: 'Dr. Eleanor Vance',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'published',
    tags: ['Personal Development', 'Growth Mindset'],
    featuredImageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'inspiration journey',
  },
  {
    id: '2',
    slug: 'finding-balance-in-a-hectic-world',
    title: 'Finding Balance in a Hectic World',
    content: 'Tips and techniques for achieving work-life balance...',
    excerpt: "Learn practical tips and techniques to achieve a healthier work-life balance in today's fast-paced environment.",
    authorId: '3',
    authorName: 'Aisha Khan',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'published',
    tags: ['Wellness', 'Stress Management'],
    featuredImageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'serene landscape',
  },
  {
    id: '3',
    slug: 'navigating-career-changes-with-confidence',
    title: 'Navigating Career Changes with Confidence',
    content: 'How to approach career transitions effectively...',
    excerpt: 'Gain insights on how to approach career transitions with confidence and make your next move a successful one.',
    authorId: '1',
    authorName: 'Dr. Eleanor Vance',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending_approval',
    tags: ['Career Coaching', 'Confidence'],
    featuredImageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'crossroads path',
  },
];

export const mockTestimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah L.',
    text: 'CoachConnect helped me find the perfect coach who understood my needs. The AI matching was spot on!',
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'happy person',
    designation: 'User of CoachConnect',
  },
  {
    id: '2',
    name: 'John B.',
    text: "As a coach, registering on CoachConnect was easy, and I love the platform's modern design and features.",
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'professional person',
    designation: 'Life Coach on CoachConnect',
  },
  {
    id: '3',
    name: 'Maria G.',
    text: "The blog section is full of insightful articles. It's a great resource for anyone interested in personal development.",
    imageUrl: 'https://placehold.co/100x100.png',
    dataAiHint: 'thoughtful person',
    designation: 'Reader & User',
  },
];

export const allSpecialties: string[] = [
  'Career Coaching',
  'Personal Development',
  'Mindfulness Coaching',
  'Executive Coaching',
  'Leadership Coaching',
  'Business Strategy Coaching',
  'Wellness Coaching',
  'Relationship Coaching',
  'Stress Management Coaching',
  'Health and Fitness Coaching',
  'Spiritual Coaching',
  'Financial Coaching',
  'Parenting Coaching',
  'Academic Coaching',
  'Performance Coaching',
];
