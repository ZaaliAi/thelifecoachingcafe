"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserX, Trash2, ShieldAlert, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";
import { getAllUserProfilesForAdmin } from '@/lib/firestore';
import { cn } from "@/lib/utils"; // Added cn import

// Interface for the user data expected by the admin page
interface AdminUserView {
  id: string;
  name: string | null;
  email: string | null;
  role: 'user' | 'coach' | 'admin';
  createdAt?: Date | string; 
  status?: string; 
}

// Placeholder function for deleting a user account - REPLACE WITH SECURE SERVER-SIDE LOGIC
async function deleteUserAccount(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`Attempting to delete user: ${userId}`);
  await new Promise(resolve => setTimeout(resolve, 1000)); 
  return { success: true };
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<AdminUserView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const fetchedUsers = await getAllUserProfilesForAdmin();
        setUsers(fetchedUsers as AdminUserView[]); 
      } catch (error) {
        console.error("Failed to fetch users:", error);
        toast({ title: "Error", description: "Could not fetch users. Make sure you are authorized.", variant: "destructive" });
      }
      setIsLoading(false);
    };
    fetchUsers();
  }, []);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.role === 'admin') {
        toast({
            title: "Action Not Allowed",
            description: "Admin accounts cannot be deleted through this interface.",
            variant: "destructive",
        });
        setUserToDelete(null);
        return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteUserAccount(userToDelete.id);
      if (result.success) {
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));
        toast({ title: "Success", description: `User ${userToDelete.name || userToDelete.email} deleted successfully.` });
      } else {
        throw new Error(result.message || 'Failed to delete user.');
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not delete user.", variant: "destructive" });
    }
    setIsDeleting(false);
    setUserToDelete(null); 
  };

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><UserX className="mr-2 h-6 w-6 text-primary" /> Manage Users</CardTitle>
          <CardDescription>View, search, and manage user accounts on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center">
            <Search className="mr-2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading ? (
             <div className="flex items-center justify-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
             </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShieldAlert className="mx-auto h-12 w-12 mb-4" />
              <p>No users found matching your criteria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'coach' ? 'secondary' : 'outline' } className="capitalize">{user.role}</Badge></TableCell>
                    <TableCell><Badge variant={user.status === 'active' ? 'default' : 'outline'} className={cn("capitalize", user.status === 'active' && "bg-green-500 text-white", user.status === 'pending_approval' && "bg-yellow-500 text-white", user.status === 'suspended' && "bg-red-500 text-white" )}>{user.status || 'N/A'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => setUserToDelete(user)} disabled={user.role === 'admin'}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the account for <strong>{userToDelete?.name || userToDelete?.email}</strong> and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteUser}
                              disabled={isDeleting}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
