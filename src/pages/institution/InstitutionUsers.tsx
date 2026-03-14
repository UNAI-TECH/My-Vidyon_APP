import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Loader2, Plus, Search, FileSpreadsheet, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BulkUploadService } from '@/services/BulkUploadService';
import { useAuth } from '@/context/AuthContext';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/common/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddStudentDialog, AddStaffDialog, AddParentDialog, AddDriverDialog } from './components/UserDialogs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DialogType = 'student' | 'staff' | 'parent' | 'accountant' | 'canteen' | 'driver' | null;

import { useSearch } from '@/context/SearchContext';

// ...

export function InstitutionUsers() {
    const { user } = useAuth();
    const { searchQuery } = useSearch(); // detailed search context
    // Alias searchQuery to searchTerm to match existing filtering logic variable name
    const searchTerm = searchQuery;

    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [dialogType, setDialogType] = useState<DialogType>(null);
    // const [searchTerm, setSearchTerm] = useState(''); // REPLACED BY GLOBAL SEARCH

    // Bulk Upload State
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [bulkFileType, setBulkFileType] = useState<'student' | 'staff' | 'parent' | 'driver'>('student');
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [isBulkUploading, setIsBulkUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    // --- QUERIES ---

    const { data: institutionStudents = [], isLoading: isStudentsLoading } = useQuery({
        queryKey: ['institution-students', user?.institutionId],
        queryFn: async () => {
            const instId = user?.institutionId;
            if (!instId) {
                console.warn('[STUDENTS] No institution identifier in user object:', user);
                return [];
            }

            console.log('[STUDENTS] Fetching for institution ID:', instId);

            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('institution_id', instId)
                .order('name');

            if (error) {
                console.error('[STUDENTS] Fetch error:', error);
                throw error;
            }

            console.log('[STUDENTS] Successfully fetched. Count:', data?.length);
            return data || [];
        },
        enabled: !!user?.institutionId,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true
    });

    const { data: institutionStaff = [], isLoading: isStaffLoading } = useQuery({
        queryKey: ['institution-staff', user?.institutionId],
        queryFn: async () => {
            const instId = user?.institutionId;
            if (!instId) return [];
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('institution_id', instId)
                .order('full_name');

            if (error) throw error;
            const targetRoles = ['faculty', 'admin', 'teacher', 'accountant', 'canteen_manager', 'driver'];
            return (data || []).filter((p: any) => targetRoles.includes(p.role));
        },
        enabled: !!user?.institutionId,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true
    });

    const { data: institutionParents = [], isLoading: isParentsLoading } = useQuery({
        queryKey: ['institution-parents', user?.institutionId],
        queryFn: async () => {
            const instId = user?.institutionId;
            if (!instId) return [];
            const { data, error } = await supabase
                .from('parents')
                .select('*')
                .eq('institution_id', instId)
                .order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.institutionId,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true
    });

    // --- REALTIME SUBSCRIPTION ---
    const { subscribeToTable } = useWebSocketContext();

    useEffect(() => {
        const instId = user?.institutionId;
        if (!instId) return;

        // Subscribe to Students
        const unsubStudents = subscribeToTable('students', () => {
            queryClient.invalidateQueries({ queryKey: ['institution-students'] });
        });

        // Subscribe to Staff (profiles)
        const unsubProfiles = subscribeToTable('profiles', () => {
            queryClient.invalidateQueries({ queryKey: ['institution-staff'] });
        });

        // Subscribe to Parents
        const unsubParents = subscribeToTable('parents', () => {
            queryClient.invalidateQueries({ queryKey: ['institution-parents'] });
        });

        return () => {
            unsubStudents();
            unsubProfiles();
            unsubParents();
        };
    }, [user?.institutionId, queryClient, subscribeToTable]);


    // --- HANDLERS ---

    const handleToggleUserStatus = async (id: string, type: 'student' | 'staff' | 'parent', currentStatus: boolean) => {
        const action = currentStatus ? 'disable' : 'enable';
        const confirmMessage = currentStatus
            ? 'Are you sure you want to disable this user? They will no longer be able to log in, but their data will be preserved.'
            : 'Are you sure you want to enable this user? They will be able to log in again.';

        if (!confirm(confirmMessage)) return;

        const loadingToast = toast.loading(`${action === 'disable' ? 'Disabling' : 'Enabling'} ${type}...`);

        try {
            // Call the appropriate database function
            const functionName = action === 'disable' ? 'disable_user_access' : 'enable_user_access';
            const { data, error } = await supabase.rpc(functionName, {
                user_id: id,
                user_type: type
            });

            if (error) {
                throw new Error(error.message);
            }

            // Check if the function returned an error
            if (data && !data.success) {
                throw new Error(data.error || `Failed to ${action} user`);
            }

            toast.dismiss(loadingToast);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} ${action}d successfully.`);

            // Invalidate queries to refresh the UI
            if (type === 'student') queryClient.invalidateQueries({ queryKey: ['institution-students'] });
            if (type === 'staff') queryClient.invalidateQueries({ queryKey: ['institution-staff'] });
            if (type === 'parent') queryClient.invalidateQueries({ queryKey: ['institution-parents'] });

        } catch (err: any) {
            console.error(`${action} error:`, err);
            toast.dismiss(loadingToast);
            toast.error(`Failed to ${action} user: ` + err.message);
        }
    };

    // Keep the old function for backward compatibility (can be removed later)
    const handleDeleteUser = async (id: string, type: 'student' | 'staff' | 'parent') => {
        await handleToggleUserStatus(id, type, true); // Always disable
    };

    const handleBulkUpload = async () => {
        if (!user?.institutionId || !bulkFile) {
            toast.error("Please select a file.");
            return;
        }

        setIsBulkUploading(true);
        setUploadProgress({ current: 0, total: 0 });

        try {
            const parsedData = await BulkUploadService.parseExcel(bulkFile);

            const dataWithRoles = parsedData.map((row: any) => ({
                ...row,
                role: bulkFileType === 'staff' ? (row.role || 'faculty') : bulkFileType
            }));

            const results = await BulkUploadService.bulkCreateUsers(
                dataWithRoles,
                user.institutionId,
                (current, total) => setUploadProgress({ current, total })
            );

            const successes = results.filter(r => r.status === 'success');
            const errors = results.filter(r => r.status === 'error');

            if (errors.length > 0) {
                toast.error(`Completed with errors. Success: ${successes.length}, Failed: ${errors.length}. Downloading report...`);
                BulkUploadService.downloadResults(results, `upload-report-${Date.now()}.xlsx`);
            } else {
                toast.success(`Successfully imported ${successes.length} users!`);
                setShowBulkUpload(false);
                setBulkFile(null);
                // Invalidate all related queries
                queryClient.invalidateQueries({ queryKey: ['institution-students'] });
                queryClient.invalidateQueries({ queryKey: ['institution-staff'] });
                queryClient.invalidateQueries({ queryKey: ['institution-parents'] });
            }

        } catch (error: any) {
            toast.error("Bulk upload failed: " + error.message);
        } finally {
            setIsBulkUploading(false);
        }
    };

    const handleDownloadTemplate = () => {
        BulkUploadService.generateTemplate(bulkFileType as any);
    };

    const filteredStudents = useMemo(() => institutionStudents.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.register_number.toLowerCase().includes(searchTerm.toLowerCase())
    ), [institutionStudents, searchTerm]);

    const filteredStaff = useMemo(() => institutionStaff.filter((s: any) =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [institutionStaff, searchTerm]);

    const filteredParents = useMemo(() => institutionParents.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [institutionParents, searchTerm]);

    const filteredAccountants = useMemo(() => institutionStaff.filter((s: any) =>
        s.role === 'accountant' && (
            s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    ), [institutionStaff, searchTerm]);

    const filteredCanteenManagers = useMemo(() => institutionStaff.filter((s: any) =>
        s.role === 'canteen_manager' && (
            s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    ), [institutionStaff, searchTerm]);

    const filteredDrivers = useMemo(() => institutionStaff.filter((s: any) =>
        s.role === 'driver' && (
            s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    ), [institutionStaff, searchTerm]);

    return (
        <InstitutionLayout>
            <PageHeader
                title="User Management"
                subtitle="Manage students, faculty, and parents for your institution"
                actions={
                    <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Bulk Import Users
                    </Button>
                }
            />

            <div className="flex flex-col space-y-6">

                {/* Search & Actions Bar - Search moved to Global Header */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-end bg-card p-4 rounded-lg border">
                    {/* Local search removed in favor of global search */}
                </div>

                <Tabs defaultValue="students" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:max-w-3xl mb-4">
                        <TabsTrigger value="students">Students</TabsTrigger>
                        <TabsTrigger value="staff">Staff</TabsTrigger>
                        <TabsTrigger value="parents">Parents</TabsTrigger>
                        <TabsTrigger value="accountants">Accountants</TabsTrigger>
                        <TabsTrigger value="canteen">Canteen</TabsTrigger>
                        <TabsTrigger value="driver">Drivers</TabsTrigger>
                    </TabsList>

                    {/* STUDENTS TAB */}
                    <TabsContent value="students" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Active Students ({filteredStudents.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('student')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Student
                            </Button>
                        </div>

                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Register No</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Class</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Parent</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isStudentsLoading ? (
                                            <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredStudents.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No students found.</td></tr>
                                        ) : (
                                            filteredStudents.map((student: any) => (
                                                <tr key={student.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{student.name}
                                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                                    </td>
                                                    <td className="p-4">{student.register_number}</td>
                                                    <td className="p-4"><Badge variant="outline">{student.class_name || 'N/A'} - {student.section || 'A'}</Badge></td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span>{student.parent_name || 'N/A'}</span>
                                                            <span className="text-xs text-muted-foreground">{student.parent_contact || student.parent_phone}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge className={student.is_active !== false ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-0" : "bg-red-100 text-red-700 hover:bg-red-100/80 border-0"}>
                                                            {student.is_active !== false ? 'Active' : 'Disabled'}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => navigate(`/institution/student/${student.id}`)}>
                                                                View Details
                                                            </Button>
                                                            <Button
                                                                variant={student.is_active !== false ? "ghost" : "default"}
                                                                size="sm"
                                                                className={student.is_active !== false
                                                                    ? "text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                                    : "bg-green-600 hover:bg-green-700 text-white"
                                                                }
                                                                onClick={() => handleToggleUserStatus(student.id, 'student', student.is_active !== false)}
                                                            >
                                                                {student.is_active !== false ? 'Disable' : 'Enable'}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* STAFF TAB */}
                    <TabsContent value="staff" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Active Faculty & Staff ({filteredStaff.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('staff')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Staff
                            </Button>
                        </div>

                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">DOB</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Role</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isStaffLoading ? (
                                            <tr><td colSpan={7} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredStaff.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No staff found.</td></tr>
                                        ) : (
                                            filteredStaff.map((staff: any) => (
                                                <tr key={staff.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{staff.full_name}</td>
                                                    <td className="p-4">{staff.email}</td>
                                                    <td className="p-4">{staff.phone || 'N/A'}</td>
                                                    <td className="p-4">{staff.date_of_birth ? new Date(staff.date_of_birth).toLocaleDateString() : 'N/A'}</td>
                                                    <td className="p-4"><Badge variant="outline" className="capitalize">{staff.role}</Badge></td>
                                                    <td className="p-4">
                                                        <Badge className={staff.is_active !== false ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-0" : "bg-red-100 text-red-700 hover:bg-red-100/80 border-0"}>
                                                            {staff.is_active !== false ? 'Active' : 'Disabled'}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <Button
                                                            variant={staff.is_active !== false ? "ghost" : "default"}
                                                            size="sm"
                                                            className={staff.is_active !== false
                                                                ? "text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                            }
                                                            onClick={() => handleToggleUserStatus(staff.id, 'staff', staff.is_active !== false)}
                                                        >
                                                            {staff.is_active !== false ? 'Disable' : 'Enable'}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* PARENTS TAB */}
                    <TabsContent value="parents" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Registered Parents ({filteredParents.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('parent')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Parent
                            </Button>
                        </div>
                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isParentsLoading ? (
                                            <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredParents.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No parents found.</td></tr>
                                        ) : (
                                            filteredParents.map((parent: any) => (
                                                <tr key={parent.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{parent.name}</td>
                                                    <td className="p-4">{parent.email}</td>
                                                    <td className="p-4">{parent.phone}</td>
                                                    <td className="p-4"><Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-0">Active</Badge></td>
                                                    <td className="p-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                            onClick={() => handleDeleteUser(parent.id, 'parent')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ACCOUNTANTS TAB */}
                    <TabsContent value="accountants" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Registered Accountants ({filteredAccountants.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('accountant')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Accountant
                            </Button>
                        </div>
                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isStaffLoading ? (
                                            <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredAccountants.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No accountants found.</td></tr>
                                        ) : (
                                            filteredAccountants.map((acc: any) => (
                                                <tr key={acc.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{acc.full_name}</td>
                                                    <td className="p-4">{acc.email}</td>
                                                    <td className="p-4">{acc.phone || 'N/A'}</td>
                                                    <td className="p-4"><Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-0">Active</Badge></td>
                                                    <td className="p-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                            onClick={() => handleDeleteUser(acc.id, 'staff')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* CANTEEN TAB */}
                    <TabsContent value="canteen" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Registered Canteen Managers ({filteredCanteenManagers.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('canteen')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Canteen Manager
                            </Button>
                        </div>
                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isStaffLoading ? (
                                            <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredCanteenManagers.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No canteen managers found.</td></tr>
                                        ) : (
                                            filteredCanteenManagers.map((cm: any) => (
                                                <tr key={cm.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{cm.full_name}</td>
                                                    <td className="p-4">{cm.email}</td>
                                                    <td className="p-4">{cm.phone || 'N/A'}</td>
                                                    <td className="p-4"><Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-0">Active</Badge></td>
                                                    <td className="p-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                            onClick={() => handleDeleteUser(cm.id, 'staff')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* DRIVERS TAB */}
                    <TabsContent value="driver" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Registered Drivers ({filteredDrivers.length})</h3>
                            <Button size="sm" onClick={() => setDialogType('driver')} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Driver
                            </Button>
                        </div>
                        <Card className="border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b bg-muted/40">
                                        <tr className="border-b transition-colors">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {isStaffLoading ? (
                                            <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                                        ) : filteredDrivers.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No drivers found.</td></tr>
                                        ) : (
                                            filteredDrivers.map((driver: any) => (
                                                <tr key={driver.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 font-medium">{driver.full_name}</td>
                                                    <td className="p-4">{driver.email}</td>
                                                    <td className="p-4">{driver.phone || 'N/A'}</td>
                                                    <td className="p-4">
                                                        <Badge className={driver.is_active !== false ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-0" : "bg-red-100 text-red-700 hover:bg-red-100/80 border-0"}>
                                                            {driver.is_active !== false ? 'Active' : 'Disabled'}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <Button
                                                            variant={driver.is_active !== false ? "ghost" : "default"}
                                                            size="sm"
                                                            className={driver.is_active !== false
                                                                ? "text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                            }
                                                            onClick={() => handleToggleUserStatus(driver.id, 'staff', driver.is_active !== false)}
                                                        >
                                                            {driver.is_active !== false ? 'Disable' : 'Enable'}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Render Dialogs conditionally or always render them but control open status with props? 
                Always rendering is fine if they are lightweight, but conditional rendering (mounting only when open) 
                resets their internal state cleanly.
            */}
            {dialogType === 'student' && (
                <AddStudentDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    onSuccess={() => { }}
                />
            )}

            {dialogType === 'staff' && (
                <AddStaffDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    fixedRole="teacher"
                    onSuccess={() => { }}
                />
            )}

            {dialogType === 'accountant' && (
                <AddStaffDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    fixedRole="accountant"
                    onSuccess={() => { }}
                />
            )}

            {dialogType === 'canteen' && (
                <AddStaffDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    fixedRole="canteen_manager"
                    onSuccess={() => { }}
                />
            )}

            {dialogType === 'driver' && (
                <AddDriverDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    onSuccess={() => { }}
                />
            )}

            {dialogType === 'parent' && (
                <AddParentDialog
                    open={true}
                    onOpenChange={(open: boolean) => !open && setDialogType(null)}
                    institutionId={user?.institutionId}
                    students={institutionStudents}
                    onSuccess={() => { }}
                />
            )}

            {/* Bulk Upload Dialog */}
            <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Bulk Import Users</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file to bulk create users.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>User Type</Label>
                            <Select
                                value={bulkFileType}
                                onValueChange={(v: any) => setBulkFileType(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                    <SelectItem value="parent">Parent</SelectItem>
                                    <SelectItem value="driver">Driver</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="p-4 border border-dashed rounded-lg bg-muted/20 text-center space-y-3">
                            <div className="flex justify-center">
                                <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>1. Download the template</p>
                                <Button variant="link" size="sm" onClick={handleDownloadTemplate} className="h-auto p-0">
                                    Download {bulkFileType} template
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bulk-file">Upload File</Label>
                            <Input
                                id="bulk-file"
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Supported formats: .xlsx, .xls, .csv
                            </p>
                        </div>

                        {isBulkUploading && (
                            <div className="space-y-1">
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Processing {uploadProgress.current} of {uploadProgress.total}...
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowBulkUpload(false)}
                            disabled={isBulkUploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkUpload}
                            disabled={!bulkFile || isBulkUploading}
                        >
                            {isBulkUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                'Submit'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </InstitutionLayout>
    );
}
