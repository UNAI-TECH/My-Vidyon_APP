import { useState, useEffect } from 'react';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/common/Badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";

interface FeeComponent {
    id: string;
    title: string;
    amount: string;
}
import { Trash2, Plus, Search, Filter, Download, CreditCard, Clock, CheckCircle, ChevronRight, Check, Loader2, School, Send, Mail, Phone, MapPin, Printer, IndianRupee, FileText, Users, ArrowLeft, Info, Layers, GraduationCap, ArrowRight, Home, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InvoiceView } from '@/components/common/InvoiceView';
import { useInstitution } from '@/context/InstitutionContext';
import { toast } from 'sonner';
import { AdCard } from '@/components/cards/AdCard';

export function InstitutionFees() {
    const { user } = useAuth();
    const { allClasses } = useInstitution();

    // Helper function to sort classes in proper educational order
    const sortClasses = (classes: string[]) => {
        const classOrder = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

        // Create a copy to avoid mutating the original array
        return [...classes].sort((a, b) => {
            // Normalize class names (remove 'st', 'nd', 'rd', 'th' suffixes and extra text)
            const normalizeClass = (className: string) => {
                const normalized = className
                    .toUpperCase()
                    .replace(/(\d+)(ST|ND|RD|TH)/i, '$1')
                    .replace(/GRADE\s*/i, '')
                    .replace(/CLASS\s*/i, '')
                    .trim();
                return normalized;
            };

            const normalizedA = normalizeClass(a);
            const normalizedB = normalizeClass(b);

            const indexA = classOrder.indexOf(normalizedA);
            const indexB = classOrder.indexOf(normalizedB);

            // If both are in the predefined order, sort by their position
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // If only A is in the order, it comes first
            if (indexA !== -1) return -1;
            // If only B is in the order, it comes first
            if (indexB !== -1) return 1;
            // If neither is in the order, sort alphabetically
            return a.localeCompare(b);
        });
    };

    // State for unique classes fetched from students table
    const [uniqueClasses, setUniqueClasses] = useState<string[]>([]);

    // State for Stats
    const [stats, setStats] = useState({ revenue: 0, outstanding: 0 });

    // State
    const [isSelectionStarted, setIsSelectionStarted] = useState(false);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'tree' | 'students'>('tree');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [availableSections, setAvailableSections] = useState<string[]>([]);

    // Data
    const [students, setStudents] = useState<any[]>([]);
    const [feeStructures, setFeeStructures] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Popup State
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [openDialog, setOpenDialog] = useState<'none' | 'fees' | 'bio' | 'track' | 'create_structure' | 'receipt' | 'manual_bill'>('none');

    // Branding State
    const [institutionInfo, setInstitutionInfo] = useState<any>(null);

    // Create Fee Structure State (Enhanced)
    const [structureName, setStructureName] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [feeComponents, setFeeComponents] = useState<FeeComponent[]>([{ id: '1', title: 'Tuition Fee', amount: '0' }]);

    const [selectedClassForFee, setSelectedClassForFee] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Wizard State
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [baseStructureId, setBaseStructureId] = useState<string | null>(null);
    const [assignedStudents, setAssignedStudents] = useState<{ studentId: string, studentName: string, components: FeeComponent[], total: number }[]>([]);
    const [currentEditingStudentId, setCurrentEditingStudentId] = useState<string | null>(null);
    const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
    const [selectedSectionForFee, setSelectedSectionForFee] = useState<string>('');
    const [availableSectionsForFee, setAvailableSectionsForFee] = useState<string[]>([]);

    // Manual Billing State
    const [manualFeeComponents, setManualFeeComponents] = useState<FeeComponent[]>([{ id: '1', title: 'Miscellaneous Fee', amount: '0' }]);
    const [manualBillDueDate, setManualBillDueDate] = useState('');
    const [isManualBilling, setIsManualBilling] = useState(false);

    // Fetch unique classes from students table
    useEffect(() => {
        const fetchUniqueClasses = async () => {
            if (!user?.institutionId) {
                console.log('No institution ID, skipping class fetch');
                return;
            }

            try {
                console.log('Fetching classes for institution:', user.institutionId);
                const { data, error } = await supabase
                    .from('students')
                    .select('class_name')
                    .eq('institution_id', user.institutionId);

                if (error) {
                    console.error('Error fetching classes:', error);
                    return;
                }

                console.log('Raw student data:', data);

                if (data) {
                    // Extract unique class names
                    const classes = [...new Set(
                        data
                            .map(s => s.class_name)
                            .filter(c => c && c.trim() !== '')
                    )] as string[];

                    console.log('Unique classes before sorting:', classes);

                    // Sort classes in educational order
                    const sortedClasses = sortClasses(classes);
                    console.log('Sorted classes:', sortedClasses);
                    setUniqueClasses(sortedClasses);
                }
            } catch (err) {
                console.error('Error fetching unique classes:', err);
            }
        };

        fetchUniqueClasses();
    }, [user?.institutionId]);

    // Fetch Institution Information
    useEffect(() => {
        const fetchInstitutionInfo = async () => {
            if (!user?.institutionId) return;
            try {
                const { data, error } = await supabase
                    .from('institutions')
                    .select('name, logo_url, address, city, state, email, phone')
                    .eq('id', user.institutionId)
                    .maybeSingle();
                if (error) throw error;
                setInstitutionInfo(data);
            } catch (err) {
                console.error('Error fetching institution info:', err);
            }
        };
        fetchInstitutionInfo();
    }, [user?.institutionId]);


    // Fetch Global Stats
    useEffect(() => {
        if (!user?.institutionId) return;

        const fetchData = async () => {
            // Fetch Stats
            try {
                const { data, error } = await supabase
                    .from('student_fees')
                    .select('amount_paid, amount_due')
                    .eq('institution_id', user.institutionId);

                if (error) throw error;

                const revenue = data.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
                const due = data.reduce((sum, r) => sum + (Number(r.amount_due) || 0), 0);
                setStats({ revenue, outstanding: due - revenue });
            } catch (err) {
                console.error("Stats fetch error:", err);
            }
        };
        fetchData();
    }, [user?.institutionId]);

    // Fetch sections when class is selected
    useEffect(() => {
        const fetchSections = async () => {
            if (!selectedClass || !user?.institutionId) return;

            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('section')
                    .eq('institution_id', user.institutionId)
                    .eq('class_name', selectedClass);

                if (error) {
                    console.error('Error fetching sections:', error);
                    return;
                }

                if (data) {
                    const sections = [...new Set(
                        data
                            .map(s => s.section)
                            .filter(s => s && s.trim() !== '')
                    )].sort((a, b) => a.localeCompare(b)) as string[];

                    setAvailableSections(sections);
                }
            } catch (err) {
                console.error('Error fetching sections:', err);
            }
        };

        fetchSections();
    }, [selectedClass, user?.institutionId]);

    // Fetch Fee Structures
    useEffect(() => {
        if (!user?.institutionId) return;
        const fetchFeeStructures = async () => {
            const { data } = await supabase.from('fee_structures').select('*').eq('institution_id', user.institutionId);
            setFeeStructures(data || []);
        };
        fetchFeeStructures();

        // Subscribe
        const channel = supabase.channel('fee_structures_sub')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_structures', filter: `institution_id=eq.${user.institutionId}` }, () => fetchFeeStructures())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.institutionId]);


    const fetchStudents = async () => {
        if (!selectedClass || !selectedSection || !user?.institutionId) return;
        setLoading(true);



        try {
            // 1. Get Class object
            const classObj = allClasses.find(c => c.name === selectedClass && c.section === selectedSection);
            if (!classObj) return;

            // 2. Fetch Students in Class
            const { data: studentsData, error: stuError } = await supabase
                .from('students')
                .select('*')
                .eq('institution_id', user.institutionId)
                .eq('class_name', selectedClass)
                .eq('section', selectedSection);

            if (stuError) throw stuError;

            // 3. Fetch Fee Structures for this institution
            const { data: classFeeStructures, error: feeStructError } = await supabase
                .from('fee_structures')
                .select('*')
                .eq('institution_id', user.institutionId);

            if (feeStructError) {
                console.error("Fee structure error:", feeStructError);
                // Don't throw, just log and continue with empty fee structures
            }

            // 4. Fetch Student Fees (if any exist)
            let feesData: any[] = [];
            if (studentsData && studentsData.length > 0) {
                const { data: fees, error: feesError } = await supabase
                    .from('student_fees')
                    .select('*')
                    .eq('institution_id', user.institutionId)
                    .in('student_id', studentsData.map(s => s.id));

                if (feesError) {
                    console.error("Fee fetch error:", feesError);
                    // Don't throw, just continue with empty fees
                } else {
                    feesData = fees || [];
                }
            }

            // Merge Data - Show ALL students even if they have no fees
            const merged = studentsData.map(s => {
                const sFees = feesData?.filter(f => f.student_id === s.id) || [];

                // Calculate Totals
                const totalDue = sFees.reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0);
                const totalPaid = sFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
                const pending = totalDue - totalPaid;

                let status = sFees.length === 0 ? 'No Fees' : 'Paid';
                if (pending > 0) status = 'Pending';
                if (sFees.some(f => f.status === 'overdue')) status = 'Due';

                return {
                    id: s.id,
                    name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
                    rollNo: s.roll_number || s.register_number || 'N/A',
                    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${s.name || s.first_name || 'Student'}`,
                    dob: s.dob || s.date_of_birth,
                    bloodGroup: s.blood_group,
                    parentName: s.parent_name || 'Guardian',
                    contact: s.emergency_contact || s.parent_phone,
                    address: s.address,
                    fees: {
                        total: totalDue,
                        paid: totalPaid,
                        pending: pending,
                        status: status,
                        structure: sFees.map(f => ({
                            category: 'Fee',
                            amount: f.amount_due,
                            paid: f.amount_paid,
                            dueDate: f.due_date
                        })),
                        classFeeStructures: classFeeStructures || []
                    }
                };
            });
            setStudents(merged);

        } catch (err: any) {
            console.error("Error fetching students:", err);
            toast.error("Failed to load student data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'students') {
            fetchStudents();
        }
    }, [viewMode, selectedClass, selectedSection]);

    // Real-time subscription for fee updates
    useEffect(() => {
        if (viewMode !== 'students' || !user?.institutionId) return;

        // Subscribe to student_fees changes
        const subscription = supabase
            .channel('student_fees_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'student_fees',
                    filter: `institution_id=eq.${user.institutionId}`
                },
                (payload) => {
                    console.log('📡 Fee update received:', payload);
                    // Refresh the student data when fees are updated
                    fetchStudents();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [viewMode, user?.institutionId, selectedClass, selectedSection]);



    const handleSendMessage = (student: any) => {
        // In a real app, this would open a dialog to compose a message
        // For now, we'll simulate sending a reminder
        const message = `Dear ${student.name}, this is a reminder to pay your outstanding fees of ₹${student.fees.pending}.`;

        // Simulate API call
        toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
            loading: 'Sending reminder...',
            success: `Reminder sent to ${student.name}`,
            error: 'Failed to send message'
        });
    };

    const handleSendReceipt = (student: any) => {
        setSelectedStudent(student);
        setOpenDialog('receipt');
    };

    const handleDownloadReceipt = () => {
        toast.success("Receipt downloaded successfully!");
        setOpenDialog('none');
    };

    const handleViewDetails = (student: any) => {
        setSelectedStudent(student);
        setOpenDialog('bio');
    };

    const handleViewFees = (student: any) => {
        setSelectedStudent(student);
        setOpenDialog('fees');
    };


    // Handlers
    const handleClassSelect = (cls: string) => {
        if (selectedClass === cls) return;
        setSelectedClass(cls);
        setSelectedSection(null);
        setFilterStatus('All');
    };

    const handleSectionSelect = (sec: string) => {
        setSelectedSection(sec);
        setFilterStatus('All');
    };

    const handleManualBill = (student: any) => {
        setSelectedStudent(student);
        setManualFeeComponents([{ id: '1', title: 'Miscellaneous Fee', amount: '0' }]);
        setManualBillDueDate(new Date().toISOString().split('T')[0]);
        setOpenDialog('manual_bill');
    };

    const handleSaveManualBill = async () => {
        if (!selectedStudent || !user?.institutionId) return;

        const totalAmount = manualFeeComponents.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
        if (totalAmount <= 0) {
            toast.error("Please add at least one fee component with an amount");
            return;
        }

        setIsManualBilling(true);
        try {
            // 1. Insert fee record (institution_id column typically expects TEXT code "VIDYON001" in this app)
            const { error: feeError } = await supabase.from('student_fees').insert([{
                student_id: selectedStudent.id,
                institution_id: user.institutionId, // Revert to direct usage
                amount_due: totalAmount,
                amount_paid: 0,
                due_date: manualBillDueDate ? new Date(manualBillDueDate).toISOString() : null,
                status: 'pending',
                description: JSON.stringify(manualFeeComponents)
            }]);

            if (feeError) throw feeError;

            // --- NOTIFICATION TRIGGER: Notify parent(s) ---
            try {
                // 1. Get student and all associated parents (direct + join table)
                const { data: studentInfo } = await supabase
                    .from('students')
                    .select(`
                        name, 
                        parent_id, 
                        institution_id,
                        student_parents (parent_id, parents:parent_id (profile_id))
                    `)
                    .eq('id', selectedStudent.id)
                    .single();

                if (studentInfo) {
                    // Collect all unique parent profile IDs
                    const parentProfileIds = new Set<string>();

                    // Add direct parent if exists
                    if (studentInfo.parent_id) parentProfileIds.add(studentInfo.parent_id);

                    // Add parents from join table
                    (studentInfo.student_parents as any[])?.forEach(sp => {
                        if (sp.parents?.profile_id) parentProfileIds.add(sp.parents.profile_id);
                    });

                    if (parentProfileIds.size > 0) {
                        // 2. Resolve institution UUID for notification (notifications table typically uses UUID)
                        const { data: instData } = await supabase
                            .from('institutions')
                            .select('id')
                            .or(`institution_id.eq.${user.institutionId},id.eq.${user.institutionId}`)
                            .maybeSingle();

                        // 3. Insert notification for each parent
                        const instIdToUse = instData?.id || user.institutionId; // Fallback to user.institutionId if UUID not found
                        const billDetails = manualFeeComponents.map(c => `${c.title}: ₹${c.amount}`).join(', ');
                        const notificationEntries = Array.from(parentProfileIds).map(pid => ({
                            user_id: pid,
                            institution_id: instIdToUse,
                            title: 'New Fee Bill Generated',
                            message: `A new manual bill of ₹${totalAmount.toLocaleString()} has been generated for ${studentInfo.name}. Details: ${billDetails}`,
                            type: 'fees', // Match app icon mapping
                            metadata: {
                                student_id: selectedStudent.id,
                                amount: totalAmount,
                                type: 'manual_bill'
                            }
                        }));

                        await supabase.from('notifications').insert(notificationEntries);
                        console.log(`[NOTIFICATION] Sent to ${parentProfileIds.size} parent(s) successfully`);
                    }
                }
            } catch (notifyErr) {
                console.warn('[NOTIFICATION] Failed to send notification:', notifyErr);
                // Don't fail the whole process if notification fails
            }

            toast.success("Manual bill generated successfully!");
            setOpenDialog('none');
            fetchStudents(); // Refresh data
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsManualBilling(false);
        }
    };

    const handleViewStudents = () => {
        if (selectedClass && selectedSection) {
            setViewMode('students');
        }
    };

    const startSelection = () => {
        setIsSelectionStarted(true);
        setSelectedClass(null);
        setSelectedSection(null);
        setFilterStatus('All');
    };

    const resetSelection = () => {
        setIsSelectionStarted(false);
        setSelectedClass(null);
        setSelectedSection(null);
        setFilterStatus('All');
        setViewMode('tree');
    };

    // Helper Functions for Fee Components
    const addComponent = () => {
        setFeeComponents([...feeComponents, { id: Date.now().toString(), title: '', amount: '' }]);
    };

    const removeComponent = (id: string) => {
        if (feeComponents.length === 1) return;
        setFeeComponents(feeComponents.filter(c => c.id !== id));
    };

    const updateComponent = (id: string, field: keyof FeeComponent, value: string) => {
        setFeeComponents(feeComponents.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const calculateTotal = () => {
        return feeComponents.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    };

    const resetWizard = () => {
        setWizardStep(1);
        setBaseStructureId(null);
        setAssignedStudents([]);
        setCurrentEditingStudentId(null);
        setStructureName('');
        setDueDate('');
        setFeeComponents([{ id: '1', title: 'Tuition Fee', amount: '0' }]);
        setSelectedClassForFee('');
        setSelectedSectionForFee('');
        setAvailableSectionsForFee([]);
        setStudentsInClass([]);
    };

    const handleSaveBaseStructure = async () => {
        if (!user?.institutionId || !selectedClassForFee) {
            toast.error("Please select a class");
            return;
        }

        if (!structureName.trim()) {
            toast.error("Please enter a structure name");
            return;
        }

        setSaving(true);
        try {
            const totalAmount = calculateTotal();
            const componentsJson = JSON.stringify(feeComponents);

            const { data, error } = await supabase.from('fee_structures').insert([{
                institution_id: user.institutionId,
                name: structureName,
                amount: totalAmount,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                description: componentsJson
            }]).select().single();

            if (error) throw error;

            setBaseStructureId(data.id);
            toast.success("Base structure saved! Proceed to assign students.");

        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveStudentFee = async () => {
        if (!currentEditingStudentId || !baseStructureId || !user?.institutionId) return;

        setSaving(true);
        try {
            const totalAmount = calculateTotal();
            const componentsJson = JSON.stringify(feeComponents);

            const { error } = await supabase.from('student_fees').insert([{
                student_id: currentEditingStudentId,
                fee_structure_id: baseStructureId,
                institution_id: user.institutionId,
                amount_due: totalAmount,
                amount_paid: 0,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                status: 'pending',
                description: componentsJson
            }]);

            if (error) throw error;

            // Track this student
            const student = studentsInClass.find(s => s.id === currentEditingStudentId);
            setAssignedStudents([...assignedStudents, {
                studentId: currentEditingStudentId,
                studentName: student?.name || 'Unknown',
                components: [...feeComponents],
                total: totalAmount
            }]);

            toast.success("Student fee saved!");
            setCurrentEditingStudentId(null);
            // Reset fee components to base for next student
            // Re-fetch base from description of fee_structures
            const { data } = await supabase.from('fee_structures').select('description').eq('id', baseStructureId).single();
            if (data?.description) {
                setFeeComponents(JSON.parse(data.description));
            }

        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFinalSubmit = async () => {
        toast.success(`Fee structure finalized for ${assignedStudents.length} students!`);
        setOpenDialog('none');
        resetWizard();
    };





    return (
        <InstitutionLayout>
            <PageHeader
                title="Fee Management"
                actions={
                    <Button onClick={() => setOpenDialog('create_structure')} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create Fee Structure
                    </Button>
                }

            />

            <AdCard
                title="Secure Your Institution's Future"
                description="Explore prime real estate opportunities for campus expansion and staff housing near high-growth educational hubs."
                Icon={Home}
                iconBgColor="bg-gradient-to-tr from-institution to-indigo-600 text-white"
                badgeText="Growth Partner"
                variant="compact"
                className="mb-8"
            />

            {/* Statistics Section */}
            <div className="stats-grid mb-6 sm:mb-8">
                <div className="stat-card">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-success/10 rounded-lg text-success">
                            <IndianRupee className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Total Revenue (YTD)</span>
                    </div>
                    <span className="text-2xl font-bold">₹ {stats.revenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <IndianRupee className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Outstanding</span>
                    </div>
                    <span className="text-2xl font-bold">₹ {stats.outstanding.toLocaleString('en-IN')}</span>
                </div>
                {/* Add placeholders or remove extra div if not needed as stats-grid handles columns */}
            </div>

            {/* Main Interactive Area */}
            <div className="dashboard-card h-[calc(100dvh-220px)] min-h-[500px] overflow-hidden bg-card border shadow-sm relative flex flex-col">
                {viewMode === 'tree' ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="h-16 border-b flex items-center px-6 justify-between bg-card/50">
                            {isSelectionStarted ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
                                    <Button variant="ghost" size="sm" onClick={resetSelection} className="text-primary hover:text-primary/80 -ml-2 whitespace-nowrap">
                                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                                    </Button>
                                    <span className="text-border">|</span>
                                    {/* Mobile: Show simpler breadcrumb */}
                                    <div className="flex items-center">
                                        {selectedClass && (
                                            <Button variant="ghost" size="sm" className={cn("px-1 h-auto font-normal", !selectedSection && "font-bold text-foreground")} onClick={() => setSelectedSection(null)}>
                                                {selectedClass}
                                            </Button>
                                        )}
                                        {selectedSection && (
                                            <>
                                                <ChevronRight className="w-3 h-3 mx-1" />
                                                <span className="font-bold text-foreground">{selectedSection}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <h3 className="font-semibold">Quick Selection</h3>
                            )}
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            {!isSelectionStarted ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                        <School className="w-10 h-10 text-primary" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">Explore Fees</h2>
                                    <p className="text-muted-foreground mb-8 text-center max-w-sm">Select a class to view student fee details, payment status, and send reminders.</p>
                                    <Button
                                        size="lg"
                                        onClick={startSelection}
                                        className="h-14 px-10 text-lg rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                                    >
                                        Select Class <ChevronRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col lg:flex-row h-full divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                                    {/* Class Selection Column */}
                                    <div className={cn(
                                        "flex-1 min-w-[250px] max-w-full lg:max-w-sm flex flex-col bg-card/50 border-r border-border/50 animate-in slide-in-from-left-4 duration-300",
                                        selectedClass ? "hidden lg:flex" : "flex"
                                    )}>
                                        <div className="p-4 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-sm z-10">Select Class</div>
                                        <ScrollArea className="flex-1">
                                            <div className="p-2 space-y-1">
                                                {uniqueClasses.map((cls) => (
                                                    <Button
                                                        key={cls}
                                                        variant={selectedClass === cls ? "secondary" : "ghost"}
                                                        className={cn(
                                                            "w-full justify-between h-12 px-4 transition-all font-bold",
                                                            selectedClass === cls ? "bg-primary/10 text-primary" : "text-foreground hover:text-primary hover:bg-muted"
                                                        )}
                                                        onClick={() => handleClassSelect(cls)}
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <div className={cn("w-2 h-2 rounded-full", selectedClass === cls ? "bg-primary" : "bg-muted-foreground/30")} />
                                                            {cls}
                                                        </span>
                                                        {selectedClass === cls && <ChevronRight className="w-4 h-4 ml-2" />}
                                                    </Button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>

                                    {/* Section Selection Column */}
                                    <div className={cn(
                                        "flex-1 min-w-[250px] max-w-full lg:max-w-sm flex flex-col bg-card/50 border-r border-border/50 relative",
                                        (!selectedClass || selectedSection) ? "hidden lg:flex" : "flex"
                                    )}>
                                        {selectedClass ? (
                                            <div className="absolute inset-0 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                                                <div className="p-4 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-sm z-10 flex justify-between items-center">
                                                    Section
                                                    <Badge variant="outline" className="text-[10px] h-5">{selectedClass}</Badge>
                                                </div>
                                                <div className="p-4 grid grid-cols-1 gap-2">
                                                    {availableSections.map((sec) => (
                                                        <Button
                                                            key={sec}
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start h-14 px-4 text-base transition-all border-l-4",
                                                                selectedSection === sec
                                                                    ? "border-l-primary bg-primary/5 border-t-border border-r-border border-b-border"
                                                                    : "border-l-transparent hover:border-l-muted-foreground/50"
                                                            )}
                                                            onClick={() => handleSectionSelect(sec)}
                                                        >
                                                            <div className="flex items-center gap-4 w-full">
                                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors", selectedSection === sec ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{sec}</div>
                                                                <span className={cn(selectedSection === sec ? "font-semibold" : "font-normal")}>Section {sec}</span>
                                                                {selectedSection === sec && <Check className="w-4 h-4 ml-auto text-primary" />}
                                                            </div>
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 p-8 text-center hidden lg:flex">
                                                <Layers className="w-12 h-12 mb-4 opacity-20" />
                                                <p>Select a class to view sections</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Summary / Action Column */}
                                    <div className={cn(
                                        "flex-[2] flex flex-col bg-muted/10 relative",
                                        !selectedSection ? "hidden lg:flex" : "flex"
                                    )}>
                                        {selectedSection ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-in zoom-in-95 fade-in duration-500 text-center">
                                                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                                    <GraduationCap className="w-12 h-12 text-primary" />
                                                </div>
                                                <h3 className="text-2xl font-bold mb-2">{selectedClass} - Section {selectedSection}</h3>
                                                <p className="text-muted-foreground mb-8 max-w-xs">Detailed student list, fee status, and individual actions available.</p>

                                                <Button
                                                    size="lg"
                                                    className="w-full max-w-xs h-12 text-lg shadow-lg"
                                                    onClick={handleViewStudents}
                                                >
                                                    View Students <ArrowRight className="ml-2 w-5 h-5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 p-8 text-center hidden lg:flex">
                                                <Users className="w-16 h-16 mb-4 opacity-20" />
                                                <p>{selectedClass ? "Select a section to proceed" : "Start by selecting a class"}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
                        <div className="h-16 border-b flex items-center px-6 gap-4 bg-card/50 flex-shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => setViewMode('tree')} className="hover:bg-muted">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">Students List <Badge variant="outline" className="ml-2">{selectedClass}-{selectedSection}</Badge></h2>
                            </div>
                            <div className="ml-auto w-[180px]">
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Students</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Due">Due</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Fee Structures for this Class */}
                        {students.length > 0 && students[0]?.fees?.classFeeStructures && students[0].fees.classFeeStructures.length > 0 && (
                            <div className="px-6 pt-4 pb-2">
                                <div className="bg-muted/30 border border-primary/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FileText className="w-4 h-4 text-primary" />
                                        <h3 className="font-semibold text-sm">Fee Structures for {selectedClass} - Section {selectedSection}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {students[0].fees.classFeeStructures.map((feeStructure: any) => (
                                            <div key={feeStructure.id} className="bg-card border rounded-lg p-3 hover:border-primary/50 transition-colors">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-sm">{feeStructure.name}</h4>
                                                        {feeStructure.due_date && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Due: {new Date(feeStructure.due_date).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Badge variant="outline" className="ml-2">
                                                        ₹{Number(feeStructure.amount).toLocaleString()}
                                                    </Badge>
                                                </div>
                                                {feeStructure.class_id ? (
                                                    <Badge variant="default" className="text-[10px] h-5">Class Specific</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] h-5">General</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <ScrollArea className="flex-1 p-6">
                            {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div> :
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                    {students.filter(student => filterStatus === 'All' ? true : student.fees.status === filterStatus).map((student) => (
                                        <div key={student.id} className="group relative border rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all bg-card/50">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-muted overflow-hidden border-2 border-transparent group-hover:border-primary transition-colors">
                                                        <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold group-hover:text-primary transition-colors">{student.name}</h3>
                                                        <p className="text-xs text-muted-foreground">Roll: {student.rollNo}</p>
                                                        {student.fees.status === 'Due' && (
                                                            <p className="text-xs text-destructive font-medium mt-0.5">Due: {student.fees.dueDate}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge variant={student.fees.status === 'Paid' ? 'success' : student.fees.status === 'Pending' ? 'warning' : 'destructive'} className="uppercase text-[10px]">{student.fees.status}</Badge>
                                            </div>

                                            <div className="flex items-center gap-2 mt-4">
                                                {/* Actions */}
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1 gap-2 text-xs h-9"
                                                    onClick={() => handleViewDetails(student)}
                                                >
                                                    Details
                                                </Button>

                                                {student.fees.status === 'Paid' ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 gap-2 text-xs h-9"
                                                            variant="default"
                                                            onClick={() => handleViewFees(student)}
                                                        >
                                                            Fees
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-9 w-9 p-0 border-primary/20 text-primary hover:bg-primary/5"
                                                            onClick={() => handleSendReceipt(student)}
                                                            title="Send Receipt"
                                                        >
                                                            <Send className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 gap-2 text-xs h-9"
                                                            variant="default"
                                                            onClick={() => handleViewFees(student)}
                                                        >
                                                            Fees
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-9 w-9 p-0 bg-orange-500 hover:bg-orange-600 text-white"
                                                            onClick={() => handleSendMessage(student)}
                                                            title="Send Reminder"
                                                        >
                                                            <Send className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-9 gap-1 text-[10px] sm:text-xs font-semibold border-orange-200 text-orange-600 hover:bg-orange-50"
                                                            onClick={() => handleManualBill(student)}
                                                        >
                                                            <Plus className="w-3 h-3" /> Bill
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {students.length === 0 && <div className="col-span-3 text-center text-muted-foreground py-10">No students found in this section or no fee data tracked yet.</div>}
                                </div>
                            }
                        </ScrollArea>
                    </div>
                )}
            </div>



            {/* Create Fee Structure Dialog (Enhanced) */}
            <Dialog open={openDialog === 'create_structure'} onOpenChange={(open) => {
                if (!open) {
                    setOpenDialog('none');
                    resetWizard();
                }
            }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {wizardStep === 1 && 'Create Fee Structure - Base Setup'}
                            {wizardStep === 2 && 'Assign Fees to Students'}
                            {wizardStep === 3 && 'Review & Submit'}
                        </DialogTitle>
                        <DialogDescription>
                            {wizardStep === 1 && 'Step 1: Define base fee structure for the class'}
                            {wizardStep === 2 && `Step 2: Assign fees to students in ${selectedClassForFee}${selectedSectionForFee ? ` ${selectedSectionForFee}` : ''}`}
                            {wizardStep === 3 && 'Step 3: Review all configured fees before submitting'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {/* STEP 1: Base Structure */}
                        {wizardStep === 1 && (
                            <>
                                <div className="grid gap-2">
                                    <Label>Select Class *</Label>
                                    <Select value={selectedClassForFee} onValueChange={async (val) => {
                                        setSelectedClassForFee(val);
                                        setSelectedSectionForFee(''); // Reset section
                                        setStudentsInClass([]); // Reset students
                                        setStructureName(`${val} Fee Structure`);

                                        // Fetch available sections for this class
                                        if (user?.institutionId) {
                                            const { data: sectionsData, error } = await supabase
                                                .from('students')
                                                .select('section')
                                                .eq('institution_id', user.institutionId)
                                                .eq('class_name', val);

                                            console.log('Sections query result:', sectionsData, error);

                                            if (sectionsData && !error) {
                                                // Extract unique, non-empty sections and sort them
                                                const uniqueSections = [...new Set(
                                                    sectionsData
                                                        .map(s => s.section)
                                                        .filter(s => s && s.trim() !== '') // Remove nulls and empty strings
                                                )].sort((a, b) => a.localeCompare(b)) as string[]; // Sort alphabetically

                                                console.log(`Found ${uniqueSections.length} sections for ${val}:`, uniqueSections);
                                                setAvailableSectionsForFee(uniqueSections);
                                            } else {
                                                console.error('Error fetching sections:', error);
                                                setAvailableSectionsForFee([]);
                                            }
                                        }
                                    }} disabled={!!baseStructureId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a class..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniqueClasses.length === 0 ? (
                                                <SelectItem value="__none__" disabled>No classes found</SelectItem>
                                            ) : (
                                                uniqueClasses.map((className) => (
                                                    <SelectItem key={className} value={className}>
                                                        {className}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Section Selection (shows after class is selected) */}
                                {selectedClassForFee && (
                                    <div className="grid gap-2">
                                        <Label>Select Section *</Label>
                                        <Select value={selectedSectionForFee} onValueChange={async (val) => {
                                            setSelectedSectionForFee(val);
                                            setStructureName(`${selectedClassForFee} ${val} Fee Structure`);

                                            // Fetch students for this specific class and section
                                            if (user?.institutionId && selectedClassForFee) {
                                                const { data, error } = await supabase
                                                    .from('students')
                                                    .select('id, name, register_number, section')
                                                    .eq('institution_id', user.institutionId)
                                                    .eq('class_name', selectedClassForFee)
                                                    .eq('section', val);

                                                if (!error && data) {
                                                    setStudentsInClass(data);
                                                    console.log(`Fetched ${data.length} students for ${selectedClassForFee} ${val}`);
                                                } else {
                                                    console.error('Error fetching students:', error);
                                                    setStudentsInClass([]);
                                                }
                                            }
                                        }} disabled={!!baseStructureId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a section..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSectionsForFee.length === 0 ? (
                                                    <SelectItem value="__none__" disabled>No sections found</SelectItem>
                                                ) : (
                                                    availableSectionsForFee.map((section) => (
                                                        <SelectItem key={section} value={section}>
                                                            Section {section}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Structure Name *</Label>
                                        <Input
                                            value={structureName}
                                            onChange={(e) => setStructureName(e.target.value)}
                                            placeholder="e.g. Annual Fees 2026"
                                            disabled={!!baseStructureId}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Due Date</Label>
                                        <Input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            disabled={!!baseStructureId}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <Label className="text-base font-semibold">Fee Breakdown</Label>
                                        <Badge variant="outline">Total: ₹{calculateTotal().toLocaleString()}</Badge>
                                    </div>

                                    {feeComponents.map((comp) => (
                                        <div key={comp.id} className="grid grid-cols-12 gap-2 hover:bg-muted/50 p-2 rounded-md items-end">
                                            <div className="col-span-12 md:col-span-7 space-y-1">
                                                <Label className="text-xs text-muted-foreground">Title</Label>
                                                <Input
                                                    value={comp.title}
                                                    onChange={(e) => updateComponent(comp.id, 'title', e.target.value)}
                                                    placeholder="Component Name"
                                                    disabled={!!baseStructureId}
                                                />
                                            </div>
                                            <div className="col-span-10 md:col-span-4 space-y-1">
                                                <Label className="text-xs text-muted-foreground">Amount</Label>
                                                <Input
                                                    type="number"
                                                    value={comp.amount}
                                                    onChange={(e) => updateComponent(comp.id, 'amount', e.target.value)}
                                                    placeholder="0.00"
                                                    disabled={!!baseStructureId}
                                                />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeComponent(comp.id)}
                                                    disabled={feeComponents.length === 1 || !!baseStructureId}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {!baseStructureId && (
                                        <div className="pt-2">
                                            <Button onClick={addComponent} variant="outline" size="sm" className="w-full border-dashed">
                                                <Plus className="w-4 h-4 mr-2" /> Add Component
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* STEP 2: Student Assignment */}
                        {wizardStep === 2 && (
                            <>
                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm">Assigned: <strong>{assignedStudents.length}</strong> students | Remaining: <strong>{studentsInClass.length - assignedStudents.length}</strong></p>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Select Student</Label>
                                    <Select value={currentEditingStudentId || ''} onValueChange={(val) => setCurrentEditingStudentId(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a student..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {studentsInClass
                                                .filter(s => !assignedStudents.some(as => as.studentId === s.id))
                                                .map((student) => (
                                                    <SelectItem key={student.id} value={student.id}>
                                                        {student.name} ({student.register_number})
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {currentEditingStudentId && (
                                    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <Label className="text-base font-semibold">Fee Components for {studentsInClass.find(s => s.id === currentEditingStudentId)?.name}</Label>
                                            <Badge variant="outline">Total: ₹{calculateTotal().toLocaleString()}</Badge>
                                        </div>

                                        {feeComponents.map((comp) => (
                                            <div key={comp.id} className="grid grid-cols-12 gap-2 hover:bg-muted/50 p-2 rounded-md items-end">
                                                <div className="col-span-12 md:col-span-7 space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Title</Label>
                                                    <Input
                                                        value={comp.title}
                                                        onChange={(e) => updateComponent(comp.id, 'title', e.target.value)}
                                                        placeholder="Component Name"
                                                    />
                                                </div>
                                                <div className="col-span-10 md:col-span-4 space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Amount</Label>
                                                    <Input
                                                        type="number"
                                                        value={comp.amount}
                                                        onChange={(e) => updateComponent(comp.id, 'amount', e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="col-span-2 md:col-span-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => removeComponent(comp.id)}
                                                        disabled={feeComponents.length === 1}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="pt-2 flex gap-2">
                                            <Button onClick={addComponent} variant="outline" size="sm" className="flex-1 border-dashed">
                                                <Plus className="w-4 h-4 mr-2" /> Add Component
                                            </Button>
                                            <Button onClick={handleSaveStudentFee} disabled={saving} size="sm" className="flex-1">
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                Save Student Fee
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {assignedStudents.length > 0 && (
                                    <div className="mt-4">
                                        <Label className="text-sm font-semibold mb-2 block">Already Assigned:</Label>
                                        <div className="space-y-2">
                                            {assignedStudents.map((as) => (
                                                <div key={as.studentId} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                                                    <span className="text-sm">{as.studentName}</span>
                                                    <Badge variant="outline" className="text-green-700 dark:text-green-300">₹{as.total.toLocaleString()}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* STEP 3: Review */}
                        {wizardStep === 3 && (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <h4 className="font-semibold mb-2">Summary</h4>
                                    <p className="text-sm">Class: <strong>{selectedClassForFee}</strong></p>
                                    <p className="text-sm">Structure: <strong>{structureName}</strong></p>
                                    <p className="text-sm">Students Configured: <strong>{assignedStudents.length}</strong></p>
                                </div>

                                <div>
                                    <Label className="text-base font-semibold mb-3 block">Configured Students:</Label>
                                    {assignedStudents.map((as) => (
                                        <div key={as.studentId} className="mb-3 p-3 border rounded-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="font-medium">{as.studentName}</h5>
                                                <Badge>₹{as.total.toLocaleString()}</Badge>
                                            </div>
                                            <div className="text-xs space-y-1">
                                                {as.components.map((c, i) => (
                                                    <div key={i} className="flex justify-between">
                                                        <span className="text-muted-foreground">{c.title}</span>
                                                        <span>₹{parseFloat(c.amount).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex justify-between items-center">
                        <div className="text-lg font-bold mr-auto">
                            {wizardStep === 1 && `Total: ₹${calculateTotal().toLocaleString()}`}
                            {wizardStep === 2 && `${assignedStudents.length} assigned`}
                            {wizardStep === 3 && `Total: ${assignedStudents.length} students`}
                        </div>
                        <div className="flex gap-2">
                            {wizardStep > 1 && (
                                <Button variant="outline" onClick={() => setWizardStep((wizardStep - 1) as 1 | 2)}>
                                    Back
                                </Button>
                            )}
                            {wizardStep === 1 && !baseStructureId && (
                                <Button onClick={handleSaveBaseStructure} disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Save
                                </Button>
                            )}
                            {wizardStep === 1 && baseStructureId && (
                                <Button onClick={() => setWizardStep(2)} className="bg-green-600 hover:bg-green-700">
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                            {wizardStep === 2 && (
                                <Button onClick={() => setWizardStep(3)} disabled={assignedStudents.length === 0}>
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                            {wizardStep === 3 && (
                                <Button onClick={handleFinalSubmit} className="bg-green-600 hover:bg-green-700">
                                    Submit
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Student Details Dialog */}
            <Dialog open={openDialog === 'bio'} onOpenChange={(open) => !open && setOpenDialog('none')}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Student Details</DialogTitle>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center gap-4 mb-4">
                                <img src={selectedStudent.avatar} alt="Avatar" className="w-16 h-16 rounded-full bg-muted" />
                                <div>
                                    <h3 className="font-bold text-lg">{selectedStudent.name}</h3>
                                    <p className="text-sm text-muted-foreground">Roll No: {selectedStudent.rollNo}</p>
                                    <Badge variant="outline" className="mt-1">{selectedClass} - {selectedSection}</Badge>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block mb-1">Parent Name</span>
                                    <span className="font-medium">{selectedStudent.parentName}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block mb-1">Contact</span>
                                    <span className="font-medium">{selectedStudent.contact || selectedStudent.fees.status}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block mb-1">Address</span>
                                    <span className="font-medium">{selectedStudent.address || "No address provided"}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Fees Details Dialog */}
            <Dialog open={openDialog === 'fees'} onOpenChange={(open) => !open && setOpenDialog('none')}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fee Breakdown</DialogTitle>
                        <DialogDescription>Detailed fee status for {selectedStudent?.name}</DialogDescription>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="space-y-4 py-2">
                            <div className="p-4 bg-muted/20 rounded-lg flex justify-between items-center">
                                <span className="font-medium">Status</span>
                                <Badge variant={selectedStudent.fees.status === 'Paid' ? 'success' : 'warning'}>{selectedStudent.fees.status}</Badge>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fee Structure</h4>
                                {selectedStudent.fees.structure && selectedStudent.fees.structure.length > 0 ? (
                                    selectedStudent.fees.structure.map((f: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-sm p-2 border-b last:border-0 border-border/50">
                                            <span>{f.category}</span>
                                            <div className="text-right">
                                                <span className="block font-medium">Due: ₹{f.amount}</span>
                                                <span className="block text-xs text-muted-foreground">Paid: ₹{f.paid}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground italic">No fee structure details found.</div>
                                )}
                            </div>

                            <div className="flex justify-between items-center text-sm pt-4 border-t">
                                <span className="font-bold">Total Due</span>
                                <span className="font-bold">₹{selectedStudent.fees.total}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold">Total Paid</span>
                                <span className="font-bold text-success">₹{selectedStudent.fees.paid}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold">Outstanding</span>
                                <span className="font-bold text-destructive">₹{selectedStudent.fees.pending}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Manual Billing Dialog */}
            <Dialog open={openDialog === 'manual_bill'} onOpenChange={(open) => !open && setOpenDialog('none')}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Generate Manual Bill</DialogTitle>
                        <DialogDescription>Create a custom fee for {selectedStudent?.name}</DialogDescription>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="space-y-6 py-4">
                            <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-xl">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {selectedStudent.name[0]}
                                </div>
                                <div>
                                    <h4 className="font-bold">{selectedStudent.name}</h4>
                                    <p className="text-xs text-muted-foreground">{selectedClass} - {selectedSection} • Roll: {selectedStudent.rollNo}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-base font-semibold">Fee Components</Label>
                                    <Button onClick={() => setManualFeeComponents([...manualFeeComponents, { id: Date.now().toString(), title: '', amount: '' }])} variant="outline" size="sm" className="gap-2">
                                        <Plus className="w-4 h-4" /> Add Line
                                    </Button>
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                    {manualFeeComponents.map((comp) => (
                                        <div key={comp.id} className="flex gap-3 items-end">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Description</Label>
                                                <Input
                                                    placeholder="e.g. Science Lab Fee"
                                                    value={comp.title}
                                                    onChange={(e) => setManualFeeComponents(manualFeeComponents.map(c => c.id === comp.id ? { ...c, title: e.target.value } : c))}
                                                />
                                            </div>
                                            <div className="w-32 space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Amount (₹)</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={comp.amount}
                                                    onChange={(e) => setManualFeeComponents(manualFeeComponents.map(c => c.id === comp.id ? { ...c, amount: e.target.value } : c))}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive h-10 w-10"
                                                onClick={() => setManualFeeComponents(manualFeeComponents.filter(c => c.id !== comp.id))}
                                                disabled={manualFeeComponents.length === 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Input
                                        type="date"
                                        value={manualBillDueDate}
                                        onChange={(e) => setManualBillDueDate(e.target.value)}
                                    />
                                </div>
                                <div className="bg-primary/5 rounded-xl p-4 flex flex-col justify-center items-end">
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">Total Bill Amount</span>
                                    <span className="text-2xl font-bold text-primary">₹{manualFeeComponents.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenDialog('none')}>Cancel</Button>
                        <Button onClick={handleSaveManualBill} disabled={isManualBilling} className="min-w-[120px]">
                            {isManualBilling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Generate Bill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invoice View Dialog (Upgraded Receipt) */}
            <Dialog open={openDialog === 'receipt'} onOpenChange={(open) => !open && setOpenDialog('none')}>
                <DialogContent className="max-w-2xl bg-white text-black p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    {selectedStudent && (
                        <InvoiceView
                            student={selectedStudent}
                            institution={{
                                name: institutionInfo?.name || 'VidyOn Institution',
                                logo_url: institutionInfo?.logo_url,
                                address: institutionInfo?.address,
                                city: institutionInfo?.city,
                                email: institutionInfo?.email,
                                phone: institutionInfo?.phone
                            }}
                            classInfo={{
                                className: selectedClass,
                                section: selectedSection
                            }}
                            onDownload={handleDownloadReceipt}
                            onClose={() => setOpenDialog('none')}
                        />
                    )}
                </DialogContent>
            </Dialog>

        </InstitutionLayout >
    );
}
