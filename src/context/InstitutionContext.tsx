import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Type definitions
export interface StaffMember {
    id: string;
    name: string;
    classes: string[];
}

export interface Subject {
    id: string;
    name: string;
    code?: string;
    department?: string;
    staff: StaffMember[];
}

// Assignments structure: ClassID (UUID) -> Section (String) -> SubjectID (UUID) -> List of Staff IDs
type AssignmentsMap = Record<string, Record<string, Record<string, string[]>>>;
// Class Teacher structure: ClassID (UUID) -> Section (String) -> TeacherID
type ClassTeacherMap = Record<string, Record<string, string>>;

export interface InstitutionContextType {
    subjects: Subject[];
    allSubjects: { id: string; name: string; code?: string; department?: string; class_name?: string }[];
    allStaffMembers: { id: string; name: string; department?: string }[];
    allClasses: { id: string; name: string; section: string }[];

    getAssignedStaff: (classId: string, section: string, subjectId: string) => { id: string; name: string }[];
    assignStaff: (classId: string, section: string, subjectId: string, staffIds: string[]) => Promise<void>;

    getClassTeacher: (classId: string, section: string) => string | undefined;
    assignClassTeacher: (classId: string, section: string, teacherId: string) => Promise<void>;
    classTeachers: ClassTeacherMap;

    // Legacy/Deprecated compatibility
    addStaffToSubject: (subjectId: string, staff: StaffMember) => void;
    removeStaffFromSubject: (subjectId: string, staffId: string) => void;
    refreshData: () => Promise<void>;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState<AssignmentsMap>({});
    const [classTeachers, setClassTeachers] = useState<ClassTeacherMap>({});
    const [allSubjectsList, setAllSubjectsList] = useState<{ id: string; name: string; code?: string; department?: string; class_name?: string }[]>([]);
    const [allStaffMembers, setAllStaffMembers] = useState<{ id: string; name: string; department?: string }[]>([]);
    const [allClasses, setAllClasses] = useState<{ id: string; name: string; section: string }[]>([]);
    const [loading, setLoading] = useState(true);

    const institutionId = user?.institutionId;

