import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useERPRealtime } from './useERPRealtime';
import { calculateWorkingDays, calculateAttendancePercentage } from '@/utils/attendanceUtils';

interface Child {
    id: string;
    name: string;
    class: string;
    section: string;
    rollNumber: string;
    classId: string;
    profilePicture?: string;
}

interface ParentDashboardStats {
    totalChildren: number;
    pendingLeaveRequests: number;
    upcomingEvents: number;
    totalPendingFees: number;
}

interface ChildAttendance {
    childId: string;
    childName: string;
    presentDays: number;
    totalDays: number;
    percentage: string;
}

interface LeaveRequest {
    id: string;
    childName: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
}

/**
 * Custom hook for parent dashboard data with real-time updates
 * Fetches:
 * - Children's data
 * - Attendance for all children
 * - Grades for all children
 * - Leave requests
 * - Fee payment status and raw records
 * - Real-time updates for all metrics
 */
export function useParentDashboard(parentId?: string, institutionId?: string) {
    const queryClient = useQueryClient();

    // 0. Resolve institution UUID from TEXT code if needed
    const { data: instUuid } = useQuery({
        queryKey: ['institution-uuid', institutionId],
        queryFn: async () => {
            if (!institutionId) return null;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionId)) {
                return institutionId;
            }
            const { data } = await supabase
                .from('institutions')
                .select('id')
                .eq('institution_id', institutionId)
                .maybeSingle();
            return data?.id || null;
        },
        enabled: !!institutionId,
        staleTime: 24 * 60 * 60 * 1000,
    });

    // 0.1 Fetch Institution Settings (Academic Year)
    const { data: institutionSettings } = useQuery({
        queryKey: ['institution-settings-full', instUuid],
        queryFn: async () => {
            if (!instUuid) return null;
            const { data } = await supabase
                .from('institutions')
                .select('*')
                .eq('id', instUuid)
                .single();
            return data;
        },
        enabled: !!instUuid,
        staleTime: 60 * 60 * 1000,
    });

    // 0.2 Fetch Holidays for attendance calculation
    const { data: holidays = [] } = useQuery({
        queryKey: ['institution-holidays', institutionId],
        queryFn: async () => {
            if (!institutionId) return [];
            const { data } = await supabase
                .from('academic_events')
                .select('start_date, end_date')
                .eq('institution_id', institutionId)
                .eq('event_type', 'holiday');

            const dates: string[] = [];
            data?.forEach(h => {
                const start = new Date(h.start_date);
                const end = new Date(h.end_date);
                const current = new Date(start);
                while (current <= end) {
                    dates.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }
            });
            return Array.from(new Set(dates));
        },
        enabled: !!instUuid,
        staleTime: 60 * 60 * 1000,
    });

    // 0.5 Fetch Announcements (Holiday Keywords)
    const { data: announcementHolidays = [] } = useQuery({
        queryKey: ['announcement-holidays', instUuid],
        queryFn: async () => {
            if (!instUuid) return [];

            const { data } = await supabase
                .from('announcements')
                .select('title, content, published_at')
                .eq('institution_id', institutionId)
                .or('title.ilike.%holiday%,title.ilike.%leave%,title.ilike.%closed%,title.ilike.%rain%,content.ilike.%holiday%');

            return (data || []).map(a => a.published_at.split('T')[0]);
        },
        enabled: !!instUuid,
        staleTime: 5 * 60 * 1000,
    });

    // 1. Fetch Children (Robust Lookup)
    const { data: children = [], isLoading: childrenLoading } = useQuery({
        queryKey: ['parent-children', parentId],
        queryFn: async () => {
            if (!parentId) return [];

            // A. Get Parent ID from profile mapping
            const { data: parentRecord } = await supabase
                .from('parents')
                .select('id')
                .eq('profile_id', parentId)
                .maybeSingle();

            // B. Fetch via Join Table (student_parents)
            let studentIds: string[] = [];
            if (parentRecord) {
                const { data: links } = await supabase
                    .from('student_parents')
                    .select('student_id')
                    .eq('parent_id', parentRecord.id);
                if (links) studentIds = links.map(l => l.student_id);
            }

            // C. Fetch via Direct Column (students.parent_id)
            const { data: directStudents } = await supabase
                .from('students')
                .select('id')
                .eq('parent_id', parentId);

            if (directStudents) {
                const directIds = directStudents.map(s => s.id);
                studentIds = Array.from(new Set([...studentIds, ...directIds]));
            }

            // D. Fallback: Lookup by parent email (highly reliable if other links missing)
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser?.email) {
                const { data: emailStudents } = await supabase
                    .from('students')
                    .select('id')
                    .ilike('parent_email', authUser.email.trim());

                if (emailStudents) {
                    const emailIds = emailStudents.map(s => s.id);
                    studentIds = Array.from(new Set([...studentIds, ...emailIds]));
                }
            }

            console.log(`[DEBUG] Parent ${parentId} found ${studentIds.length} children. Child IDs:`, studentIds);

            if (studentIds.length === 0) return [];

            // E. Get final details
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .in('id', studentIds);

            if (error) throw error;

            return (data || []).map((child: any) => ({
                id: child.id,
                name: child.name || 'Unknown Student',
                class: child.class_name || 'N/A',
                section: child.section || 'A',
                rollNumber: child.register_number || child.roll_number || 'N/A',
                classId: child.class_id,
                profilePicture: child.profile_picture || child.profile_image_url,
            })) as Child[];
        },
        enabled: !!parentId,
        staleTime: 5 * 60 * 1000,
    });

    const childIds = children.map(c => c.id);
    const uniqueClassIds = Array.from(new Set(children.map(c => c.classId).filter(id => !!id)));

    // 5. Fetch Special Classes (Pre-fetch for attendance calc)
    // Moved up to be available for attendance calculation
    const { data: specialClasses = [] } = useQuery({
        queryKey: ['parent-special-classes', uniqueClassIds],
        queryFn: async () => {
            if (uniqueClassIds.length === 0) return [];

            const { data, error } = await supabase
                .from('special_timetable_slots')
                .select(`
                    *,
                    subjects:subject_id (name),
                    profiles:faculty_id (full_name),
                    classes (name)
                `)
                .in('class_id', uniqueClassIds)
                .gte('event_date', new Date().toISOString().split('T')[0])
                .order('event_date');

            if (error) throw error;
            return data || [];
        },
        enabled: uniqueClassIds.length > 0,
    });

    // Also fetch ALL special dates for these classes (past included) for attendance calc
    const { data: allSpecialDates = [] } = useQuery({
        queryKey: ['parent-all-special-dates', uniqueClassIds],
        queryFn: async () => {
            if (uniqueClassIds.length === 0) return [];
            const { data } = await supabase
                .from('special_timetable_slots')
                .select('class_id, event_date') // Need class_id to map to student
                .in('class_id', uniqueClassIds);
            return data || [];
        },
        enabled: uniqueClassIds.length > 0
    });

    // 2. Fetch Attendance for all children
    const { data: childrenAttendance = [] } = useQuery({
        queryKey: ['parent-children-attendance', childIds, institutionSettings?.academic_year_start, allSpecialDates.length, announcementHolidays.length],
        queryFn: async () => {
            if (childIds.length === 0 || !institutionSettings?.academic_year_start) return [];

            const attendancePromises = children.map(async (child) => {
                // Determine Child's Specific Working Days
                const childSpecialDates = allSpecialDates
                    .filter(sd => sd.class_id === child.classId)
                    .map(sd => sd.event_date);

                const workingDays = calculateWorkingDays(
                    new Date(institutionSettings.academic_year_start),
                    new Date(),
                    holidays,
                    true,
                    childSpecialDates,
                    announcementHolidays
                );

                const { count, error } = await supabase
                    .from('student_attendance')
                    .select('*', { count: 'exact', head: true })
                    .eq('student_id', child.id)
                    .eq('status', 'present')
                    .gte('attendance_date', institutionSettings.academic_year_start);

                if (error) {
                    console.error(`Error fetching attendance for ${child.id}:`, error);
                    return { childId: child.id, childName: child.name, presentDays: 0, totalDays: workingDays, percentage: '0%' };
                }

                const presentDays = count || 0;

                return {
                    childId: child.id,
                    childName: child.name,
                    presentDays,
                    totalDays: workingDays,
                    percentage: calculateAttendancePercentage(presentDays, workingDays),
                };
            });

            return Promise.all(attendancePromises) as Promise<ChildAttendance[]>;
        },
        enabled: childIds.length > 0 && !!institutionSettings?.academic_year_start,
        staleTime: 2 * 60 * 1000,
    });

    // 4. Fetch Leave Requests (Unified Lookup)
    const { data: leaveRequests = [], isLoading: leaveLoading } = useQuery({
        queryKey: ['parent-leave-requests', childIds],
        queryFn: async () => {
            if (childIds.length === 0) return [];

            // Primary table is leave_requests (student_leave_requests does not exist in some builds)
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    students:student_id (name)
                `)
                .in('student_id', childIds)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            return (data || []).map((request: any) => ({
                id: request.id,
                childName: request.students?.name || 'Unknown',
                startDate: request.start_date || request.from_date,
                endDate: request.end_date || request.to_date,
                reason: request.reason,
                status: (request.status || 'pending').toLowerCase(),
            })) as LeaveRequest[];
        },
        enabled: childIds.length > 0,
        staleTime: 2 * 60 * 1000,
    });

    // 5. Fetch Fee Records
    const { data: feeRecords = [], isLoading: feesLoading } = useQuery({
        queryKey: ['parent-fee-records', childIds],
        queryFn: async () => {
            if (childIds.length === 0) return [];
            const { data, error } = await supabase
                .from('student_fees')
                .select(`
                    *,
                    students:student_id (id, name)
                `)
                .in('student_id', childIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: childIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    const feeData = {
        total: feeRecords.reduce((sum: number, fee: any) => sum + (fee.amount_due || 0), 0),
        paid: feeRecords.reduce((sum: number, fee: any) => sum + (fee.amount_paid || 0), 0),
        pending: feeRecords.reduce((sum: number, fee: any) => sum + ((fee.amount_due || 0) - (fee.amount_paid || 0)), 0),
    };

    // 6. Fetch Upcoming Events
    const { data: upcomingEventsCount = 0 } = useQuery({
        queryKey: ['parent-events', institutionId],
        queryFn: async () => {
            if (!institutionId) return 0;

            const today = new Date().toISOString().split('T')[0];

            const { count, error } = await supabase
                .from('academic_events')
                .select('id', { count: 'exact', head: true })
                .eq('institution_id', institutionId)
                .gte('event_date', today);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!instUuid,
        staleTime: 5 * 60 * 1000,
    });

    // 7. Calculate Dashboard Stats
    const stats: ParentDashboardStats = {
        totalChildren: children.length,
        pendingLeaveRequests: leaveRequests.filter(r => r.status === 'pending').length,
        upcomingEvents: upcomingEventsCount,
        totalPendingFees: feeData?.pending || 0,
    };

    // 8. Real-time Subscriptions (Migrated to SSE)
    useERPRealtime(institutionId);

    const isLoading = childrenLoading || feesLoading || leaveLoading;

    return {
        stats,
        children,
        childrenAttendance,
        leaveRequests,
        specialClasses,
        feeData,
        feeRecords,
        isLoading,
    };
}
