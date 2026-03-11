import { useState, useMemo, useRef } from 'react';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { useInstitution } from '@/context/InstitutionContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    UserCheck,
    Plus,
    X,
    GraduationCap,
    Upload,
    FileText,
    Search,
    Users,
    BookOpen,
    Settings2,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/common/Badge';
import * as XLSX from 'xlsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// --- TYPES ---
interface StaffAssignment {
    id: string;
    staffName: string;
    staffId: string;
}

interface ClassSection {
    id: string;
    name: string;
    section: string;
}

// --- SUB-COMPONENTS ---

function AssignmentDialog({
    open,
    onOpenChange,
    classSection,
    allStaffMembers,
    allSubjects,
    getAssignedStaff,
    assignStaff,
    getClassTeacher,
    assignClassTeacher,
    classTeachers
}: any) {
    const [selectedClassTeacher, setSelectedClassTeacher] = useState<string>('');
    const [subjectAssignments, setSubjectAssignments] = useState<Record<string, StaffAssignment[]>>({});
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtered staff for Class Teacher: Only show those NOT assigned elsewhere
    const availableClassTeachers = useMemo(() => {
        const assignedElsewhere = new Set<string>();
        if (classTeachers) {
            Object.entries(classTeachers).forEach(([cId, sections]: [string, any]) => {
                Object.entries(sections).forEach(([sec, tId]: [string, any]) => {
                    // Skip the current class/section we are editing
                    if (cId === classSection?.id && sec === classSection?.section) return;
                    assignedElsewhere.add(tId);
                });
            });
        }
        return allStaffMembers.filter((s: any) => !assignedElsewhere.has(s.id));
    }, [allStaffMembers, classTeachers, classSection]);

    // Load initial data for subjects for this class when dialog opens
    const subjectsForClass = useMemo(() => {
        if (!classSection) return allSubjects;
        const filtered = allSubjects.filter((s: any) =>
            s.class_name && s.class_name.toLowerCase() === classSection.name.toLowerCase()
        );
        // Fallback to all subjects if none match (e.g. subjects without class_name set)
        return filtered.length > 0 ? filtered : allSubjects;
    }, [allSubjects, classSection]);

    useMemo(() => {
        if (open && classSection) {
            const ctId = getClassTeacher(classSection.id, classSection.section);
            setSelectedClassTeacher(ctId || 'unassigned');

            const initialMap: Record<string, StaffAssignment[]> = {};
            // Pre-load subjects that already have staff
            subjectsForClass.forEach((sub: any) => {
                const assigned = getAssignedStaff(classSection.id, classSection.section, sub.id);
                if (assigned.length > 0) {
                    initialMap[sub.id] = assigned.map((s: any) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        staffId: s.id,
                        staffName: s.name
                    }));
                }
            });
            setSubjectAssignments(initialMap);
        }
    }, [open, classSection, getClassTeacher, subjectsForClass]);

    const handleAddSubject = (subjectId: string) => {
        if (!subjectId || subjectId === 'placeholder') return;
        if (subjectAssignments[subjectId]) {
            toast.error("Subject already added");
            return;
        }
        setSubjectAssignments({
            ...subjectAssignments,
            [subjectId]: [{ id: Date.now().toString(), staffName: '', staffId: '' }]
        });
    };

    const handleRemoveStaff = (subjectId: string, id: string) => {
        const current = subjectAssignments[subjectId] || [];
        const filtered = current.filter(s => s.id !== id);

        if (filtered.length === 0) {
            const next = { ...subjectAssignments };
            delete next[subjectId];
            setSubjectAssignments(next);
        } else {
            setSubjectAssignments({ ...subjectAssignments, [subjectId]: filtered });
        }
    };

    const handleAddStaffToSubject = (subjectId: string) => {
        const current = subjectAssignments[subjectId] || [];
        setSubjectAssignments({
            ...subjectAssignments,
            [subjectId]: [...current, { id: Date.now().toString(), staffName: '', staffId: '' }]
        });
    };

    const handleStaffChange = (subjectId: string, id: string, staffId: string) => {
        const staff = allStaffMembers.find((s: any) => s.id === staffId);
        if (staff) {
            const updated = subjectAssignments[subjectId].map(s =>
                s.id === id ? { ...s, staffId: staff.id, staffName: staff.name } : s
            );
            setSubjectAssignments({ ...subjectAssignments, [subjectId]: updated });
        }
    };

    const handleSave = async () => {
        if (!classSection) return;
        setIsSaving(true);
        try {
            // 1. Save Class Teacher
            await assignClassTeacher(classSection.id, classSection.section, selectedClassTeacher === 'unassigned' ? '' : selectedClassTeacher);

            // 2. Save ALL subject assignments
            // We loop through all subjects to ensure deleted subjects are also wiped
            const promises = subjectsForClass.map(async (sub: any) => {
                const staffList = subjectAssignments[sub.id] || [];
                const ids = staffList.map(s => s.staffId).filter(Boolean);

                // assignStaff internally handles deleting existing and inserting new
                return assignStaff(classSection.id, classSection.section, sub.id, ids);
            });

            await Promise.all(promises);

            toast.success("All assignments updated successfully");
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkUpdate = (event: React.ChangeEvent<HTMLInputElement>, subjectId: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                const matches: StaffAssignment[] = [];
                const startRow = (jsonData[0]?.[0]?.toString().toLowerCase().includes('name') ||
                    jsonData[0]?.[0]?.toString().toLowerCase().includes('id')) ? 1 : 0;

                for (let i = startRow; i < jsonData.length; i++) {
                    const input = jsonData[i][0]?.toString().trim();
                    if (!input) continue;

                    const staff = allStaffMembers.find((s: any) =>
                        s.id.toLowerCase() === input.toLowerCase() ||
                        s.name.toLowerCase() === input.toLowerCase()
                    );

                    if (staff && !matches.some(m => m.staffId === staff.id)) {
                        matches.push({ id: (Date.now() + i).toString(), staffId: staff.id, staffName: staff.name });
                    }
                }
                const current = subjectAssignments[subjectId] || [];
                setSubjectAssignments({
                    ...subjectAssignments,
                    [subjectId]: [...current, ...matches]
                });
                toast.success(`Matched ${matches.length} staff members.`);
            } catch (err) {
                toast.error("Failed to parse file");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Settings2 className="w-6 h-6 text-primary" />
                        Manage Assignments: {classSection?.name} - {classSection?.section}
                    </DialogTitle>
                    <DialogDescription>Assign the class teacher and manage multiple subjects simultaneously.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Class Teacher Section */}
                    <section className="bg-primary/5 p-5 rounded-xl border border-primary/10 shadow-sm transition-all hover:shadow-md">
                        <Label className="text-sm font-bold mb-3 block flex items-center gap-2 text-primary">
                            <GraduationCap className="w-5 h-5" /> Class Teacher Assignment
                        </Label>
                        <Select value={selectedClassTeacher} onValueChange={setSelectedClassTeacher}>
                            <SelectTrigger className="bg-background h-11 border-primary/20 hover:border-primary transition-colors">
                                <SelectValue placeholder={allStaffMembers.length === 0 ? "Loading staff..." : "Select Class Teacher"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned" className="text-muted-foreground italic font-medium">No Class Teacher / Unassign</SelectItem>
                                {availableClassTeachers.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id} className="font-medium">{s.name}</SelectItem>
                                ))}
                                {allStaffMembers.length > 0 && availableClassTeachers.length === 0 && (
                                    <SelectItem value="none" disabled className="text-xs text-center py-4">
                                        All {allStaffMembers.length} staff members are already assigned to other classes.
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <p className="text-[10px] text-muted-foreground">
                                {allStaffMembers.length} staff profiles found.
                            </p>
                            {allStaffMembers.length - availableClassTeachers.length > 0 && (
                                <p className="text-[10px] text-destructive/70 font-medium">
                                    {allStaffMembers.length - availableClassTeachers.length} assigned elsewhere.
                                </p>
                            )}
                        </div>
                    </section>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed" /></div>
                        <div className="relative flex justify-center"><span className="bg-background px-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Subject Faculty</span></div>
                    </div>

                    {/* Multi-Subject List Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Label className="text-sm font-bold whitespace-nowrap">Add Subject:</Label>
                            <div className="flex-1">
                                <Select onValueChange={handleAddSubject}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select a subject to add..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="placeholder" disabled>Choose a subject</SelectItem>
                                        {subjectsForClass.map((sub: any) => (
                                            <SelectItem key={sub.id} value={sub.id} disabled={!!subjectAssignments[sub.id]}>
                                                {sub.name} {subjectAssignments[sub.id] ? '(Added)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {Object.keys(subjectAssignments).length === 0 ? (
                            <div className="text-center py-12 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/20">
                                <BookOpen className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No subjects added for this class yet.</p>
                                <p className="text-xs text-muted-foreground/60 italic">Start by picking a subject above.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 overflow-hidden">
                                {Object.entries(subjectAssignments).map(([subId, staff]) => {
                                    const subject = subjectsForClass.find((s: any) => s.id === subId);
                                    return (
                                        <div key={subId} className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 shadow-sm">
                                            <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                                                <div className="flex items-center gap-2 font-bold text-sm">
                                                    <Badge variant="outline" className="bg-white border-primary/20 text-primary uppercase">
                                                        {subject?.name}
                                                    </Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        id={`bulk-${subId}`}
                                                        onChange={(e) => handleBulkUpdate(e, subId)}
                                                        accept=".csv,.xlsx"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => document.getElementById(`bulk-${subId}`)?.click()}
                                                        className="h-7 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary transition-colors"
                                                    >
                                                        <Upload className="w-3 h-3" /> Bulk
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleAddStaffToSubject(subId)}
                                                        className="h-7 text-[10px] gap-1 font-bold"
                                                    >
                                                        <Plus className="w-3 h-3" /> Add Teacher
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-3 bg-gray-50/20">
                                                {staff.map((s) => (
                                                    <div key={s.id} className="flex item-center gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <div className="flex-1">
                                                            <Select value={s.staffId} onValueChange={(val) => handleStaffChange(subId, s.id, val)}>
                                                                <SelectTrigger className="h-9 bg-background border-muted hover:border-primary/30 transition-colors">
                                                                    <SelectValue placeholder="Select teacher" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {allStaffMembers.map((m: any) => (
                                                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveStaff(subId, s.id)}
                                                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg shrink-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-muted/10 border-t flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground italic font-medium">
                        Remember: One staff member can be Class Teacher only for one class.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="font-bold min-w-24" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="font-bold shadow-lg shadow-primary/20 min-w-32">
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Save All Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// --- MAIN PAGE ---

export function InstitutionFacultyAssigning() {
    const {
        allClasses,
        allSubjects,
        allStaffMembers,
        getAssignedStaff,
        assignStaff,
        getClassTeacher,
        assignClassTeacher,
        classTeachers
    } = useInstitution();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClassForEdit, setSelectedClassForEdit] = useState<ClassSection | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Group classes by name for hierarchical display
    const groupedClasses = useMemo(() => {
        const filtered = allClasses.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.section.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const groups: Record<string, typeof allClasses> = {};

        filtered.forEach(c => {
            if (!groups[c.name]) groups[c.name] = [];
            groups[c.name].push(c);
        });

        // Sort class names numerically/alphabetically
        return Object.entries(groups).sort((a, b) => {
            const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
            const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
            if (numA !== numB) return numA - numB;
            return a[0].localeCompare(b[0]);
        }).map(([name, sections]) => ({
            name,
            sections: sections.sort((a, b) => a.section.localeCompare(b.section))
        }));
    }, [allClasses, searchQuery]);

    const handleEditClick = (cls: ClassSection) => {
        setSelectedClassForEdit(cls);
        setIsDialogOpen(true);
    };

    return (
        <InstitutionLayout>
            <PageHeader
                title="Faculty Assigning"
                subtitle="Manage class teachers and subject faculty assignments"
            />

            <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search class or section..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Grid of Class Groups */}
                <div className="space-y-12">
                    {groupedClasses.length === 0 ? (
                        <div className="py-20 text-center bg-card rounded-2xl border border-dashed border-muted-foreground/20 shadow-sm">
                            <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground">No classes found</h3>
                            <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">Try adjusting your search to find the class or section you're looking for.</p>
                        </div>
                    ) : (
                        groupedClasses.map((group) => (
                            <div key={group.name} className="space-y-4">
                                {/* Class Header */}
                                <div className="flex items-center gap-3 px-1">
                                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                        <span className="font-bold text-lg">{group.name.replace(/\D/g, '') || group.name[0]}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold tracking-tight">{group.name}</h3>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{group.sections.length} {group.sections.length === 1 ? 'Section' : 'Sections'} Available</p>
                                    </div>
                                    <div className="flex-1 border-b border-dashed border-primary/20 ml-4"></div>
                                </div>

                                {/* Section Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {group.sections.map((cls) => {
                                        const ctId = getClassTeacher(cls.id, cls.section);
                                        const classTeacher = allStaffMembers.find(s => s.id === ctId);

                                        return (
                                            <div key={`${cls.id}-${cls.section}`} className="group relative bg-card hover:bg-muted/5 transition-all border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 border-primary/5 active:scale-[0.98]">
                                                <div className="p-5">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h4 className="font-bold text-lg leading-tight text-primary">Section {cls.section}</h4>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60 mt-0.5">{group.name}</p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditClick(cls)}
                                                            className="rounded-full hover:bg-primary/10 text-primary h-8 w-8"
                                                        >
                                                            <Settings2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {/* Class Teacher Indicator */}
                                                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 transition-colors group-hover:bg-primary/[0.08]">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <GraduationCap className="w-3.5 h-3.5 text-primary" />
                                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Class Teacher</span>
                                                            </div>
                                                            <span className="block text-sm font-semibold truncate">
                                                                {classTeacher ? classTeacher.name : <span className="text-muted-foreground/50 italic font-medium">Unassigned</span>}
                                                            </span>
                                                        </div>

                                                        {/* Subject Summary */}
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                const subjectsForThisClass = allSubjects.filter(s => 
                                                                    s.class_name && s.class_name.toLowerCase() === cls.name.toLowerCase()
                                                                );
                                                                const assignedSubjects = subjectsForThisClass.filter(s => 
                                                                    getAssignedStaff(cls.id, cls.section, s.id).length > 0
                                                                );
                                                                
                                                                return (
                                                                    <>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 opacity-70">
                                                                                <BookOpen className="w-3 h-3" /> Subject Staff
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded-full">
                                                                                {assignedSubjects.length} Assigned
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {assignedSubjects.slice(0, 3).map(sub => {
                                                                                const assigned = getAssignedStaff(cls.id, cls.section, sub.id);
                                                                                return (
                                                                                    <div key={sub.id} className="px-2 py-1 rounded-lg bg-background border text-[10px] shadow-sm flex items-center gap-1 group/chip hover:border-primary/30 transition-colors">
                                                                                        <span className="font-bold text-primary/60">{sub.name.substring(0, 3)}:</span>
                                                                                        <span className="font-medium">{assigned[0].name.split(' ')[0]}</span>
                                                                                        {assigned.length > 1 && <span className="text-primary/40">+{assigned.length - 1}</span>}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {assignedSubjects.length > 3 && (
                                                                                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                                                    +{assignedSubjects.length - 3}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="px-5 py-3 bg-muted/20 border-t flex justify-between items-center bg-gray-50/50">
                                                    <div className="flex -space-x-2">
                                                        {/* Multi-Teacher Avatar Stack Visualization */}
                                                        {[1, 2, 3].map((i) => (
                                                            <div key={i} className="w-7 h-7 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary animate-in fade-in zoom-in" style={{ animationDelay: `${i * 100}ms` }}>
                                                                <Users className="w-3 h-3" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEditClick(cls)}
                                                        className="h-8 text-[11px] font-bold hover:bg-primary hover:text-white transition-all shadow-sm border-primary/20 rounded-lg"
                                                    >
                                                        Details
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Assignment Dialog */}
            <AssignmentDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                classSection={selectedClassForEdit}
                allStaffMembers={allStaffMembers}
                allSubjects={allSubjects}
                getAssignedStaff={getAssignedStaff}
                assignStaff={assignStaff}
                getClassTeacher={getClassTeacher}
                assignClassTeacher={assignClassTeacher}
                classTeachers={classTeachers}
            />
        </InstitutionLayout>
    );
}