    const fetchData = useCallback(async () => {
        if (!institutionId) return;
        setLoading(true);

        // Mock Data Bypass
        if (user?.id.startsWith('MOCK_')) {
            console.log('[INSTITUTION_CONTEXT] Using mock data');
            const mockClasses = [
                { id: 'C1', name: 'LKG', section: 'A' },
                { id: 'C2', name: 'UKG', section: 'A' },
                { id: 'C3', name: 'Grade 1', section: 'A' },
                { id: 'C4', name: 'Grade 2', section: 'A' },
                { id: 'C5', name: 'Grade 3', section: 'A' },
                { id: 'C6', name: 'Grade 4', section: 'A' },
                { id: 'C7', name: 'Grade 5', section: 'A' },
                { id: 'C8', name: 'Grade 6', section: 'A' },
                { id: 'C9', name: 'Grade 7', section: 'A' },
                { id: 'C10', name: 'Grade 8', section: 'A' },
                { id: 'C11', name: 'Grade 9', section: 'A' },
                { id: 'C12', name: 'Grade 10', section: 'A' },
                { id: 'C13', name: 'Grade 11', section: 'A' },
                { id: 'C14', name: 'Grade 12', section: 'A' },
            ];
            setAllClasses(mockClasses);
            setAllStaffMembers([
                { id: 'T1', name: 'Mr. Teacher', department: 'Primary' }
            ]);
            setAllSubjectsList([
                { id: 'SB1', name: 'Math', department: 'Science' }
            ]);
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Subjects
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('*')
                .eq('institution_id', institutionId)
                .order('name');
            setAllSubjectsList(subjectsData || []);

            // 2. Fetch Staff via staff_details (source of truth for institutional link)
            // Joined with profiles for basic user info
            const { data: staffRecords, error: staffError } = await supabase
                .from('staff_details')
                .select(`
                    profile_id,
                    department,
                    role,
                    profiles:profile_id (
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('institution_id', institutionId);

            if (staffError) {
                console.error("InstitutionContext: Error fetching staff from staff_details:", staffError);
            }

            console.log(`InstitutionContext: Found ${staffRecords?.length || 0} total staff records in staff_details`);

            // Permitted roles for assignment - expanded list
            const targetRoles = ['faculty', 'teacher', 'admin', 'support', 'institution', 'accountant', 'canteen_manager', 'staff'];

            const filteredStaff = (staffRecords || [])
                .filter((record: any) => {
                    // Use role from staff_details if available, fallback to profile role
                    const role = record.role || record.profiles?.role;
                    if (!role) return false;
                    return targetRoles.some(r => r.toLowerCase() === role.toLowerCase());
                })
                .map((record: any) => ({
                    id: record.profile_id,
                    name: record.profiles?.full_name || 'Unknown',
                    department: record.department || null
                }));

            console.log(`InstitutionContext: Filtered to ${filteredStaff.length} staff members using roles:`, targetRoles);
            setAllStaffMembers(filteredStaff);

            // 3. Fetch Classes (for Class Teachers and structure)
            // 3. Fetch Classes (via Groups to ensure correct path)
            // The classes table doesn't strictly have institution_id populated in all code paths (like AddInstitution)
            // and uses 'sections' (array) not 'section' (string).
            let fetchedClasses: { id: string; name: string; section: string; classTeacherId?: string }[] = [];

            try {
                const { data: groupsData, error: groupsError } = await supabase
                    .from('groups')
                    .select('id, classes(id, name, sections, class_teacher_id)')
                    .eq('institution_id', institutionId);

                if (groupsError) throw groupsError;

                if (groupsData) {
                    groupsData.forEach(g => {
                        if (g.classes) {
                            (g.classes as any[]).forEach(c => {
                                const sections = Array.isArray(c.sections) ? c.sections : [c.sections]; // Handle array or single
                                sections.forEach((sec: string) => {
                                    if (sec) {
                                        fetchedClasses.push({
                                            id: c.id,
                                            name: c.name,
                                            section: sec,
                                            classTeacherId: c.class_teacher_id
                                        });
                                    }
                                });
                            });
                        }
                    });
                }
            } catch (err) {
                console.error("InstitutionContext: Error fetching classes via groups:", err);
            }

            console.log("InstitutionContext: Processed allClasses:", fetchedClasses);
            setAllClasses(fetchedClasses.map((c) => ({ id: c.id, name: c.name, section: c.section })));

            // Legacy Class Teacher logic removed in favor of faculty_subjects table
            // const newClassTeacherMap: ClassTeacherMap = {}; ...

            // 4. Fetch Assignments (Faculty Subjects) - Unified Table
            const { data: assignmentsData } = await supabase
                .from('faculty_subjects')
                .select('*')
                .eq('institution_id', institutionId);

            const newAssignments: AssignmentsMap = {};
            const newClassTeacherMap: ClassTeacherMap = {};

            assignmentsData?.forEach((a: any) => {
                // Initialize maps if needed
                if (!newAssignments[a.class_id]) newAssignments[a.class_id] = {};
                if (!newAssignments[a.class_id][a.section]) newAssignments[a.class_id][a.section] = {};

                if (!newClassTeacherMap[a.class_id]) newClassTeacherMap[a.class_id] = {};

                // Logic based on assignment_type
                // 'class_teacher' -> goes to ClassTeacherMap
                // 'subject_staff' -> goes to AssignmentsMap

                if (a.assignment_type === 'class_teacher') {
                    newClassTeacherMap[a.class_id][a.section] = a.faculty_profile_id;
                } else {
                    // Default to subject_staff
                    if (!newAssignments[a.class_id][a.section][a.subject_id]) {
                        newAssignments[a.class_id][a.section][a.subject_id] = [];
                    }
                    newAssignments[a.class_id][a.section][a.subject_id].push(a.faculty_profile_id);
                }
            });

            // Merge with any legacy class_teacher_id from classes table if needed, or just overwrite
            // For now, we favor the faculty_subjects table as per new schema.
            setClassTeachers(newClassTeacherMap);
            setAssignments(newAssignments);

        } catch (error) {
            console.error("Error fetching institution data:", error);
            toast.error("Failed to load institution data");
        } finally {
            setLoading(false);
        }
    }, [institutionId]);

    useEffect(() => {
        fetchData();

        if (!institutionId) return;

        // Realtime Subscriptions
        const channel = supabase.channel('institution_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_subjects', filter: `institution_id=eq.${institutionId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, fetchData) // classes might not have institution_id directly
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects', filter: `institution_id=eq.${institutionId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_details', filter: `institution_id=eq.${institutionId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `institution_id=eq.${institutionId}` }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, institutionId]);

    // Derived State: subjects with populated staff
    // This maintains compatibility with the old "Subject" interface
    const subjects: Subject[] = allSubjectsList.map(sub => {
        // Collect all staff assigned to this subject across all classes
        const staffMap: Record<string, StaffMember> = {};

        Object.entries(assignments).forEach(([classId, sections]) => {
            Object.entries(sections).forEach(([sectionId, subjectAssignments]) => {
                const assignedStaffIds = subjectAssignments[sub.id];
                if (assignedStaffIds) {
                    assignedStaffIds.forEach(staffId => {
                        const staffInfo = allStaffMembers.find(s => s.id === staffId);
                        if (staffInfo) {
                            if (!staffMap[staffId]) {
                                staffMap[staffId] = { id: staffId, name: staffInfo.name, classes: [] };
                            }
                            // Find class name
                            const classInfo = allClasses.find(c => c.id === classId && c.section === sectionId);
                            const className = classInfo ? `${classInfo.name} - ${classInfo.section}` : `${classId} - ${sectionId}`;
                            staffMap[staffId].classes.push(className);
                        }
                    });
                }
            });
        });

        return {
            id: sub.id,
            name: sub.name,
            department: sub.department,
            staff: Object.values(staffMap)
        };
    });

    const getAssignedStaff = useCallback((classId: string, section: string, subjectId: string) => {
        if (!assignments[classId]?.[section]?.[subjectId]) return [];
        const staffIds = assignments[classId][section][subjectId];
        return staffIds.map(id => allStaffMembers.find(s => s.id === id)).filter(Boolean) as { id: string; name: string }[];
    }, [assignments, allStaffMembers]);

    const assignStaff = useCallback(async (classId: string, section: string, subjectId: string, staffIds: string[]) => {
        if (!institutionId) return;
        try {
            // Updated to use assignment_type approach
            // 1. Delete all 'subject_staff' for this subject/class/section
            const { error: deleteError } = await supabase
                .from('faculty_subjects')
                .delete()
                .match({
                    institution_id: institutionId,
                    class_id: classId,
                    section: section,
                    subject_id: subjectId,
                    assignment_type: 'subject_staff' // Critical!
                });

            if (deleteError) throw deleteError;

            // 2. Insert new
            if (staffIds.length > 0) {
                const toInsert = staffIds.map(fid => ({
                    institution_id: institutionId,
                    class_id: classId,
                    section: section,
                    subject_id: subjectId,
                    faculty_profile_id: fid,
                    assignment_type: 'subject_staff'
                }));
                const { error: insertError } = await supabase.from('faculty_subjects').insert(toInsert);
                if (insertError) throw insertError;

                // Send Notifications to newly assigned staff
                const subjectName = allSubjectsList.find(s => s.id === subjectId)?.name || 'Subject';
                const className = allClasses.find(c => c.id === classId && c.section === section)?.name || 'Class';

                // We should ideally diff with previous to filter only NEW assignments, but for now notifying current set is okay or simplified.
                // To be precise: notify all in staffIds.
                const notifications = staffIds.map(fid => ({
                    user_id: fid,
                    title: 'New Subject Assignment',
                    message: `You have been assigned to teach ${subjectName} for ${className} - Section ${section}.`,
                    type: 'system',
                    date: new Date().toISOString(),
                    read: false
                }));

                await supabase.from('notifications').insert(notifications);
            }

            console.log(`InstitutionContext: Staff assigned to subject ${subjectId}`);
        } catch (e: any) {
            console.error("Assign staff error:", e);
            throw e; // Throw so caller (like handleSave) can catch and show toast
        }
    }, [institutionId, allSubjectsList, allClasses]);

    const getClassTeacher = useCallback((classId: string, section: string) => {
        return classTeachers[classId]?.[section];
    }, [classTeachers]);

    const assignClassTeacher = useCallback(async (classId: string, section: string, teacherId: string) => {
        if (!institutionId) return;
        try {
            // Updated: Now writes to faculty_subjects with type 'class_teacher'

            // 1. Remove existing class teacher
            const { error: deleteError } = await supabase
                .from('faculty_subjects')
                .delete()
                .match({
                    institution_id: institutionId,
                    class_id: classId,
                    section: section,
                    assignment_type: 'class_teacher'
                });

            if (deleteError) throw deleteError;

            // 2. Insert new (if teacherId is provided - could be unassignment)
            if (teacherId) {
                const { error: insertError } = await supabase
                    .from('faculty_subjects')
                    .insert({
                        institution_id: institutionId,
                        class_id: classId,
                        section: section,
                        faculty_profile_id: teacherId,
                        assignment_type: 'class_teacher',
                        subject_id: null // Explicitly null for class teacher
                    });

                if (insertError) throw insertError;

                // Send Notification
                const className = allClasses.find(c => c.id === classId && c.section === section)?.name || 'Class';
                await supabase.from('notifications').insert({
                    user_id: teacherId,
                    title: 'Class Teacher Assignment',
                    message: `You have been assigned as the Class Teacher for ${className} - Section ${section}.`,
                    type: 'system',
                    date: new Date().toISOString(),
                    read: false
                });
            }

            // 3. Sync with classes table (Crucial for access control and legacy queries)
            // Even if unassigning (teacherId = ''), we set it to null
            const { error: updateError } = await supabase
                .from('classes')
                .update({ class_teacher_id: teacherId || null })
                .eq('id', classId);

            if (updateError) {
                console.error("InstitutionContext: Error syncing classes table:", updateError);
                // We don't throw yet, as faculty_subjects was updated. But it's an issue.
            }

            console.log(`InstitutionContext: Class teacher updated for ${classId}`);
        } catch (e: any) {
            console.error("Assign class teacher error:", e);
            throw e;
        }
    }, [institutionId, allClasses]);

    // Deprecated methods
    const addStaffToSubject = useCallback((subjectId: string, staff: StaffMember) => {
        console.warn("addStaffToSubject is deprecated.");
    }, []);

    const removeStaffFromSubject = useCallback((subjectId: string, staffId: string) => {
        console.warn("removeStaffFromSubject is deprecated.");
    }, []);

    const refreshData = async () => {
        await fetchData();
    };

    return (
        <InstitutionContext.Provider value={{
            subjects,
            allSubjects: allSubjectsList,
            allStaffMembers,
            allClasses,
            getAssignedStaff,
            assignStaff,
            getClassTeacher,
            assignClassTeacher,
            classTeachers,
            addStaffToSubject,
            removeStaffFromSubject,
            refreshData
        }}>
            {children}
        </InstitutionContext.Provider>
    );
}

export function useInstitution() {
    const context = useContext(InstitutionContext);
    if (context === undefined) {
        throw new Error('useInstitution must be used within an InstitutionProvider');
    }
    return context;
}
