
"use client"; // For client-side actions like approve/reject

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Users, Loader2, Eye } from "lucide-react";
import { mockCoaches } from '@/data/mock'; // Using mock data for now
import type { Coach } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

// Simulate coach application status
type CoachApplication = Coach & { status: 'pending' | 'approved' | 'rejected' };

export default function AdminManageCoachesPage() {
  const [coachApplications, setCoachApplications] = useState<CoachApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching coach applications
    const applications: CoachApplication[] = mockCoaches.map((coach, index) => ({
      ...coach,
      status: index % 3 === 0 ? 'pending' : (index % 3 === 1 ? 'approved' : 'rejected'),
    }));
    setCoachApplications(applications);
    setIsLoading(false);
  }, []);

  const handleApproval = (coachId: string, newStatus: 'approved' | 'rejected') => {
    // Simulate API call
    setCoachApplications(prev => 
      prev.map(app => app.id === coachId ? { ...app, status: newStatus } : app)
    );
    toast({
      title: `Coach ${newStatus}`,
      description: `Coach application for ${coachApplications.find(c=>c.id===coachId)?.name} has been ${newStatus}.`,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading coach applications...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7 text-primary" /> Manage Coach Registrations
        </CardTitle>
        <CardDescription>Review, approve, or reject new coach applications.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Specialties</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coachApplications.map((coach) => (
              <TableRow key={coach.id}>
                <TableCell>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={coach.profileImageUrl} alt={coach.name} data-ai-hint={coach.dataAiHint as string || "person avatar"} />
                    <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{coach.name}</TableCell>
                <TableCell>{coach.email || `${coach.name.toLowerCase().replace(' ', '.')}@example.com`}</TableCell>
                <TableCell>{coach.specialties.slice(0, 2).join(', ')}{coach.specialties.length > 2 ? '...' : ''}</TableCell>
                <TableCell>
                  <Badge variant={coach.status === 'approved' ? 'default' : coach.status === 'pending' ? 'secondary' : 'destructive'}>
                    {coach.status.charAt(0).toUpperCase() + coach.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {coach.status === 'pending' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleApproval(coach.id, 'approved')}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleApproval(coach.id, 'rejected')}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                   {coach.status === 'approved' && (
                     <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleApproval(coach.id, 'rejected')}>
                        <XCircle className="mr-1 h-4 w-4" /> Revoke
                      </Button>
                   )}
                   {coach.status === 'rejected' && (
                     <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleApproval(coach.id, 'approved')}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Re-approve
                      </Button>
                   )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/coach/${coach.id}`} target="_blank" rel="noopener noreferrer">
                      <Eye className="mr-1 h-4 w-4" /> View Details
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {coachApplications.length === 0 && <p className="text-center text-muted-foreground py-8">No coach applications found.</p>}
      </CardContent>
    </Card>
  );
}
