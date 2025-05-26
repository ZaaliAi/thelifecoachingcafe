"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserX, Trash2, ShieldAlert, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getAllUserProfilesForAdmin, unsuspendUserAccount } from '@/lib/firestore';
import { cn } from "@/lib/utils";
import { format } from 'date-fns'; // Import format from date-fns

// Interface for the user data expected by the admin page
interface AdminUserView {
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'pending'; // Assuming these are the possible statuses
  createdAt: string; // Assuming createdAt is a string, adjust if it's a Date or Timestamp
  // Add other relevant user fields you want to include in the CSV
  name?: string; // Example: If you have a name field
}

// Helper function to format data for CSV, handling commas and quotes
const escapeCsvValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // If the value contains a comma, double quote, or newline, enclose it in double quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape double quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Function to generate and download the CSV
const handleDownloadCSV = (users: AdminUserView[]) => {
  const headers = ['ID', 'Email', 'Status', 'Created At', 'Name']; // Define your headers

  // Create the header row
  const headerRow = headers.map(escapeCsvValue).join(',');

  // Create data rows
  const dataRows = users.map(user => {
    const rowData = [
      user.id,
      user.email,
      user.status,
      // Format the createdAt date for the CSV
      format(new Date(user.createdAt), 'yyyy-MM-dd'),
      user.name || '', // Include other fields, use '' for null/undefined
      // Add other user fields here corresponding to the headers
    ];
    return rowData.map(escapeCsvValue).join(',');
  });

  // Combine header and data rows
  const csvContent = [headerRow, ...dataRows].join('\n');

  // Create a Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

  // Create a download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'users.csv'); // Set the desired filename
  link.style.visibility = 'hidden'; // Hide the link
  document.body.appendChild(link); // Append to body

  link.click(); // Trigger download

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuspending, setIsSuspending] = useState(false); // State to track if a suspension is in progress

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await getAllUserProfilesForAdmin();
        // Assuming usersData from firestore matches AdminUserView interface or needs mapping
        setUsers(usersData as AdminUserView[]);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to fetch users. Please try again.");
        toast({
          title: "Error",
          description: "Failed to fetch users.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleUnsuspend = async (userId: string) => {
    setIsSuspending(true); // Indicate suspension is in progress
    try {
      await unsuspendUserAccount(userId);
      // Update the user's status in the local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, status: 'active' } : user
        )
      );
      toast({
        title: "Success",
        description: "User unsuspended successfully.",
      });
    } catch (err) {
      console.error("Error unsuspending user:", err);
      toast({
        title: "Error",
        description: "Failed to unsuspend user.",
        variant: "destructive",
      });
    } finally {
      setIsSuspending(false); // Reset suspension state
    }
  };

  // You would implement handleSuspend and handleDelete similarly,
  // likely using AlertDialogs for confirmation and calling Firestore functions.
  // Example placeholders:
  // const handleSuspend = async (userId: string) => { ... };
  // const handleDelete = async (userId: string) => { ... };


  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) // Assuming you have a name field
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Manage Users</h1>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Search className="h-5 w-5 text-gray-500" />
        </div>
        {/* Assuming you have an Add User button */}
        <div className="flex space-x-2">
           <Button onClick={() => handleDownloadCSV(users)}>Download CSV</Button>
           {/* <Button>Add User</Button> */}
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>Manage registered users and their statuses.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          user.status === 'active' && 'bg-green-500',
                          user.status === 'suspended' && 'bg-red-500',
                          user.status === 'pending' && 'bg-yellow-500'
                        )}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    {/* Formatted Created At Date */}
                    <TableCell>{format(new Date(user.createdAt), 'yyyy-MM-dd')}</TableCell>
                    <TableCell className="text-right">
                      {/* Unsuspend Button */}
                      {user.status === 'suspended' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isSuspending}>
                              {isSuspending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="mr-2 h-4 w-4" />} Unsuspend
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
                              <AlertDialogAction onClick={() => handleUnsuspend(user.id)}>Unsuspend</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {/* Suspend Button (Example - Uncomment and implement if needed) */}
                      {user.status !== 'suspended' && (
                        // You'll need a similar AlertDialog and a handleSuspend function
                         <Button variant="ghost" size="sm">
                            <ShieldAlert className="mr-2 h-4 w-4" /> Suspend
                          </Button>
                      )}

                       {/* Delete Button (Example - Uncomment and implement if needed) */}
                       {/* You'll need a similar AlertDialog and a handleDelete function */}
                       <Button variant="ghost" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-500">No users found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersPage;
