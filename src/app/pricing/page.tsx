'use client';

import type { Metadata } from 'next';
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth'; 
import SubscribeButton from '@/components/SubscribeButton';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Crown, Users, Loader2, Minus, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const freeFeatures = [
  "Basic Profile (Name, Bio, Specialties, Keywords)",
  "List in Online Life Coach Directory",
  "Receive Messages from Users",
  "Submit Blog Posts (Admin Approval)",
];

const premiumFeatures = [
  "All Free Tier Features",
  "Profile Picture", 
  "Premium Badge on Profile & Cards",
  "Link to Personal Website",
  "Embed Intro Video URL",
  "Display Social Media Links",
  "Coach Resources (Coming Soon)",
];

const comparisonTableFeatures = [
  { name: "Basic Profile (Name, Bio, Specialties, Keywords)", free: true, premium: true },
  { name: "List in Online Life Coach Directory", free: true, premium: true },
  { name: "Receive Messages from Users", free: true, premium: true },
  { name: "Submit Blog Posts (Admin Approval)", free: true, premium: true },
  { name: "Profile Picture", free: false, premium: true },
  { name: "Premium Badge on Profile & Cards", free: false, premium: true },
  { name: "Link to Personal Website", free: false, premium: true },
  { name: "Embed Intro Video URL", free: false, premium: true },
  { name: "Display Social Media Links", free: false, premium: true },
  { name: "Coach Resources (Coming Soon)", free: false, premium: true },
];

const faqItems = [
  {
    id: "faq-1",
    question: "How do I upgrade from a Free account to Premium?",
    answer: "Upgrading is easy! Simply go to your Coach Dashboard and click the 'Upgrade to Premium' button. Once your upgrade is processed, all premium features, such as additional fields in the 'Edit Profile' tab, will be unlocked immediately.",
  },
  {
    id: "faq-2",
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.",
  },
  {
    id: "faq-3",
    question: "Is there a contract or can I cancel anytime?",
    answer: "Our plans are billed monthly. You can cancel your subscription at any time, and it will remain active until the end of your current monthly billing period. No long-term contracts are required.",
  },
  {
    id: "faq-4",
    question: "How does the 'Premium Badge' help me stand out?",
    answer: "The Premium Badge is a visual marker on your profile and coach card in search results, signaling to potential clients that you've invested in our top-tier plan, which often correlates with a higher level of commitment and a richer profile.",
  },
  {
    id: "faq-5",
    question: "What if I have more questions?",
    answer: "We're here to help! Please visit our [Contact Us](/contact-us) page, and our support team will be happy to assist you.", 
  },
];

interface ProductWithPrices extends DocumentData {
  id: string; 
  name?: string;
  description?: string;
  active?: boolean;
  role?: string; 
  prices?: Price[];
}

interface Price extends DocumentData {
  id: string; 
  unit_amount: number | null;
  currency: string;
  description?: string;
  type?: 'one_time' | 'recurring';
  interval?: string; 
  active?: boolean;
}

export function generateMetadata(): Metadata {
  return {
    title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
    description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
    metadataBase: new URL('https://thelifecoachingcafe.com'), // From layout.tsx
    openGraph: {
      title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
      description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
      url: 'https://thelifecoachingcafe.com/pricing', // Page specific URL
      type: 'website', // From layout.tsx
    },
    twitter: {
      card: 'summary_large_image', // From layout.tsx
      title: "Pricing Plans | The Life Coaching Cafe | Coach Subscriptions",
      description: "Explore subscription plans for life coaches at The Life Coaching Cafe. Choose the best plan to grow your practice and connect with clients.",
      images: ['/preview.jpg'], // From layout.tsx - consider a specific image for this page
    },
  };
}

