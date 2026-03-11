import { useState, useMemo } from 'react';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { BookOpen, Users, GraduationCap, LayoutGrid, List } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstitution } from '@/context/InstitutionContext';
import { Card } from "@/components/ui/card";

export function InstitutionDepartments() {
    const { subjects, classTeachers, allStaffMembers, allClasses } = useInstitution();
    const [viewMode, setViewMode] = useState<string>('subjects'); // 'subjects' | 'classes'
    const [selectedSubjectName, setSelectedSubjectName] = useState<string>('');

    // Unique subject names
    const uniqueSubjectNames = useMemo(() => {
        const names = subjects.map(s => s.name);
        return Array.from(new Set(names)).sort();
    }, [subjects]);

    // Select first subject name by default if not selected
    if (!selectedSubjectName && uniqueSubjectNames.length > 0) {
        setSelectedSubjectName(uniqueSubjectNames[0]);
    }

    // Aggregate staff for the selected subject name
    const aggregatedStaff = useMemo(() => {
        if (!selectedSubjectName) return [];

        const staffMap: Record<string, { id: string; name: string; classes: string[] }> = {};
        
        // Find all subjects that match this name
        const matchingSubjects = subjects.filter(s => s.name === selectedSubjectName);
        
        matchingSubjects.forEach(sub => {
            sub.staff.forEach(staff => {
                if (!staffMap[staff.id]) {
                    staffMap[staff.id] = { id: staff.id, name: staff.name, classes: [] };
                }
                // Merge classes ensuring uniqueness
                staff.classes.forEach(cls => {
                    if (!staffMap[staff.id].classes.includes(cls)) {
                        staffMap[staff.id].classes.push(cls);
                    }
                });
            });
        });

        return Object.values(staffMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedSubjectName, subjects]);

    // Derived list of class teachers
    const classTeacherList = [];
    if (viewMode === 'classes') {
        Object.entries(classTeachers).forEach(([classId, sections]) => {
            Object.entries(sections).forEach(([sectionId, teacherId]) => {
                const teacher = allStaffMembers.find(s => s.id === teacherId);
                const classInfo = allClasses.find(c => c.id === classId && c.section === sectionId);
                // Fallback to ID if name not found (though context should provide it)
                const className = classInfo ? `${classInfo.name} - ${classInfo.section}` : `${classId} - ${sectionId}`;

                if (teacher) {
                    classTeacherList.push({
                        classSection: className,
                        teacherName: teacher.name,
                        teacherId: teacher.id
                    });
                }
            });
        });
        // Sort by class name naturally if possible
        classTeacherList.sort((a, b) => a.classSection.localeCompare(b.classSection, undefined, { numeric: true, sensitivity: 'base' }));
    }

    return (
        <InstitutionLayout>
            <PageHeader
                title="Faculty Assignments"
                subtitle="View assigned staff members by subject or class"
            />

            {/* Toggle View Mode */}
            <div className="mb-6">
                <Tabs value={viewMode} onValueChange={setViewMode} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="subjects" className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            By Subject
                        </TabsTrigger>

                        <TabsTrigger value="classes" className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4" />
                            Class Teachers
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* SUBJECT VIEW */}
            {viewMode === 'subjects' && (
                <>
                    {/* Subject Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Select Subject</label>
                        <Select value={selectedSubjectName} onValueChange={setSelectedSubjectName}>
                            <SelectTrigger className="w-full max-w-md h-12 border-primary/30 bg-background shadow-sm hover:border-primary transition-all font-medium text-base">
                                <SelectValue placeholder="Choose a subject" />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueSubjectNames.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Staff Cards for Selected Subject */}
                    {selectedSubjectName && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <BookOpen className="w-5 h-5 text-institution" />
                                <h2 className="text-lg font-semibold">{selectedSubjectName} Teachers</h2>
                                <span className="text-sm text-muted-foreground ml-2">
                                    ({aggregatedStaff.length} staff members)
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {aggregatedStaff.map((staffMember) => (
                                    <div
                                        key={staffMember.id}
                                        className="dashboard-card p-5 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-institution/10 flex items-center justify-center flex-shrink-0">
                                                <Users className="w-6 h-6 text-institution" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-base truncate">
                                                    {staffMember.name}
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {selectedSubjectName} Teacher
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Assigned Classes:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {staffMember.classes.map((className, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                                                    >
                                                        {className}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 3. DEPARTMENT VIEW */}
            {viewMode === 'departments' && (
                <div>
                    {/* Department Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Select Department</label>
                        <Select value={selectedSubjectName} onValueChange={setSelectedSubjectName}>
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue placeholder="Choose a department" />
                            </SelectTrigger>
                            <SelectContent>
                                {(() => {
                                    const depts = Array.from(new Set(allStaffMembers.map(s => s.department).filter(Boolean))).sort();
                                    return depts.map(d => (
                                        <SelectItem key={d} value={d!}>{d}</SelectItem>
                                    ));
                                })()}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedSubjectName && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <LayoutGrid className="w-5 h-5 text-purple-600" />
                                <h2 className="text-lg font-semibold">{selectedSubjectName} Department</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {allStaffMembers.filter(s => s.department === selectedSubjectName).map(staff => {
                                    // Calculate assignments for this staff
                                    // We need to aggregate from 'subjects' (context props) or recreate logic.
                                    // 'subjects' const in this file comes from context, which returns Subject[]
                                    // Subject has staff[] which has classes[].

                                    const staffAssignments = new Set<string>();
                                    // Subject Assignments
                                    subjects.forEach(sub => {
                                        const subStaff = sub.staff.find(ss => ss.id === staff.id);
                                        if (subStaff) {
                                            subStaff.classes.forEach(c => staffAssignments.add(`${sub.name}: ${c}`));
                                        }
                                    });
                                    // Class Teacher Assignments
                                    Object.entries(classTeachers).forEach(([cId, sections]) => {
                                        Object.entries(sections).forEach(([sec, tId]) => {
                                            if (tId === staff.id) {
                                                const cObj = allClasses.find(c => c.id === cId && c.section === sec);
                                                staffAssignments.add(`Class Teacher: ${cObj ? cObj.name + ' ' + cObj.section : 'Unknown'}`);
                                            }
                                        });
                                    });

                                    return (
                                        <Card key={staff.id} className="p-5 hover:shadow-md transition-all border-l-4 border-l-purple-500">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                                    <Users className="w-5 h-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{staff.name}</h3>
                                                    <p className="text-xs text-muted-foreground">{staff.department}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <p className="text-xs font-medium text-muted-foreground uppercase">Assignments:</p>
                                                {staffAssignments.size === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic">No active assignments</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.from(staffAssignments).slice(0, 5).map((a, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full truncate max-w-[200px]" title={a}>
                                                                {a}
                                                            </span>
                                                        ))}
                                                        {staffAssignments.size > 5 && <span className="text-[10px] text-muted-foreground">+{staffAssignments.size - 5} more</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CLASS TEACHERS VIEW */}
            {viewMode === 'classes' && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Assigned Class Teachers</h2>
                        <span className="text-sm text-muted-foreground ml-2">
                            ({classTeacherList.length} classes assigned)
                        </span>
                    </div>

                    {classTeacherList.length === 0 ? (
                        <div className="p-8 border-2 border-dashed rounded-lg text-center bg-muted/20">
                            <p className="text-muted-foreground">No class teachers have been assigned yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {classTeacherList.map((item, idx) => (
                                <Card key={idx} className="p-5 hover:shadow-md transition-all border-l-4 border-l-primary/50">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">{item.classSection}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">Class Teacher</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <GraduationCap className="w-5 h-5 text-primary" />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <span className="font-medium text-gray-700">{item.teacherName}</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </InstitutionLayout>
    );
}
