"use client";

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Loader2, Crown, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import type { Coach } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { getAllCoaches, updateCoachSubscriptionTier, updateCoachFeatureStatus } from '@/lib/firestore';

// The AdminCoachView type no longer needs a separate 'status' field from the Coach type, as it's part of the Coach type itself.
type AdminCoachView = Coach & { isFeaturedOnHomepage?: boolean };

export default function AdminManageCoachesPage() {
  const [coachesList, setCoachesList] = useState<AdminCoachView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoaches = async () => {
    setIsLoading(true);
    try {
      // We no longer need to pass includeAllStatuses, as we now want all coaches regardless of status.
      const allCoachesFromDb = await getAllCoaches(); 
      const applications: AdminCoachView[] = allCoachesFromDb.map(coach => ({
        ...coach,
        isFeaturedOnHomepage: coach.isFeaturedOnHomepage || false,
      }));
      setCoachesList(applications);
    } catch (error) {
      console.error("Failed to fetch coaches for admin:", error);
      toast({ title: "Error", description: "Could not fetch coach data.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  // handleStatusChange is no longer needed since the approval flow is removed.

  const handleSubscriptionTierChange = async (coachId: string, newTier: 'free' | 'premium') => {
    try {
      await updateCoachSubscriptionTier(coachId, newTier);
      setCoachesList(prev =>
        prev.map(app => app.id === coachId ? { ...app, subscriptionTier: newTier } : app)
      );
      toast({
        title: "Subscription Tier Updated",
        description: `Coach ${coachesList.find(c => c.id === coachId)?.name}'s subscription tier set to ${newTier}.`,
      });
    } catch (error) {
      console.error("Failed to update subscription tier:", error);
      toast({ title: "Update Failed", description: "Could not update subscription tier.", variant: "destructive" });
    }
  };

  const handleFeatureOnHomepageChange = async (coachId: string, isFeatured: boolean) => {
    try {
      await updateCoachFeatureStatus(coachId, isFeatured);
      setCoachesList(prev =>
        prev.map(coach => coach.id === coachId ? { ...coach, isFeaturedOnHomepage: isFeatured } : coach)
      );
      toast({
        title: `Homepage Feature Status Updated`,
        description: `Coach ${coachesList.find(c => c.id === coachId)?.name} will ${isFeatured ? 'now' : 'no longer'} be featured on the homepage.`,
      });
    } catch (error) {
      console.error("Failed to update homepage feature status:", error);
      toast({ title: "Update Failed", description: "Could not update homepage feature status.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading coaches...</div>;
  }

  // The helper functions for status (getStatusBadgeVariant, getStatusIcon, getStatusText) are removed.

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7 text-primary" /> Manage Coaches
        </CardTitle>
        <CardDescription>Manage coach subscriptions and feature them on the homepage.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-center">Featured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coachesList.map((coach) => (
                <TableRow key={coach.id}>
                  <TableCell>
                    {coach.profileImageUrl ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={coach.profileImageUrl} alt={coach.name} />
                        <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    <Link
                      href={`/coach/${coach.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary"
                    >
                      {coach.name}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{coach.email || 'N/A'}</TableCell>
                  {/* The TableCell for App Status has been removed */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={coach.subscriptionTier === 'premium' ? 'default' : 'secondary'} className={`whitespace-nowrap ${coach.subscriptionTier === 'premium' ? 'bg-yellow-500 text-white hover:bg-yellow-600' : ''}`}>
                        {coach.subscriptionTier === 'premium' && <Crown className="mr-1 h-3 w-3" />}
                        {coach.subscriptionTier.charAt(0).toUpperCase() + coach.subscriptionTier.slice(1)}
                      </Badge>
                      <Select
                        value={coach.subscriptionTier}
                        onValueChange={(value: 'free' | 'premium') => handleSubscriptionTierChange(coach.id, value)}
                      >
                        <SelectTrigger className="h-8 w-[100px] text-xs">
                          <SelectValue placeholder="Change Tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={coach.isFeaturedOnHomepage}
                      onCheckedChange={(isChecked) => handleFeatureOnHomepageChange(coach.id, isChecked)}
                      aria-label={`Feature ${coach.name} on homepage`}
                      className="data-[state=checked]:bg-green-500"
                    />
                    {coach.isFeaturedOnHomepage && <Star className="inline-block ml-1 h-4 w-4 text-yellow-400" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {coachesList.length === 0 && <p className="text-center text-muted-foreground py-8">No coaches found.</p>}
      </CardContent>
    </Card>
  );
}
