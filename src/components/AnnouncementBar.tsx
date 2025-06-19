
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Megaphone } from 'lucide-react';

const AnnouncementBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('announcementDismissed_premiumOffer50');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('announcementDismissed_premiumOffer50', 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-primary text-primary-foreground p-3 text-center relative">
      <div className="container mx-auto flex items-center justify-center">
        <Megaphone className="h-5 w-5 mr-2" />
        <span className="font-medium">
          Check Out The New Premium Plan Features.
        </span>
        <Link href="/pricing" className="underline ml-2 hover:text-secondary transition-colors">
          Learn More
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-1/2 right-3 transform -translate-y-1/2 p-1.5 text-primary-foreground hover:bg-primary/80 rounded-md"
        aria-label="Dismiss announcement"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default AnnouncementBar;
