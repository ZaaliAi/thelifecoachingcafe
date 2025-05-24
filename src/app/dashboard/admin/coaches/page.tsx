"use client";

import { useState, useEffect } from 'react';
// Button import removed as it's no longer used after removing the actions column and button
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Users, Loader2, Crown, ShieldQuestion, Hourglass, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import type { Coach, CoachStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { getAllCoaches, updateCoachSubscriptionTier, updateCoachStatus, updateCoachFeatureStatus } from '@/lib/firestore';

type AdminCoachView = Coach & { status: CoachStatus };

export default function AdminManageCoachesPage() {
  const [coachesList, setCoachesList] = useState<AdminCoachView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoaches = async () => {
    setIsLoading(true);
    try {
      const allCoachesFromDb = await getAllCoaches({ includeAllStatuses: true } as any);
      const applications: AdminCoachView[] = allCoachesFromDb.map(coach => ({
        ...coach,
        status: coach.status || 'pending_approval',
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

  const handleStatusChange = async (coachId: string, newStatus: CoachStatus) => {
    try {
      await updateCoachStatus(coachId, newStatus);
      setCoachesList(prev =>
        prev.map(app => app.id === coachId ? { ...app, status: newStatus } : app)
      );
      toast({
        title: `Coach Status Updated`,
        description: `Coach ${coachesList.find(c => c.id === coachId)?.name}'s status set to ${newStatus === 'pending_approval' ? 'Pending' : newStatus.replace('_', ' ')}. `,
      });
    } catch (error) {
      console.error("Failed to update coach status:", error);
      toast({ title: "Update Failed", description: "Could not update coach status.", variant: "destructive" });
    }
  };

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
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading coach applications...</div>;
  }

  const getStatusBadgeVariant = (status: CoachStatus) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending_approval': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: CoachStatus) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />;
      case 'pending_approval': return <Hourglass className="mr-1 h-4 w-4 text-yellow-500" />;
      case 'rejected': return <XCircle className="mr-1 h-4 w-4 text-red-500" />;
      default: return <ShieldQuestion className="mr-1 h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: CoachStatus) => {
    if (status === 'pending_approval') {
      return 'Pending';
    }
    return status.replace('_', ' ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7 text-primary" /> Manage Coaches
        </CardTitle>
        <CardDescription>Review applications, approve coaches, manage subscriptions, and feature on homepage.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>{/* Ensure no space/newline after this opening tag and before the first TableHead */}
                <TableHead>Avatar</TableHead>{/* Ensure no space/newline before the next TableHead */}
                <TableHead>Name</TableHead>{/* Ensure no space/newline */}
                <TableHead>Email</TableHead>{/* Ensure no space/newline */}
                <TableHead>App Status</TableHead>{/* Ensure no space/newline */}
                <TableHead>Subscription</TableHead>{/* Ensure no space/newline */}
                <TableHead className="text-center">Featured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coachesList.map((coach) => (
                <TableRow key={coach.id}>{/* Ensure no space after this opening tag and before the first TableCell */}
                  <TableCell>
                    {coach.profileImageUrl ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={coach.profileImageUrl} alt={coach.name} data-ai-hint={coach.dataAiHint as string || "person avatar"} />
                        <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                  </TableCell>{/* Ensure no space/newline before the next TableCell */}
                  <TableCell className="font-medium whitespace-nowrap">
                    <Link
                      href={`/coach/${coach.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary"
                    >
                      {coach.name}
                    </Link>
                  </TableCell>{/* Ensure no space/newline */}
                  <TableCell className="whitespace-nowrap">{coach.email || 'N/A'}</TableCell>{/* Ensure no space/newline */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(coach.status)} className="capitalize flex items-center whitespace-nowrap">
                        {getStatusIcon(coach.status)}
                        {getStatusText(coach.status)}
                      </Badge>
                      <Select
                        value={coach.status}
                        onValueChange={(value: CoachStatus) => handleStatusChange(coach.id, value)}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                          <SelectValue placeholder="Change Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending_approval">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>{/* Ensure no space/newline */}
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
                  </TableCell>{/* Ensure no space/newline */}
                  <TableCell className="text-center">
                    <Switch
                      checked={coach.isFeaturedOnHomepage}
                      onCheckedChange={(isChecked) => handleFeatureOnHomepageChange(coach.id, isChecked)}
                      aria-label={`Feature ${coach.name} on homepage`}
                      className="data-[state=checked]:bg-green-500"
                    />
                    {coach.isFeaturedOnHomepage && <Star className="inline-block ml-1 h-4 w-4 text-yellow-400" />}
                  </TableCell>
                  {/* The actions TableCell was here and is now completely removed */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {coachesList.length === 0 && <p className="text-center text-muted-foreground py-8">No coach applications found.</p>}
      </CardContent>
    </Card>
  );
}
