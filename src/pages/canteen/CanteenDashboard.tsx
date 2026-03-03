
import { useState, useMemo, useEffect } from 'react';
import { CanteenLayout } from '@/layouts/CanteenLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/common/Badge';
import { AdCard } from '@/components/cards/AdCard';
import { Apple } from 'lucide-react';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Calendar,
    Search,
    Users,
    GraduationCap,
    ChevronRight,
    ArrowLeft,
    CheckCircle
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useInstitution } from '@/context/InstitutionContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CanteenDashboard() {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<'classes' | 'sections' | 'students'>('classes');
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, string>>({});
    const [canteenEntries, setCanteenEntries] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [dbClasses, setDbClasses] = useState<string[]>([]);
    const [dbSections, setDbSections] = useState<string[]>([]);
    const [isSessionClosed, setIsSessionClosed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const institutionId = user?.institutionId;
    const today = new Date().toISOString().split('T')[0];

    // Fetch unique classes on mount
    useEffect(() => {
        const fetchClasses = async () => {
            if (!institutionId) return;
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('class_name')
                    .eq('institution_id', institutionId)
                    .not('class_name', 'is', null);

                if (error) throw error;

                const uniqueClasses = Array.from(new Set(data.map(s => s.class_name))).sort((a, b) => {
                    const order = ['LKG', 'UKG'];
                    const indexA = order.indexOf(a);
                    const indexB = order.indexOf(b);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b, undefined, { numeric: true });
                });
                setDbClasses(uniqueClasses);
            } catch (err: any) {
                console.error('Error fetching classes:', err);
            }
        };
        fetchClasses();
    }, [institutionId]);

    // Fetch unique sections when class is selected
    useEffect(() => {
        const fetchSections = async () => {
            if (!institutionId || !selectedClass) return;
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('section')
                    .eq('institution_id', institutionId)
                    .eq('class_name', selectedClass)
                    .not('section', 'is', null);

                if (error) throw error;

                const uniqueSections = Array.from(new Set(data.map(s => s.section))).sort();
                setDbSections(uniqueSections);
            } catch (err: any) {
                console.error('Error fetching sections:', err);
            }
        };
        fetchSections();
    }, [institutionId, selectedClass]);

    // Fetch session status for today
    useEffect(() => {
        const fetchSessionStatus = async () => {
            if (!institutionId) return;
            try {
                const { data, error } = await supabase
                    .from('canteen_sessions')
                    .select('is_closed')
                    .eq('institution_id', institutionId)
                    .eq('session_date', today)
                    .maybeSingle();

                if (error) throw error;
                if (data) setIsSessionClosed(data.is_closed);
            } catch (err: any) {
                console.error('Error fetching session status:', err);
            }
        };
        fetchSessionStatus();
    }, [institutionId, today]);

    const fetchStudents = async () => {
        if (!selectedClass || !selectedSection || !institutionId) return;
        setLoading(true);

        try {
            const { data: studentsData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('institution_id', institutionId)
                .eq('class_name', selectedClass)
                .eq('section', selectedSection)
                .eq('is_active', true)
                .order('name');

            if (studentError) throw studentError;

            const studentIds = studentsData.map(s => s.id);

            const { data: attData } = await supabase
                .from('student_attendance')
                .select('student_id, status')
                .eq('institution_id', institutionId)
                .eq('attendance_date', today)
                .in('student_id', studentIds);

            const attMap: Record<string, string> = {};
            attData?.forEach(a => attMap[a.student_id] = a.status);
            setAttendance(attMap);

            const { data: canteenData } = await supabase
                .from('canteen_attendance')
                .select('student_id, status')
                .eq('institution_id', institutionId)
                .eq('canteen_date', today)
                .in('student_id', studentIds);

            const canteenMap: Record<string, string> = {};
            canteenData?.forEach(c => canteenMap[c.student_id] = c.status);
            setCanteenEntries(canteenMap);

            setStudents(studentsData);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'students') {
            fetchStudents();
        }
    }, [viewMode, selectedClass, selectedSection]);

    const handleStudentClick = async (studentId: string, morningStatus: string) => {
        if (isSessionClosed) {
            toast.error('Attendance is closed for today');
            return;
        }

        let newStatus = 'absent';
        const currentCanteenStatus = canteenEntries[studentId] || 'absent';
        const isMorningAllowed = morningStatus === 'present' || morningStatus === 'late';

        if (isMorningAllowed) {
            // Toggle between present and absent for morning-present students
            newStatus = currentCanteenStatus === 'present' ? 'absent' : 'present';
        } else {
            // Toggle between unverified (Grey) and absent for morning-absent/pending students
            newStatus = currentCanteenStatus === 'unverified' ? 'absent' : 'unverified';
        }

        try {
            const { error } = await supabase
                .from('canteen_attendance')
                .upsert({
                    student_id: studentId,
                    institution_id: institutionId!,
                    canteen_date: today,
                    status: newStatus
                }, { onConflict: 'student_id, canteen_date' });

            if (error) throw error;

            setCanteenEntries(prev => ({ ...prev, [studentId]: newStatus }));

            if (newStatus === 'present') {
                toast.success('Permitted in canteen');
            } else if (newStatus === 'unverified') {
                toast.warning('Unverified entry marked');
            } else {
                toast.info('Marked absent in canteen');
            }
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleSubmitAttendance = async () => {
        if (!institutionId) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('canteen_sessions')
                .upsert({
                    institution_id: institutionId,
                    session_date: today,
                    is_closed: true,
                    closed_at: new Date().toISOString(),
                    closed_by: user?.id
                }, { onConflict: 'institution_id, session_date' });

            if (error) throw error;

            setIsSessionClosed(true);
            toast.success('Canteen attendance closed for today');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClassClick = (cls: string) => {
        setSelectedClass(cls);
        setViewMode('sections');
    };

    const handleSectionClick = (sec: string) => {
        setSelectedSection(sec);
        setViewMode('students');
    };

    const goBack = () => {
        if (viewMode === 'students') setViewMode('sections');
        else if (viewMode === 'sections') setViewMode('classes');
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.register_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [students, searchTerm]);

    const stats = useMemo(() => {
        const morningPresent = filteredStudents.filter(s => {
            const status = (attendance[s.id] || '').toLowerCase();
            return status === 'present' || status === 'late';
        }).length;
        const morningAbsent = filteredStudents.filter(s => (attendance[s.id] || '').toLowerCase() === 'absent').length;
        const morningPending = filteredStudents.filter(s => !attendance[s.id]).length;
        const canteenPermitted = filteredStudents.filter(s => canteenEntries[s.id] === 'present').length;
        const canteenUnverified = filteredStudents.filter(s => canteenEntries[s.id] === 'unverified').length;
        return { morningPresent, morningAbsent, morningPending, canteenPermitted, canteenUnverified, total: filteredStudents.length };
    }, [filteredStudents, attendance, canteenEntries]);

    return (
        <CanteenLayout>
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Canteen Management</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        {isSessionClosed && (
                            <Badge variant="success" className="bg-green-500/10 text-green-600 border-green-200 gap-1.5 py-0.5 px-3">
                                <CheckCircle className="w-3 h-3" /> SESSION CLOSED
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isSessionClosed && stats.total > 0 && viewMode === 'students' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-white gap-2 h-10 md:h-12 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                                    <CheckCircle className="w-5 h-5" />
                                    <span>Submit & Close Day</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border-2">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-bold">Close Attendance for Today?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                        This will finalize all records for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
                                        Once closed, you will not be able to modify any attendance data for today.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3 sm:gap-0">
                                    <AlertDialogCancel className="rounded-xl h-12">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleSubmitAttendance}
                                        className="bg-primary hover:bg-primary/90 rounded-xl h-12"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                        )}
                                        Finalize & Close
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {viewMode !== 'classes' && (
                        <Button variant="ghost" onClick={goBack} className="self-start sm:self-center gap-2 h-10 md:h-12 px-4 md:px-6 rounded-xl border border-border bg-card hover:bg-muted transition-all shadow-sm">
                            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="text-sm md:text-base">Back</span>
                        </Button>
                    )}
                </div>
            </div>

            <AdCard
                title="Healthy Snacks for Students"
                description="Promote healthy eating habits with our new range of nutritious snacks and organic lunch options available now."
                Icon={Apple}
                iconBgColor="bg-gradient-to-tr from-green-400 to-emerald-600 text-white"
                badgeText="Canteen Update"
                className="mb-8"
            />

            {viewMode === 'classes' && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
                    {dbClasses.map((cls) => (
                        <Card
                            key={cls}
                            onClick={() => handleClassClick(cls)}
                            className="p-4 md:p-6 cursor-pointer hover:shadow-xl hover:border-primary/50 hover:scale-102 transition-all bg-card/50 backdrop-blur-sm border-2 flex flex-col items-center justify-center text-center gap-3 md:gap-4 group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg md:text-xl font-black text-foreground">Class {cls}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1">Select section</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Card>
                    ))}
                </div>
            )}

            {viewMode === 'sections' && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
                    {dbSections.map((sec) => (
                        <Card
                            key={sec}
                            onClick={() => handleSectionClick(sec)}
                            className="p-4 md:p-6 cursor-pointer hover:shadow-xl hover:border-primary/50 hover:scale-102 transition-all bg-card/50 backdrop-blur-sm border-2 flex flex-col items-center justify-center text-center gap-3 md:gap-4 group"
                        >
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                                <Users className="w-6 h-6 md:w-8 md:h-8 text-secondary" />
                            </div>
                            <div>
                                <h3 className="text-lg md:text-xl font-black text-foreground">Section {sec}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1">Class {selectedClass}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
                        </Card>
                    ))}
                </div>
            )}

            {viewMode === 'students' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 py-2 bg-background/95 backdrop-blur-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                className="pl-10 h-11 rounded-xl border-2 focus:ring-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 md:gap-4">
                            <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm font-bold text-green-700">Permitted: {stats.canteenPermitted}</span>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                <span className="text-sm font-bold text-gray-700">Unverified: {stats.canteenUnverified}</span>
                            </div>
                            <div className="px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3">
                                <span className="text-sm font-bold text-primary">Total: {stats.total}</span>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <p className="text-muted-foreground font-medium">Loading student data...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredStudents.map((student) => {
                                    const rawStatus = attendance[student.id] || 'pending';
                                    const morningStatus = rawStatus.toLowerCase();
                                    const isMorningAllowed = morningStatus === 'present' || morningStatus === 'late';
                                    const isMorningAbsent = morningStatus === 'absent';
                                    const canteenStatus = canteenEntries[student.id] || 'absent';
                                    const isCanteenActive = canteenStatus === 'present' || canteenStatus === 'unverified';

                                    return (
                                        <Card
                                            key={student.id}
                                            className={cn(
                                                "p-4 transition-all border-2 cursor-pointer hover:shadow-lg relative overflow-hidden",
                                                isCanteenActive
                                                    ? isMorningAllowed
                                                        ? "border-green-300 bg-green-50/30 hover:border-green-400"
                                                        : "border-gray-400 bg-gray-100 hover:border-gray-500"
                                                    : isMorningAbsent
                                                        ? "border-red-200 bg-red-50/20 hover:border-red-300"
                                                        : "border-border hover:border-primary/30",
                                                isSessionClosed && "opacity-80 grayscale-[0.2]"
                                            )}
                                            onClick={() => handleStudentClick(student.id, morningStatus)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {student.image_url ? (
                                                        <img
                                                            src={student.image_url}
                                                            alt={student.name}
                                                            className="w-12 h-12 rounded-full border-2 border-primary/20 object-cover flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex-shrink-0 flex items-center justify-center">
                                                            <span className="text-xs font-black text-primary uppercase">
                                                                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-bold text-sm leading-tight truncate">{student.name}</h3>
                                                        <p className="text-xs text-muted-foreground font-medium">
                                                            Reg: {student.register_number || student.id.slice(0, 4)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                                <Badge
                                                    variant={isMorningAllowed ? "success" : isMorningAbsent ? "destructive" : "outline"}
                                                    className="text-[10px] font-black uppercase"
                                                >
                                                    {isMorningAllowed ? (morningStatus === 'late' ? "Late ✓" : "Morning ✓") : isMorningAbsent ? "Morning ✗" : "Pending ?"}
                                                </Badge>

                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
                                                    isCanteenActive
                                                        ? isMorningAllowed
                                                            ? "bg-green-500"
                                                            : "bg-gray-700"
                                                        : "bg-muted hover:bg-muted/80"
                                                )}>
                                                    {isCanteenActive ? (
                                                        <CheckCircle2 className="w-6 h-6 text-white" />
                                                    ) : isMorningAbsent ? (
                                                        <XCircle className="w-6 h-6 text-red-500" />
                                                    ) : (
                                                        <Loader2 className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}

                                {filteredStudents.length === 0 && (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40">
                                            <Search className="w-10 h-10" />
                                        </div>
                                        <p className="text-muted-foreground font-bold">No students found.</p>
                                    </div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border">
                                <h3 className="font-bold text-sm mb-3">Attendance Legend:</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium">
                                    <div className="flex items-center gap-3 p-2 bg-white rounded-lg border shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        </div>
                                        <span><strong>Permitted:</strong> Scanned in morning & canteen (Green).</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded-lg border shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        </div>
                                        <span><strong>Unverified:</strong> Pre-scanned but entered canteen (Grey).</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded-lg border shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        </div>
                                        <span><strong>Absent:</strong> Verified absent in morning (Red).</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-white rounded-lg border shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <span><strong>Pending:</strong> Not yet verified (Neutral).</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </CanteenLayout>
    );
}
