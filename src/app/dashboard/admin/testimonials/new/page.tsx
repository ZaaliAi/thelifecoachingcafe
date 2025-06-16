"use client";

import TestimonialForm from '@/components/dashboard/TestimonialForm';
// import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"; // Assuming breadcrumbs exist - REMOVED
import Link from 'next/link'; // Link might still be used if there were other links, but not for breadcrumbs. Kept for now, can be removed if truly unused.

export default function NewTestimonialPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb removed */}
      {/* Optional: Could add a simple h1 title here if needed */}
      {/* e.g. <h1 className="text-2xl font-semibold">Add New Testimonial</h1> */}
      <TestimonialForm />
    </div>
  );
}
