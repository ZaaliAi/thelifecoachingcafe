'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserX, ShieldAlert, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getAllUserProfilesForAdmin } from '@/lib/firestore';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';

// Firebase imports for calling Cloud Functions
import { getFunctions, httpsCallable, FunctionsError } from "firebase/functions";
import { firebaseApp as app } from "@/lib/firebase";

// Interface for the user data expected by the admin page
interface AdminUserView {
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  name?: string;
  role?: string;
}

// Helper function to format data for CSV
const escapeCsvValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // Ensure special characters in strings are properly escaped for the includes method
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('
') || stringValue.includes('')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Function to generate and download the CSV
const handleDownloadCSV = (users: AdminUserView[]) => {
  const headers = ['ID', 'Email', 'Status', 'Created At', 'Name', 'Role'];
  const headerRow = headers.map(escapeCsvValue).join(',');
  const dataRows = users.map(user => {
    const rowData = [
      user.id,
      user.email,
      user.status,
      format(new Date(user.createdAt), 'yyyy-MM-dd'),
      user.name || '',
      user.role || '',
    ];
    return rowData.map(escapeCsvValue).join(',');
  });
  // Ensure newline characters in the join method are properly escaped
  const csvContent = [headerRow, ...dataRows].join('
');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'users.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const usersData = await getAllUserProfilesForAdmin();
        setUsers(usersData.map(u => ({...u, createdAt: u.createdAt || new Date().toISOString() })) as AdminUserView[]);
      } catch (err) {
        console.error("Error fetching users:", err);
        const errorMessage = (err instanceof Error) ? err.message : "Failed to fetch users. Please try again.";
        setFetchError(errorMessage);
        toast({
          title: "Error Fetching Users",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

 const handleUnsuspend = async (userId: string) => {
    setProcessingUserId(userId);
    setIsProcessing(true);
    try {
      const functions = getFunctions(app);
      const unsuspendUserFunction = httpsCallable(functions, 'unsuspendUser');

      console.log(`Calling 'unsuspendUser' Firebase function for userId: ${userId}`);
      await unsuspendUserFunction({ userId: userId });

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, status: 'active' } : user
        )
      );
      toast({
        title: "Success",
        description: "User unsuspended successfully.",
        variant: "default",
      });

    } catch (error: unknown) {
      console.error("Error unsuspending user via Firebase function:", error);
      let errorMessage = "Failed to unsuspend user. Please try again.";

      if (error instanceof FunctionsError) {
        switch (error.code) {
          case 'unauthenticated':
            errorMessage = "Authentication error. Please ensure you are logged in as an admin.";
            break;
          case 'permission-denied':
            errorMessage = "Permission denied. You may not have the necessary admin rights.";
            break;
          case 'invalid-argument':
            errorMessage = "Invalid data sent to the server. Please contact support.";
            break;
          case 'not-found':
            errorMessage = "User not found or operation not applicable.";
            break;
          default:
            errorMessage = error.message || `An unexpected Firebase error occurred (Code: ${error.code}).`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = "An unknown and unstringifiable error occurred.";
        }
      }

      toast({
        title: "Error Unsuspending User",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingUserId(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    setProcessingUserId(userId);
    setIsProcessing(true);
    try {
      const functions = getFunctions(app);
      const suspendUserFunction = httpsCallable(functions, 'suspendUser');

      console.log(`Calling 'suspendUser' Firebase function for userId: ${userId}`);
      await suspendUserFunction({ userId: userId });

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, status: 'suspended' } : user
        )
      );
      toast({
        title: "Success",
        description: "User suspended successfully.",
        variant: "default",
      });

    } catch (error: unknown) {
      console.error("Error suspending user via Firebase function:", error);
      let errorMessage = "Failed to suspend user. Please try again.";

      if (error instanceof FunctionsError) {
        switch (error.code) {
          case 'unauthenticated':
            errorMessage = "Authentication error. Please ensure you are logged in as an admin.";
            break;
          case 'permission-denied':
            errorMessage = "Permission denied. You may not have the necessary admin rights.";
            break;
          case 'invalid-argument':
            errorMessage = "Invalid data sent to the server. Please contact support.";
            break;
          case 'not-found':
            errorMessage = "User not found or operation not applicable.";
            break;
          default:
            errorMessage = error.message || `An unexpected Firebase error occurred (Code: ${error.code}).`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = "An unknown and unstringifiable error occurred.";
        }
      }

      toast({
        title: "Error Suspending User",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingUserId(null);
    }
  };

  const handleDelete = async (userId: string) => {
      console.log("Attempting to delete user:", userId);
      toast({ title: "Notice", description: "Delete functionality not yet fully implemented." });
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading users...</p>
      </div>
    );
  }

  if (fetchError && users.length === 0) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-3xl font-bold mb-6">Manage Users</h1>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{fetchError}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Manage Users</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm flex-grow"
          />
          <Search className="h-5 w-5 text-gray-500" />
        </div>
        <div className="flex space-x-2">
           <Button onClick={() => handleDownloadCSV(users)} disabled={users.length === 0}>Download CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>
            {users.length > 0 ? `Manage ${users.length} registered users and their statuses.` : "No users to display yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          user.status === 'active' && 'bg-green-100 text-green-800 hover:bg-green-200',
                          user.status === 'suspended' && 'bg-red-100 text-red-800 hover:bg-red-200',
                          user.status === 'pending' && 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        )}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.role || 'N/A'}</TableCell>
                    <TableCell>{user.createdAt ? format(new Date(user.createdAt), 'PPpp') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      {user.status === 'suspended' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isProcessing && processingUserId === user.id}>
                              {isProcessing && processingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="mr-2 h-4 w-4 text-green-600" />}
                              Unsuspend
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will unsuspend the user&apos;s account, allowing them to log in again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleUnsuspend(user.id)} className="bg-green-600 hover:bg-green-700">Unsuspend</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {user.status !== 'suspended' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isProcessing && processingUserId === user.id}>
                              {isProcessing && processingUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <ShieldAlert className="mr-2 h-4 w-4 text-red-600" />
                              )}
                              Suspend
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent> 
                            <AlertDialogHeader> 
                              <AlertDialogTitle>Are you sure you want to suspend this user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will suspend the user&apos;s account, preventing them from logging in.
                              </AlertDialogDescription>
                            </AlertDialogHeader> 
                            <AlertDialogFooter> 
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleSuspend(user.id)} className="bg-red-600 hover:bg-red-700">Suspend</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">{searchTerm ? "No users match your search criteria." : "No users found."}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersPage;