export default function PricingPage() {
  const [paidProducts, setPaidProducts] = useState<ProductWithPrices[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user: authUser, loading: authLoading, error: authError } = useAuth();
  const userId = authUser ? authUser.uid : null; 

  useEffect(() => {
    if (authLoading) {
      return; 
    }

    const fetchPaidProductsAndPrices = async () => {
      setLoadingProducts(true);
      setError(null);
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('active', '==', true));

      try {
        const productSnapshots = await getDocs(q);
        const productsData: ProductWithPrices[] = [];

        for (const productDoc of productSnapshots.docs) {
          const productRole = productDoc.data().role || productDoc.data().metadata?.firebaseRole;
          if (productRole === 'free') {
            continue; 
          }

          const productDataForState: ProductWithPrices = { 
            id: productDoc.id, 
            ...productDoc.data(),
            role: productRole || 'premium'
          } as ProductWithPrices;
          
          const pricesRef = collection(db, `products/${productDoc.id}/prices`);
          const pricesQuery = query(pricesRef, where('active', '==', true), orderBy('unit_amount'));
          const priceSnapshots = await getDocs(pricesQuery);
          productDataForState.prices = priceSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Price));
          
          if (productDataForState.prices.length > 0) {
            productsData.push(productDataForState);
          }
        }
        
        productsData.sort((a, b) => {
          const aPriceVal = a.prices?.[0]?.unit_amount ?? Infinity;
          const bPriceVal = b.prices?.[0]?.unit_amount ?? Infinity;
          return aPriceVal - bPriceVal;
        });
        setPaidProducts(productsData);
      } catch (err: any) {
        console.error("[PricingPage fetch] Error during Firestore fetch:", err);
        setError("Failed to load premium plans. Please check connection or data.");
      }
      setLoadingProducts(false);
    };
    fetchPaidProductsAndPrices();
  }, [authLoading]); 

  if (authLoading || loadingProducts) {
    return (
      <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-gray-700 dark:text-gray-300">
          {authLoading ? 'Authenticating...' : 'Loading premium plans...'}
        </p>
      </div>
    );
  }

  if (error) { 
    return (
      <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col justify-center items-center text-center">
        <p className="text-xl text-red-500 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }
  
  if (authError) { 
     return (
      <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col justify-center items-center text-center">
        <p className="text-xl text-red-500 mb-4">Authentication Error: {authError.message}</p>
      </div>
    );
  }

  // Find the premium product and its price
  const premiumProduct = paidProducts.find(p => p.role === 'premium');
  const premiumPrice = premiumProduct?.prices?.[0];
  const premiumPriceAmount = typeof premiumPrice?.unit_amount === 'number' ? (premiumPrice.unit_amount / 100).toFixed(2) : 'N/A';

  const premiumDisplayDescription = "Ideal for established coaches aiming to maximize client reach and brand visibility.";

  return (
    <main className="space-y-12 py-8 md:py-12 container mx-auto px-4 sm:px-6 lg:px-8">
      <section className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Life Coach Subscription Plans</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Choose the best plan to grow your Life Coach practice and connect with clients seeking personal development.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Static Free Tier Card */}
        <Card className="flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Users className="mr-3 h-7 w-7 text-muted-foreground" />
              Free Tier
            </CardTitle>
            <CardDescription>Get started and build your presence. Perfect for new coaches or those exploring the platform.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-3xl font-bold">£0 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
            <ul className="space-y-2">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild size="lg" className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-100">
              <Link href="/register-coach">Get Started for Free</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Tier Card */}
        {premiumProduct && premiumPrice ? (
          <Card key={premiumProduct.id} className="flex flex-col shadow-lg shadow-xl border-2 border-custom-gold relative overflow-hidden bg-gradient-to-br from-light-gold-bg to-white">
            <div className="absolute top-0 right-0 bg-custom-gold text-black px-3 py-1 text-sm font-semibold rounded-bl-md">
              Most Popular
            </div>
            <CardHeader className="bg-custom-gold text-black p-6">
              <CardTitle className="text-2xl flex items-center text-black">
                <Crown className="mr-3 h-7 w-7 text-black" />
                {premiumProduct.name || 'Premium Plan'}
              </CardTitle>
                <CardDescription className="text-black/80">{premiumDisplayDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 p-6">
              <p className="text-3xl font-bold">
                £{premiumPriceAmount} <span className="text-sm font-normal text-muted-foreground">/ month</span>
              </p>
              <ul className="space-y-2">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-custom-gold mr-2 flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-6">
              {userId ? (
                <SubscribeButton
                  priceId={premiumPrice.id}
                  userId={userId}
                  buttonText={`Upgrade to ${premiumProduct.name || 'Premium'}`}
                />
              ) : (
                <Button asChild size="lg" className="w-full bg-custom-gold hover:bg-yellow-600 text-black">
                  <Link href={`/register-coach?planId=${premiumPrice.id}`}>Sign Up for {premiumProduct.name || 'Premium'}</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          !loadingProducts && paidProducts.length > 0 && !error && ( // Fallback if premium product/price isn't found despite products existing
            <Card className="flex flex-col shadow-lg items-center justify-center p-8 min-h-[300px]">
              <p className="text-lg text-muted-foreground text-center">Premium plan details are currently unavailable. Please check back later or contact support.</p>
            </Card>
          )
        )}
      </section>

      {/* Feature Comparison Table Section */}
      <section className="py-8 md:py-12 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Compare Features</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Feature
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Free
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-l-2 border-primary">
                  <span className="text-primary">Premium</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {comparisonTableFeatures.map((feature, index) => (
                <tr key={index} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{feature.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {feature.free ?
                      <Check className="h-6 w-6 text-green-500 mx-auto" /> :
                      <Minus className="h-6 w-6 text-gray-400 mx-auto" />}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-l-2 border-primary bg-primary/5">
                    {feature.premium ?
                      <CheckCircle2 className="h-6 w-6 text-primary mx-auto" /> :
                      <Minus className="h-6 w-6 text-gray-400 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-8 md:py-12 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item) => (
            <AccordionItem value={item.id} key={item.id}>
              <AccordionTrigger className="text-lg hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                {item.id === 'faq-5' ? (
                  <>
                    We&apos;re here to help! Please visit our <Link href="/contact-us" className="text-primary underline hover:text-primary/80">Contact Us</Link> page, and our support team will be happy to assist you.
                  </>
                ) : (
                  item.answer
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="text-center py-8 md:py-12 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Need Help Choosing Your Coaching Plan?</h3>
        <p className="text-muted-foreground mb-4">
          If you're unsure which plan is right for your life coaching services, start with the Free tier. You can always upgrade later from your coach dashboard to access premium features for coaching for mindset and confidence.
        </p>
        <Button variant="link" asChild>
          <Link href="/contact-us">Contact Support</Link>
        </Button>
      </section>
    </main>
  );
}
