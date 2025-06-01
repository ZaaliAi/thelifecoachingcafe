// src/app/pricing/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, orderBy, DocumentData } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/lib/auth'; 
import SubscribeButton from '@/components/SubscribeButton';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, Crown, Users, Loader2 } from "lucide-react";
import Link from "next/link";

const freeFeatures = [
  "Basic Profile (Name, Bio, Specialties, Keywords)",
  "List in Online Life Coach Directory",
  "Receive Messages from Users",
  "Submit Blog Posts (Admin Approval)",
];

const premiumFeatures = [
  "All Free Tier Features",
  "Profile Picture", // Changed and moved to 2nd position
  "Premium Badge on Profile & Cards",
  "Link to Personal Website",
  "Embed Intro Video URL",
  "Display Social Media Links",
  "Priority Support (Coming Soon)",
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
      const db = getFirestore(firebaseApp);
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

  return (
    <div className="space-y-12 py-8 md:py-12">
      <section className="text-center">
        <Crown className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Life Coach Subscription Plans</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Choose the best plan to grow your Life Coach practice and connect with clients seeking personal development.
        </p>
      </section>

      <section className={`grid md:grid-cols-${paidProducts.length > 0 ? '2' : '1'} gap-8 max-w-4xl mx-auto`}>
        {/* Static Free Tier Card */}
        <Card className="flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Users className="mr-3 h-7 w-7 text-muted-foreground" />
              Free Tier
            </CardTitle>
            <CardDescription>Get started and build your presence on Life Coaching Cafe directory.</CardDescription>
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
            {/* Free Tier Button styled as specific light grey */}
            <Button asChild size="lg" className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-100">
              <Link href="/register-coach">Get Started for Free</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Display message if no paid products are loaded and not loading and no error */}
        {!loadingProducts && paidProducts.length === 0 && !error && (
             <Card className="flex flex-col shadow-lg items-center justify-center p-8 min-h-[300px]">
                <p className="text-lg text-muted-foreground text-center">Premium plans are currently unavailable. Please check back later or contact support.</p>
            </Card>
        )}

        {/* Dynamic Paid Product Cards */}
        {paidProducts.map((product) => {
          const price = product.prices?.[0]; 
          const isMostPopular = product.role === 'premium';

          if (!price) {
            return null; 
          }
          if (product.role === 'free') return null; 

          const features = product.role === 'premium' ? premiumFeatures : ['A single basic feature', 'Another basic feature'];

          return (
            <Card key={product.id} className={`flex flex-col shadow-lg ${isMostPopular ? 'shadow-xl border-2 border-primary relative overflow-hidden' : ''}`}>
              {isMostPopular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm font-semibold rounded-bl-md">
                    Most Popular
                </div>
              )}
              <CardHeader className={`${isMostPopular ? 'bg-yellow-500 text-white p-6' : 'p-6'}`}>
                <CardTitle className={`text-2xl flex items-center ${isMostPopular ? 'text-white' : ''}`}>
                  <Crown className={`mr-3 h-7 w-7 ${isMostPopular ? 'text-white' : 'text-yellow-500'}`} /> 
                  {product.name || 'Premium Plan'}
                </CardTitle>
                <CardDescription className={`${isMostPopular ? 'text-gray-100' : ''}`}>{product.description || 'Unlock all features.'}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                {(typeof price.unit_amount === 'number') ? (
                  <p className="text-3xl font-bold">
                    £{(price.unit_amount / 100).toFixed(2)} 
                    <span className="text-sm font-normal text-muted-foreground">/ {price.interval || 'one-time'}</span>
                  </p>
                ) : (
                  <p className="text-3xl font-bold">Price not available</p> 
                )}
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {userId ? (
                  <SubscribeButton 
                    priceId={price.id}
                    userId={userId} 
                    buttonText={`Upgrade to ${product.name || 'Premium'}`}
                    // Removed className to use internal default blue from SubscribeButton component
                  />
                ) : (
                  // For logged-out users, direct to coach registration for premium plans, including planId query param
                  <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href={`/register-coach?planId=${price.id}`}>Sign Up for {product.name || 'Premium'}</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })} 
      </section>

      <section className="text-center py-8 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Need Help Choosing Your Coaching Plan?</h3>
        <p className="text-muted-foreground mb-4">
          If you're unsure which plan is right for your life coaching services, start with the Free tier. You can always upgrade later from your coach dashboard to access premium features for coaching for mindset and confidence.
        </p>
        <Button variant="link" asChild>
            <Link href="/contact-us">Contact Support</Link>
        </Button>
      </section>
    </div>
  );
}
