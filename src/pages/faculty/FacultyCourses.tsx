import { FacultyLayout } from '@/layouts/FacultyLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { CourseCard } from '@/components/cards/CourseCard';
import { useAuth } from '@/context/AuthContext';
import { useFacultyDashboard } from '@/hooks/useFacultyDashboard';
import Loader from '@/components/common/Loader';
import { BookOpen, Users, MessageCircle, Phone, X, Search } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function FacultyCourses() {
    const { user } = useAuth();
    const { assignedSubjects, isLoading } = useFacultyDashboard(user?.id, user?.institutionId);
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch students for the selected course
    const { data: students = [], isLoading: isStudentsLoading } = useQuery({
        queryKey: ['course-students', selectedCourse?.classId, selectedCourse?.section],
        queryFn: async () => {
            if (!selectedCourse) return [];
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('class_name', selectedCourse.className)
                .eq('section', selectedCourse.section || 'A')
                .order('name');
            
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedCourse && isDialogOpen
    });

    const filteredStudents = useMemo(() => {
        return students.filter((s: any) => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.roll_no?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [students, searchQuery]);

    const handleCall = (phone?: string) => {
        if (!phone) return toast.error('No phone number available');
        window.location.href = `tel:${phone}`;
    };

    const handleWhatsApp = (phone?: string) => {
        if (!phone) return toast.error('No phone number available');
        const cleanPhone = phone.replace(/[^\d]/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    if (isLoading) {
        return (
            <FacultyLayout>
                <Loader fullScreen={false} />
            </FacultyLayout>
        );
    }

    return (
        <FacultyLayout>
            <PageHeader
                title="My Subjects"
                subtitle="Manage your assigned subjects and classes"
            />

            {assignedSubjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-muted/30 rounded-lg border-2 border-dashed border-border/50 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No Subjects Assigned</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">
                        You haven't been assigned to any subjects yet. Please contact your institution administrator.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignedSubjects.map((subject) => (
                        <div key={subject.id} className="cursor-pointer transition-transform hover:scale-[1.01]"
                            onClick={() => {
                                setSelectedCourse(subject);
                                setIsDialogOpen(true);
                            }}
                        >
                            <CourseCard
                                title={subject.subjectName}
                                code={subject.className}
                                instructor="You"
                                students={subject.studentCount || 0}
                                schedule={`Section ${subject.section}`}
                                status="active"
                            />
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                <span>Students - {selectedCourse?.subjectName}</span>
                            </div>
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedCourse?.className} - Section {selectedCourse?.section} ({students.length} students)
                        </p>
                        
                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name or roll no..."
                                className="w-full bg-muted/50 border-none rounded-md py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        {isStudentsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader fullScreen={false} />
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground italic">
                                {searchQuery ? "No matching students found." : "No students found in this class."}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredStudents.map((student: any) => (
                                    <div key={student.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                                                {student.roll_no || student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm sm:text-base">{student.name}</h4>
                                                <p className="text-xs text-muted-foreground">Roll No: {student.roll_no || 'N/A'}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-9 w-9 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                                onClick={() => handleWhatsApp(student.parent_phone || student.phone)}
                                                title="WhatsApp"
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-9 w-9 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                                onClick={() => handleCall(student.parent_phone || student.phone)}
                                                title="Call"
                                            >
                                                <Phone className="h-4 w-4" />
                                            </Button>
                                        </div>
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
