import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FacultyLayout } from '@/layouts/FacultyLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, FileText, Download, MoreVertical, Edit, XCircle, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Loader from '@/components/common/Loader';

export function FacultyAssignments() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [assignments, setAssignments] = useState<any[]>([]);
    const [stats, setStats] = useState({
        active: 0,
        graded: 0,
        pending: 0,
        dueToday: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [viewSubmissionsOpen, setViewSubmissionsOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        if (!user?.id) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch Assignments with joined class and subject info
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('assignments')
                .select(`
                    *,
                    classes ( id, name, section ),
                    subjects:subject_id ( name )
                `)
                .eq('faculty_id', user.id)
                .order('due_date', { ascending: false });

            if (assignmentsError) throw assignmentsError;

            // 2. Fetch all submissions for these assignments to calculate stats
            const assignmentIds = (assignmentsData || []).map(a => a.id);
            const { data: submissionsData, error: submissionsError } = await supabase
                .from('assignment_submissions')
                .select('id, assignment_id, status')
                .in('assignment_id', assignmentIds);

            if (submissionsError) throw submissionsError;

            // 3. Process Stats
            const activeCount = (assignmentsData || []).filter(a => new Date(a.due_date) >= new Date(today)).length;
            const dueTodayCount = (assignmentsData || []).filter(a => a.due_date === today).length;
            const gradedCount = (submissionsData || []).filter(s => s.status === 'Graded').length;
            const pendingCount = (submissionsData || []).filter(s => s.status === 'Pending').length;

            setStats({
                active: activeCount,
                graded: gradedCount,
                pending: pendingCount,
                dueToday: dueTodayCount
            });

            // 4. Format Assignments List
            const formatted = (assignmentsData || []).map((a: any) => {
                const assignmentSubmissions = (submissionsData || []).filter(s => s.assignment_id === a.id);
                return {
                    id: a.id,
                    title: a.title,
                    subject: a.subjects?.name || 'N/A',
                    class: a.classes ? `${a.classes.name} - ${a.classes.section}` : 'N/A',
                    dueDate: new Date(a.due_date).toLocaleDateString(),
                    submissions: `${assignmentSubmissions.length}`,
                    status: new Date(a.due_date) < new Date(today) ? 'closed' : 'active'
                };
            });

            setAssignments(formatted);
        } catch (error) {
            console.error('Error fetching assignment data:', error);
            toast.error('Failed to load assignments');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchData();

        if (!user?.id) return;

        // Set up real-time subscriptions
        const assignmentsChannel = supabase.channel('assignments_realtime')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignments', 
                filter: `faculty_id=eq.${user.id}` 
            }, () => fetchData())
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignment_submissions' 
            }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(assignmentsChannel);
        };
    }, [fetchData, user?.id]);

    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => 
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.class.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [assignments, searchQuery]);

    const handleCloseAssignment = async (id: string) => {
        toast.info("Manual closing is handled by expiry logic.");
    };

    const handleUpdateAssignment = (id: string) => {
        navigate(`/faculty/assignments/edit/${id}`);
    };

    const handleViewSubmissions = async (assignment: any) => {
        setSelectedAssignment(assignment);
        setViewSubmissionsOpen(true);
        setIsLoadingSubmissions(true);
        setSubmissions([]);

        try {
            const { data, error } = await supabase
                .from('assignment_submissions')
                .select('*')
                .eq('assignment_id', assignment.id);

            if (error) throw error;
            setSubmissions(data || []);
        } catch (error) {
            console.error('Error fetching submissions:', error);
            toast.error('Failed to load submissions');
        } finally {
            setIsLoadingSubmissions(false);
        }
    };

    const handleDownload = async (submission: any) => {
        try {
            if (!submission.file_path) {
                toast.error("File not found");
                return;
            }
            const { data } = supabase.storage.from('assignments').getPublicUrl(submission.file_path);
            if (data?.publicUrl) {
                window.open(data.publicUrl, '_blank');
            } else {
                toast.error("Could not generate download URL");
            }
        } catch (e) {
            console.error(e);
            toast.error("Download failed");
        }
    };

    const columns = [
        { key: 'title', header: 'Assignment Title' },
        { key: 'subject', header: 'Subject' },
        { key: 'class', header: 'Class' },
        { key: 'dueDate', header: 'Due Date' },
        { key: 'submissions', header: 'Submissions' },
        {
            key: 'status',
            header: 'Status',
            render: (item: any) => (
                <Badge variant={item.status === 'active' ? 'success' : 'outline'}>
                    {item.status.toUpperCase()}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (item: any) => (
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewSubmissions(item)} title="View Submissions">
                        <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => handleUpdateAssignment(item.id)}
                                className="flex items-center gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                Update
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleCloseAssignment(item.id)}
                                disabled={item.status === 'closed'}
                                className="flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                Close
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    if (isLoading && assignments.length === 0) {
        return (
            <FacultyLayout>
                <Loader fullScreen={false} />
            </FacultyLayout>
        );
    }

    return (
        <FacultyLayout>
            <PageHeader
                title="Assignments"
                subtitle="Create and manage assignments for your students"
                actions={
                    <Button
                        className="btn-primary flex items-center gap-2"
                        onClick={() => navigate('/faculty/assignments/create')}
                    >
                        <Plus className="w-4 h-4" />
                        Create Assignment
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Total Active', value: stats.active, icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Graded', value: stats.graded, icon: FileText, color: 'text-success', bg: 'bg-success/10' },
                    { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'Due Today', value: stats.dueToday, icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
                ].map((stat, idx) => (
                    <div key={idx} className="dashboard-card animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <h4 className="font-medium text-sm text-muted-foreground">{stat.label}</h4>
                        </div>
                        <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="dashboard-card">
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search assignments..."
                            className="input-field pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <DataTable columns={columns} data={filteredAssignments} emptyMessage="No assignments found." />
            </div>

            <Dialog open={viewSubmissionsOpen} onOpenChange={setViewSubmissionsOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Submissions for {selectedAssignment?.title}</DialogTitle>
                        <DialogDescription>
                            Review student submissions below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                        {isLoadingSubmissions ? (
                            <div className="flex justify-center py-8"><Loader fullScreen={false} /></div>
                        ) : submissions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">No submissions found.</div>
                        ) : (
                            <div className="space-y-3">
                                {submissions.map((sub, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:border-primary/50 transition-all shadow-sm">
                                        <div>
                                            <p className="font-semibold text-base">{sub.student_name || 'Unknown Student'}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(sub.submitted_at).toLocaleString()}</div>
                                                <Badge variant={sub.status === 'Graded' ? 'success' : 'warning'} className="text-[10px] h-4 px-1">
                                                    {sub.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleDownload(sub)}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </FacultyLayout>
    );
}
