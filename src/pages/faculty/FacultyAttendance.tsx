import { FacultyLayout } from '@/layouts/FacultyLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CheckCircle, XCircle, Search, Filter, UserPlus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { AdCard } from '@/components/cards/AdCard';
import { Award } from 'lucide-react';
import { useEffect } from 'react';
import { useWebSocketContext } from '@/context/WebSocketContext';



export function FacultyAttendance() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { subscribeToTable } = useWebSocketContext();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [newStudent, setNewStudent] = useState({
        name: '',
        rollNo: '',
        class: 'Grade 10-A'
    });

    const institutionId = user?.institutionId;
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch Students & Their Attendance for today (Filtered by Faculty Class)
    const { data: students = [], isLoading } = useQuery({
        queryKey: ['faculty-attendance-list', institutionId, today, user?.id],
        queryFn: async () => {
            if (!institutionId || !user?.id) return [];

            // 1. Get Faculty's Assigned Class(es) and Section(s) as Class Teacher
            const { data: assignments, error: assignmentError } = await supabase
                .from('faculty_subjects')
                .select(`
                    section,
                    classes:class_id (
                        name
                    )
                `)
                .eq('faculty_profile_id', user.id)
                .eq('assignment_type', 'class_teacher');

            if (assignmentError) {
                console.error('Assignment fetch error:', assignmentError);
                return [];
            }

            if (!assignments || assignments.length === 0) return [];

            // 2. Accumulate students from all assigned class/section pairs
            let allStudents: any[] = [];
            for (const assignment of assignments) {
                const className = (assignment.classes as any)?.name;
                const section = assignment.section;

                if (!className) continue;

                const { data: curStudents } = await supabase
                    .from('students')
                    .select('*')
                    .eq('institution_id', institutionId)
                    .eq('class_name', className)
                    .eq('section', section)
                    .order('roll_no', { ascending: true });

                if (curStudents) {
                    allStudents = [...allStudents, ...curStudents];
                }
            }

            if (allStudents.length === 0) return [];

            // 3. Get today's attendance for these students
            const studentIds = allStudents.map(s => s.id);
            const { data: attendanceData, error: attendanceError } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('institution_id', institutionId)
                .eq('attendance_date', today)
                .in('student_id', studentIds);

            if (attendanceError) throw attendanceError;

            // Map attendance to students
            return allStudents.map(student => {
                const att = attendanceData?.find(a => a.student_id === student.id);
                return {
                    ...student,
                    status: att ? att.status : 'absent',
                    attendanceId: att?.id,
                    isPending: !att
                };
            });
        },
        enabled: !!institutionId && !!user?.id,
    });

    // 2. Multi-table Real-time Sync
    useEffect(() => {
        if (!institutionId) return;

        // Subscribe to attendance changes
        const unsubAttendance = subscribeToTable('student_attendance',
            () => queryClient.invalidateQueries({ queryKey: ['faculty-attendance-list'] }),
            { filter: `institution_id=eq.${institutionId}` }
        );

        return () => { unsubAttendance(); };
    }, [institutionId, queryClient, subscribeToTable]);

    const toggleStatus = async (studentId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'present' ? 'absent' : 'present';

        try {
            // Upsert works for both inserting new record or updating existing
            const { error } = await supabase
                .from('student_attendance')
                .upsert({
                    student_id: studentId,
                    institution_id: institutionId,
                    attendance_date: today,
                    status: newStatus
                }, { onConflict: 'student_id, attendance_date' });

            if (error) throw error;

            toast.success(`Marked as ${newStatus}`);
            // Optimistic update could go here, but query invalidation is fast enough usually
            queryClient.invalidateQueries({ queryKey: ['faculty-attendance-list'] });
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleAddStudent = async () => {
        toast.info("Use Institution Dashboard");
        setIsDialogOpen(false);
    };

    // Filter students
    const filteredAttendance = students.filter((s: any) => {
        // Status logic: if !att record, it's technically 'absent' in our map above, 
        // but maybe we want to distinguish 'explicitly absent' vs 'not marked'.
        // For this view, let's treat 'pending' as 'absent' for filtering 'absent', or separate?
        // Let's just use the mapped status.
        const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.roll_no?.toLowerCase().includes(searchTerm.toLowerCase()); // Changed register_number to roll_no based on DB
        return matchesStatus && matchesSearch;
    });

    const columns = [
        { key: 'roll_no', header: 'Roll No.' }, // Changed reg no
        { key: 'name', header: 'Student Name' },
        {
            key: 'classComponent',
            header: 'Class',
            render: (item: any) => <span>{item.class_name} - {item.section}</span>
        },
        {
            key: 'lastAttendance',
            header: 'Today',
            render: (item: any) => (
                <span className={item.isPending ? "text-orange-500 font-medium text-xs" : "text-green-600 font-medium text-xs"}>
                    {item.isPending ? 'Pending' : 'Recognized'}
                </span>
            )
        },
        {
            key: 'status',
            header: 'Status',
            render: (item: any) => (
                <Badge variant={item.status === 'present' ? 'success' : 'destructive'}>
                    {item.status.toUpperCase()}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (item: any) => (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant={item.status === 'present' ? 'default' : 'outline'}
                        onClick={() => toggleStatus(item.id, 'present')} // Force present
                        className={item.status === 'present' ? "bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0" : "h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"}
                        disabled={item.status === 'present'}
                    >
                        <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant={item.status === 'absent' ? 'destructive' : 'outline'}
                        onClick={() => toggleStatus(item.id, 'absent')} // Force absent
                        className={item.status === 'absent' ? "bg-red-600 hover:bg-red-700 text-white h-8 w-8 p-0" : "h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"}
                        disabled={item.status === 'absent' && !item.isPending} // Allowed to click if pending (which defaults to absent but isPending=true)
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    // Real-time Counts
    const presentCount = students.filter((s: any) => s.status === 'present').length;
    const totalStrength = students.length;
    const absentCount = totalStrength - presentCount; // Assuming pending is counted as absent for now

    return (
        <FacultyLayout>
            <PageHeader
                title="Attendance Management"
                subtitle="Mark and manage student attendance for your assigned class"
            />

            <AdCard
                title="Celebrate Consistency!"
                description="Recognize students with 100% monthly attendance with our new automated certificate generator."
                Icon={Award}
                iconBgColor="bg-gradient-to-tr from-yellow-400 to-amber-600 text-white"
                badgeText="Faculty Tip"
                variant="compact"
                className="mb-6"
            />

            <div className="dashboard-card mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search students..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Institution: <strong>Live View</strong></span>
                        <span>•</span>
                        <span>Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
                    </div>
                </div>

                <DataTable columns={columns} data={filteredAttendance} loading={isLoading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="dashboard-card bg-success/5 border-success/20 p-6">
                    <h4 className="text-sm font-medium text-success mb-1">Present</h4>
                    <p className="text-4xl font-bold text-success">{presentCount}</p>
                </div>
                <div className="dashboard-card bg-destructive/5 border-destructive/20 p-6">
                    <h4 className="text-sm font-medium text-destructive mb-1">Absent</h4>
                    <p className="text-4xl font-bold text-destructive">{absentCount}</p>
                </div>
                <div className="dashboard-card bg-info/5 border-info/20 p-6">
                    <h4 className="text-sm font-medium text-info mb-1">Total Strength</h4>
                    <p className="text-4xl font-bold text-info">{totalStrength}</p>
                </div>
            </div>
        </FacultyLayout>
    );
}
