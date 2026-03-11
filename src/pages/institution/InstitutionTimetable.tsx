import { useState, useMemo, Fragment, useEffect } from 'react';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Loader from '@/components/common/Loader';
import {
    User,
    Search,
    ArrowLeft,
    Save,
    X,
    Settings2,
    Calendar as CalendarIcon,
    Clock,
    Plus,
    Filter,
    Trash2,
    Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/common/Badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface TimetableSlot {
    day_of_week: string;
    period_index: number;
    subject_id?: string;
    class_id?: string;
    section?: string;
    start_time: string;
    end_time: string;
    room_number?: string;
    is_break?: boolean;
    break_name?: string;
    // For display
    subject_name?: string;
    class_name?: string;
}

interface EditingSlot {
    day: string;
    period: number;
    data: Partial<TimetableSlot>;
}

export function InstitutionTimetable() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingSlot, setEditingSlot] = useState<EditingSlot | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [isSpecialMode, setIsSpecialMode] = useState(false);

    // Config State
    const [configData, setConfigData] = useState({
        periods_per_day: 8,
        period_duration_minutes: 45,
        buffer_time_minutes: 5,
        start_time: '09:00',
        lunch_start_time: '12:30',
        lunch_duration_minutes: 45,
        days_per_week: 6,
        short_break_start_time: '11:00',
        short_break_duration_minutes: 15,
        short_break_name: 'Short Break',
        extra_breaks: [] as { name: string; start_time: string; duration: number }[],
    });

    // Special Class State
    const [specialClassDate, setSpecialClassDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [selectedSection, setSelectedSection] = useState<string>('all');
    const [specialClassTitle, setSpecialClassTitle] = useState('');

    // Fetch all faculty members
    const { data: faculties = [], isLoading: isLoadingFaculty } = useQuery({
        queryKey: ['institution-faculty', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return [];

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('institution_id', user.institutionId)
                .eq('role', 'faculty')
                .order('full_name');

            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.institutionId,
    });

    // Fetch subjects
    const { data: subjects = [] } = useQuery({
        queryKey: ['institution-subjects', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return [];
            const { data, error } = await supabase
                .from('subjects')
                .select('id, name, class_name')
                .eq('institution_id', user.institutionId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.institutionId,
    });

    // Fetch classes (via Groups since institution_id is in groups)
    const { data: classesData = [] } = useQuery({
        queryKey: ['institution-classes', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return [];
            const { data, error } = await supabase
                .from('groups')
                .select('id, classes(id, name)')
                .eq('institution_id', user.institutionId);

            if (error) {
                console.error('Error fetching classes:', error);
                return [];
            }

            // Flatten classes from all groups
            const allFetchedClasses: any[] = [];
            data.forEach(g => {
                if (g.classes) {
                    (g.classes as any).forEach((c: any) => {
                        allFetchedClasses.push(c);
                    });
                }
            });
            return allFetchedClasses;
        },
        enabled: !!user?.institutionId,
    });

    // Simplified Unique Classes for dropdowns
    const uniqueClasses = useMemo(() => {
        const unique: any[] = [];
        classesData.forEach(c => {
            if (!unique.find(u => u.name === c.name)) {
                unique.push(c);
            }
        });

        // Custom sort function for educational order
        const classOrder = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

        return unique.sort((a, b) => {
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

            const normalizedA = normalizeClass(a.name);
            const normalizedB = normalizeClass(b.name);

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
            return a.name.localeCompare(b.name);
        });
    }, [classesData]);

    // Fetch faculty assignments (subjects, classes, sections)
    const { data: facultyAssignments = [] } = useQuery({
        queryKey: ['faculty-assignments', selectedFaculty?.id, user?.institutionId],
        queryFn: async () => {
            if (!selectedFaculty?.id || !user?.institutionId) return [];

            // Join with subjects to get subject name and class name
            const { data, error } = await supabase
                .from('faculty_subjects')
                .select(`
                    id,
                    subject_id,
                    class_id,
                    section,
                    faculty_profile_id,
                    assignment_type,
                    subjects (
                        id,
                        name,
                        class_name
                    )
                `)
                .eq('faculty_profile_id', selectedFaculty.id)
                .eq('institution_id', user.institutionId);

            if (error) {
                console.error('Error fetching faculty assignments:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!selectedFaculty?.id && !!user?.institutionId,
    });

    // Fetch current config
    const { data: currentConfig } = useQuery({
        queryKey: ['timetable-config', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return null;
            const { data, error } = await supabase
                .from('timetable_configs')
                .select('*')
                .eq('institution_id', user.institutionId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!user?.institutionId,
    });

    // Sync config state with fetched data
    useEffect(() => {
        if (currentConfig) {
            setConfigData({
                periods_per_day: currentConfig.periods_per_day,
                period_duration_minutes: currentConfig.period_duration_minutes,
                buffer_time_minutes: currentConfig.buffer_time_minutes || 5,
                start_time: currentConfig.start_time.substring(0, 5),
                lunch_start_time: currentConfig.lunch_start_time?.substring(0, 5) || '12:30',
                lunch_duration_minutes: currentConfig.lunch_duration_minutes || 45,
                days_per_week: currentConfig.days_per_week || 6,
                short_break_start_time: currentConfig.short_break_start_time?.substring(0, 5) || '11:00',
                short_break_duration_minutes: currentConfig.short_break_duration_minutes || 15,
                short_break_name: currentConfig.short_break_name || 'Short Break',
                extra_breaks: currentConfig.extra_breaks || [],
            });
        }
    }, [currentConfig]);

    // Fetch timetable for selected faculty
    const {
        data: facultyTimetable = [],
        isLoading: isLoadingTimetable,
        isError,
        error: queryError
    } = useQuery({
        queryKey: ['faculty-timetable', selectedFaculty?.id],
        queryFn: async () => {
            if (!selectedFaculty?.id) {
                return [];
            }

            const { data, error } = await supabase
                .from('timetable_slots')
                .select(`
                    *,
                    subjects (name),
                    classes (name)
                `)
                .eq('faculty_id', selectedFaculty.id)
                .order('day_of_week')
                .order('period_index');

            if (error) {
                console.error('[INSTITUTION] Error fetching timetable:', error);
                throw error;
            }

            return data || [];
        },
        enabled: !!selectedFaculty?.id,
        retry: 1,
    });

    // Fetch special slots for selected date/class
    const { data: specialSlots = [], isLoading: isLoadingSpecial } = useQuery({
        queryKey: ['special-slots', specialClassDate, selectedClassId, selectedSection],
        queryFn: async () => {
            if (!user?.institutionId || !isSpecialMode) return [];

            let query = supabase
                .from('special_timetable_slots')
                .select(`
                    *,
                    subjects (name),
                    profiles:faculty_id (full_name),
                    classes (name)
                `)
                .eq('event_date', specialClassDate)
                .eq('institution_id', user.institutionId);

            if (selectedClassId !== 'all') query = query.eq('class_id', selectedClassId);
            if (selectedSection !== 'all') query = query.eq('section', selectedSection);

            // If a faculty is selected, we should definitely show their slots even if they don't match class filters
            // but usually in "Special Classes" mode, class/section filters are for general overview.
            // When a specific faculty is selected, we should prioritize showing their assignments.
            if (selectedFaculty?.id && selectedClassId === 'all') {
                // If viewing a specific faculty and no class filter, don't restrict query
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.institutionId && isSpecialMode,
    });

    // Derived View Data
    const viewTimetableData = useMemo<{ [key: string]: TimetableSlot }>(() => {
        if (!selectedFaculty || !facultyTimetable) return {};
        const data: { [key: string]: TimetableSlot } = {};
        facultyTimetable.forEach((slot: any) => {
            const key = `${slot.day_of_week}-${slot.period_index}`;
            data[key] = {
                day_of_week: slot.day_of_week,
                period_index: slot.period_index,
                subject_id: slot.subject_id,
                class_id: slot.class_id,
                section: slot.section,
                start_time: slot.start_time,
                end_time: slot.end_time,
                room_number: slot.room_number,
                is_break: slot.is_break,
                break_name: slot.break_name,
                subject_name: slot.subjects?.name,
                class_name: slot.classes?.name,
            };
        });
        return data;
    }, [facultyTimetable, selectedFaculty]);

    // Save slot mutation
    const saveSlotMutation = useMutation({
        mutationFn: async () => {
            if (!editingSlot || !selectedFaculty?.id || !user?.institutionId) {
                console.error('[INSTITUTION] Missing required data:', {
                    hasEditingSlot: !!editingSlot,
                    hasFaculty: !!selectedFaculty?.id,
                    hasInstitution: !!user?.institutionId
                });
                throw new Error('Missing required data');
            }

            // Get or create config
            const { data: existingConfig } = await supabase
                .from('timetable_configs')
                .select('id')
                .eq('institution_id', user.institutionId)
                .limit(1)
                .single();

            let configId = existingConfig?.id;
            if (!configId) {
                const { data: newConfig } = await supabase
                    .from('timetable_configs')
                    .insert({
                        institution_id: user.institutionId,
                        periods_per_day: 8,
                        period_duration_minutes: 45,
                        start_time: '09:00',
                        short_break_start_time: '11:00',
                        short_break_duration_minutes: 15,
                        short_break_name: 'Short Break',
                    })
                    .select('id')
                    .single();
                configId = newConfig?.id;
            }

            // Delete existing slot for this day/period
            const { error: deleteError } = await supabase
                .from('timetable_slots')
                .delete()
                .eq('faculty_id', selectedFaculty.id)
                .eq('day_of_week', editingSlot.day)
                .eq('period_index', editingSlot.period);

            if (deleteError) {
                console.error('[INSTITUTION] Delete error:', deleteError);
            }

            // Insert new slot if subject is selected
            if (editingSlot.data.subject_id) {
                const slotData = {
                    config_id: configId,
                    faculty_id: selectedFaculty.id,
                    day_of_week: editingSlot.day,
                    period_index: editingSlot.period,
                    subject_id: editingSlot.data.subject_id,
                    class_id: editingSlot.data.class_id,
                    section: editingSlot.data.section,
                    start_time: editingSlot.data.start_time || '09:00',
                    end_time: editingSlot.data.end_time || '10:00',
                    room_number: editingSlot.data.room_number,
                    is_break: false,
                };

                const { data: insertedData, error: insertError } = await supabase
                    .from('timetable_slots')
                    .insert(slotData)
                    .select();

                if (insertError) {
                    console.error('[INSTITUTION] Insert error:', insertError);
                    throw insertError;
                }
            } else {
            }

            // Send notification to faculty
            try {
                await supabase.from('notifications').insert({
                    user_id: selectedFaculty.id,
                    title: 'Timetable Updated',
                    message: `Your timetable for ${editingSlot.day} Period ${editingSlot.period} has been updated.`,
                    type: 'timetable',
                    created_at: new Date().toISOString(),
                    read: false,
                });
            } catch (notifyError) {
                console.error('Failed to send notification:', notifyError);
                // Don't block the success of the timetable update if notification fails
            }
        },
        onSuccess: () => {
            toast.success('Slot saved successfully');
            // Invalidate and refetch the specific faculty's timetable
            queryClient.invalidateQueries({ queryKey: ['faculty-timetable', selectedFaculty?.id] });
            queryClient.refetchQueries({ queryKey: ['faculty-timetable', selectedFaculty?.id] });
            // Also invalidate the faculty's "My Schedule" view
            queryClient.invalidateQueries({ queryKey: ['faculty-my-schedule', selectedFaculty?.id] });
            setIsEditDialogOpen(false);
            setEditingSlot(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to save slot');
        },
    });

    // Save config mutation
    const saveConfigMutation = useMutation({
        mutationFn: async () => {
            if (!user?.institutionId) throw new Error('No institution ID');

            const { error } = await supabase
                .from('timetable_configs')
                .upsert({
                    institution_id: user.institutionId,
                    periods_per_day: configData.periods_per_day,
                    period_duration_minutes: configData.period_duration_minutes,
                    buffer_time_minutes: configData.buffer_time_minutes,
                    start_time: configData.start_time,
                    lunch_start_time: configData.lunch_start_time,
                    lunch_duration_minutes: configData.lunch_duration_minutes,
                    days_per_week: configData.days_per_week,
                    short_break_start_time: configData.short_break_start_time,
                    short_break_duration_minutes: configData.short_break_duration_minutes,
                    short_break_name: configData.short_break_name,
                    extra_breaks: configData.extra_breaks,
                }, { onConflict: 'institution_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Configuration saved');
            queryClient.invalidateQueries({ queryKey: ['timetable-config'] });
            setIsConfigDialogOpen(false);
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to save config');
        }
    });

    // Save special slot mutation
    const saveSpecialSlotMutation = useMutation({
        mutationFn: async () => {
            if (!editingSlot || !user?.institutionId || !isSpecialMode) throw new Error('Missing data');

            const slotData = {
                institution_id: user.institutionId,
                class_id: editingSlot.data.class_id,
                section: editingSlot.data.section,
                event_date: specialClassDate,
                subject_id: editingSlot.data.subject_id,
                faculty_id: selectedFaculty?.id, // Default to selected faculty if any
                start_time: editingSlot.data.start_time,
                end_time: editingSlot.data.end_time,
                room_number: editingSlot.data.room_number,
                title: specialClassTitle,
            };

            const { data: inserted, error } = await supabase
                .from('special_timetable_slots')
                .insert(slotData)
                .select()
                .single();

            if (error) throw error;

            // Send notification to faculty
            if (selectedFaculty?.id) {
                try {
                    await supabase.from('notifications').insert({
                        user_id: selectedFaculty.id,
                        title: 'Special Class Assigned',
                        message: `You have been assigned a special class: ${specialClassTitle || 'Special Event'} on ${specialClassDate} at ${editingSlot.data.start_time}.`,
                        type: 'timetable',
                        created_at: new Date().toISOString(),
                        read: false,
                        action_url: `/faculty/timetable?date=${specialClassDate}`
                    });
                } catch (notifyError) {
                    console.error('Failed to send notification to faculty:', notifyError);
                }
            }
        },
        onSuccess: () => {
            toast.success('Special class saved locally');
            queryClient.invalidateQueries({ queryKey: ['special-slots'] });
            setIsEditDialogOpen(false);
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to schedule special class');
        }
    });

    // Batch send notifications mutation
    const sendBatchNotificationMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFaculty?.id || !user?.institutionId || !specialClassDate) {
                throw new Error('Please select a faculty and date first');
            }

            // 1. Fetch current special slots for this faculty and date
            const { data: slots, error: slotsError } = await supabase
                .from('special_timetable_slots')
                .select(`
                    id, 
                    class_id, 
                    section, 
                    subject_id,
                    subjects (name)
                `)
                .eq('faculty_id', selectedFaculty.id)
                .eq('event_date', specialClassDate)
                .eq('institution_id', user.institutionId);

            if (slotsError) throw slotsError;
            if (!slots || slots.length === 0) {
                throw new Error('No special slots found for the selected faculty and date');
            }

            const notifications: any[] = [];
            const timestamp = new Date().toISOString();

            // 1. Notify Faculty (Redirection enabled)
            notifications.push({
                user_id: selectedFaculty.id,
                title: specialClassTitle || 'Special Timetable Scheduled',
                message: `You have a special timetable scheduled for ${specialClassDate}. ${specialClassTitle ? `Reason: ${specialClassTitle}` : ''}`,
                type: 'timetable',
                created_at: timestamp,
                read: false,
                action_url: `/faculty/timetable?date=${specialClassDate}`
            });

            // 2. Notify Students and Parents
            // Collect unique class+sections
            const classSections = new Map<string, string>(); // class_id -> name (we need name for student lookup)
            const uniqueCombos = new Set<string>(); // "class_id|section"

            slots.forEach(s => {
                uniqueCombos.add(`${s.class_id}|${s.section}`);
            });

            for (const combo of uniqueCombos) {
                const [cid, sec] = combo.split('|');
                const className = classesData.find(c => String(c.id) === String(cid))?.name;

                if (!className) continue;

                const { data: students } = await supabase
                    .from('students')
                    .select('id, parent_id')
                    .eq('class_name', className)
                    .eq('section', sec)
                    .eq('institution_id', user.institutionId);

                if (students && students.length > 0) {
                    students.forEach(s => {
                        // Student Notification (Redirection enabled)
                        notifications.push({
                            user_id: s.id,
                            title: specialClassTitle || 'Special Timetable Added',
                            message: `A special timetable has been added to your schedule for ${specialClassDate}.`,
                            type: 'timetable',
                            created_at: timestamp,
                            read: false,
                            action_url: `/student/timetable?date=${specialClassDate}`
                        });

                        // Parent Notification (NO Redirection)
                        if (s.parent_id) {
                            notifications.push({
                                user_id: s.parent_id,
                                title: `Special Timetable for your child`,
                                message: `A special timetable has been added for your child in ${className} - ${sec} on ${specialClassDate}.${specialClassTitle ? ` Reason: ${specialClassTitle}` : ''}`,
                                type: 'timetable',
                                created_at: timestamp,
                                read: false
                            });
                        }
                    });
                }
            }

            if (notifications.length > 0) {
                const { error: notifyError } = await supabase.from('notifications').insert(notifications);
                if (notifyError) throw notifyError;
            }
        },
        onSuccess: () => {
            toast.success('Batch notifications sent successfully to faculty, students and parents');
        },
        onError: (error: any) => {
            console.error('Batch notification error:', error);
            toast.error(error.message || 'Failed to send batch notifications');
        }
    });

    const calculatePeriodTimings = (periodIndex: number) => {
        const slots = calculateAllTimings();
        const slot = slots.find(s => s.type === 'period' && s.index === periodIndex);
        return slot ? { start: slot.start, end: slot.end } : { start: '--:--', end: '--:--' };
    };

    const getBreakAfterPeriod = (type: 'lunch' | 'short' | 'extra') => {
        const slots = calculateAllTimings();
        for (let i = 0; i < slots.length; i++) {
            if (slots[i].type === type && i > 0 && slots[i - 1].type === 'period') {
                return slots[i - 1].index || -1;
            }
        }
        return -1;
    };

    const calculateAllTimings = () => {
        const slots: { type: 'period' | 'lunch' | 'short' | 'extra'; index?: number; start: string; end: string; name?: string }[] = [];
        try {
            const [startH, startM] = configData.start_time.split(':').map(Number);
            let currentMinutes = startH * 60 + startM;

            const [lunchH, lunchM] = configData.lunch_start_time.split(':').map(Number);
            const lunchStart = lunchH * 60 + lunchM;
            const lunchDuration = configData.lunch_duration_minutes || 45;

            const [shortH, shortM] = configData.short_break_start_time.split(':').map(Number);
            const shortStart = shortH * 60 + shortM;
            const shortDuration = configData.short_break_duration_minutes || 15;

            const allBreaks = [
                { start: lunchStart, end: lunchStart + lunchDuration, type: 'lunch', name: 'Lunch Break' },
                { start: shortStart, end: shortStart + shortDuration, type: 'short', name: configData.short_break_name },
                ...(configData.extra_breaks || []).map(b => {
                    const [h, m] = b.start_time.split(':').map(Number);
                    return { start: h * 60 + m, end: (h * 60 + m) + b.duration, type: 'extra', name: b.name };
                })
            ].sort((a, b) => a.start - b.start);

            const formatTime = (mins: number) => {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const hh = h % 12 || 12;
                const period = h >= 12 ? 'PM' : 'AM';
                return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
            };

            const processedBreaks = new Set();

            for (let i = 1; i <= configData.periods_per_day; i++) {
                // 1. Process any break that should happen BEFORE this period
                for (const b of allBreaks) {
                    if (!processedBreaks.has(b.name) && currentMinutes >= b.start) {
                        slots.push({ type: b.type as any, start: formatTime(b.start), end: formatTime(b.end), name: b.name });
                        currentMinutes = Math.max(currentMinutes, b.end);
                        processedBreaks.add(b.name);
                    }
                }

                // 2. CHECK IF THIS PERIOD FITS BEFORE THE NEXT BREAK
                const nextBreak = allBreaks.find(b => !processedBreaks.has(b.name) && b.start > currentMinutes);

                if (nextBreak && (currentMinutes + configData.period_duration_minutes) > nextBreak.start) {
                    // RESOLUTION: Period overlaps break. Insert break first.
                    slots.push({ type: nextBreak.type as any, start: formatTime(nextBreak.start), end: formatTime(nextBreak.end), name: nextBreak.name });
                    currentMinutes = nextBreak.end;
                    processedBreaks.add(nextBreak.name);
                }

                // Start Period
                const periodStart = currentMinutes;
                const periodEnd = currentMinutes + configData.period_duration_minutes;
                slots.push({ type: 'period', index: i, start: formatTime(periodStart), end: formatTime(periodEnd) });

                currentMinutes = periodEnd;

                // 3. ADD BUFFER ONLY IF NO BREAK HEADS OFF THE BUFFER
                const imminentBreak = allBreaks.find(b => !processedBreaks.has(b.name));
                if (!imminentBreak || (currentMinutes + configData.buffer_time_minutes) <= imminentBreak.start) {
                    currentMinutes += configData.buffer_time_minutes;
                }
            }

            // Add any remaining breaks
            for (const b of allBreaks) {
                if (!processedBreaks.has(b.name)) {
                    slots.push({ type: b.type as any, start: formatTime(b.start), end: formatTime(b.end), name: b.name });
                }
            }
        } catch (e) {
            console.error("Timing calculation error:", e);
        }
        return slots;
    };

    const handleSlotClick = (day: string, period: number) => {
        const key = `${day}-${period}`;
        const existingSlot = viewTimetableData[key];

        const calculatedTimings = calculatePeriodTimings(period);

        setEditingSlot({
            day,
            period,
            data: {
                ...(existingSlot || {}),
                day_of_week: day,
                period_index: period,
                start_time: calculatedTimings.start,
                end_time: calculatedTimings.end,
            },
        });
        setIsEditDialogOpen(true);
    };

    const updateEditingSlot = (field: string, value: any) => {
        setEditingSlot(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                data: { ...prev.data, [field]: value },
            };
        });
    };

    // No longer using intentional delay for loader

    const filteredFaculties = faculties.filter((f: any) =>
        f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoadingFaculty) {
        return (
            <InstitutionLayout>
                <Loader fullScreen={false} />
            </InstitutionLayout>
        );
    }

    return (
        <InstitutionLayout>
            <PageHeader
                title="Faculty Timetable"
                subtitle="View and manage weekly schedules for faculty members"
                actions={
                    <div className="flex items-center gap-3">
                        {isSpecialMode && !selectedFaculty && (
                            <div className="flex items-center gap-2 mr-4 bg-muted/50 p-1.5 rounded-lg border shadow-sm">
                                <div className="flex items-center gap-1.5 px-2 border-r pr-3">
                                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        className="w-[130px] h-7 text-[11px] bg-background border-none focus-visible:ring-0 p-0"
                                        value={specialClassDate}
                                        onChange={(e) => setSpecialClassDate(e.target.value)}
                                    />
                                </div>
                                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                    <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background border-none focus-visible:ring-0">
                                        <SelectValue placeholder="Class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Classes</SelectItem>
                                        {uniqueClasses.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedSection} onValueChange={setSelectedSection}>
                                    <SelectTrigger className="w-[70px] h-7 text-[11px] bg-background border-none focus-visible:ring-0">
                                        <SelectValue placeholder="Sec" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="A">A</SelectItem>
                                        <SelectItem value="B">B</SelectItem>
                                        <SelectItem value="C">C</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {/* Always show date picker in special mode when faculty is selected, but not class filters */}
                        {isSpecialMode && selectedFaculty && (
                            <div className="flex items-center gap-1.5 px-3 h-9 bg-muted/50 rounded-lg border shadow-sm mr-2">
                                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    type="date"
                                    className="w-[130px] h-7 text-[11px] bg-transparent border-none focus-visible:ring-0 p-0"
                                    value={specialClassDate}
                                    onChange={(e) => setSpecialClassDate(e.target.value)}
                                />
                            </div>
                        )}
                        {isSpecialMode && selectedFaculty && (
                            <div className="flex items-center gap-2">
                                <div className="relative group">
                                    <Input
                                        placeholder="Reason for special class (e.g. Annual Day)"
                                        className="h-8 w-[180px] text-[10px] transition-all focus:w-[220px]"
                                        value={specialClassTitle}
                                        onChange={(e) => setSpecialClassTitle(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={() => sendBatchNotificationMutation.mutate()}
                                    disabled={sendBatchNotificationMutation.isPending}
                                    variant="secondary"
                                    className="h-8 text-[10px] font-bold gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm"
                                >
                                    <Bell className={cn("w-3.5 h-3.5", sendBatchNotificationMutation.isPending && "animate-pulse")} />
                                    {sendBatchNotificationMutation.isPending ? "Sending..." : "Send Notification"}
                                </Button>
                            </div>
                        )}
                        <Button
                            variant={isSpecialMode ? "default" : "outline"}
                            className="text-xs font-bold gap-2 shadow-sm"
                            onClick={() => setIsSpecialMode(!isSpecialMode)}
                        >
                            <CalendarIcon className="w-4 h-4" />
                            {isSpecialMode ? "Weekly View" : "Special Classes"}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsConfigDialogOpen(true)}
                            className="rounded-full shadow-sm"
                        >
                            <Settings2 className="w-4 h-4" />
                        </Button>
                    </div>
                }
            />

            {!selectedFaculty ? (
                // VIEW 1: Faculty List
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {filteredFaculties.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No faculty members found.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredFaculties.map((faculty: any) => (
                                <Card
                                    key={faculty.id}
                                    onClick={() => setSelectedFaculty(faculty)}
                                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                                >
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="font-semibold truncate">{faculty.full_name}</h3>
                                            <p className="text-xs text-muted-foreground truncate">{faculty.email}</p>
                                            <p className="text-xs text-primary mt-1 font-medium group-hover:underline">View Timetable →</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // VIEW 2: Timetable with clickable cells
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => setSelectedFaculty(null)}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h2 className="text-xl font-bold">{selectedFaculty.full_name}</h2>
                                <p className="text-sm text-muted-foreground">{selectedFaculty.email}</p>
                            </div>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            {isLoadingTimetable ? (
                                <div className="p-12 flex justify-center"><Loader fullScreen={false} /></div>
                            ) : isError ? (
                                <div className="p-12 text-center text-destructive">
                                    <p>Failed to load timetable data.</p>
                                    <p className="text-sm opacity-80 mt-1">{(queryError as Error)?.message || 'Database error'}</p>
                                    <Button variant="outline" className="mt-4" onClick={() => { queryClient.invalidateQueries({ queryKey: ['faculty-timetable'] }) }}>
                                        Retry
                                    </Button>
                                </div>
                            ) : (
                                <table className="w-full border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr>
                                            <th className="border p-4 bg-muted/50 w-32 font-bold text-left sticky left-0 whitespace-nowrap">
                                                {isSpecialMode ? "Special Class" : "Day"}
                                            </th>
                                            {Array.from({ length: configData.periods_per_day }, (_, i) => i + 1).map((p) => {
                                                const timings = calculatePeriodTimings(p);
                                                return (
                                                    <Fragment key={p}>
                                                        <th className="border p-3 bg-muted/50 text-sm font-medium text-left">
                                                            <div className="font-bold">Period {p}</div>
                                                            <div className="text-[10px] font-normal text-muted-foreground mt-0.5 whitespace-nowrap">
                                                                {timings.start} - {timings.end}
                                                            </div>
                                                        </th>
                                                        {calculateAllTimings()
                                                            .filter((s, idx, arr) => s.type !== 'period' && idx > 0 && arr[idx - 1].type === 'period' && arr[idx - 1].index === p)
                                                            .map((b, bi) => (
                                                                <th key={bi} className={`border p-3 ${b.type === 'lunch' ? 'bg-orange-50/50 text-orange-600' : 'bg-blue-50/50 text-blue-600'} text-[10px] font-bold text-center uppercase tracking-widest w-16`}>
                                                                    {b.name}
                                                                </th>
                                                            ))}
                                                    </Fragment>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(isSpecialMode ? [specialClassDate] : DAYS.slice(0, configData.days_per_week)).map((rowLabel) => (
                                            <tr key={rowLabel}>
                                                <td className="border p-4 font-semibold bg-muted/10 sticky left-0 whitespace-nowrap">
                                                    {isSpecialMode ? "Scheduled Slots" : rowLabel}
                                                </td>
                                                {Array.from({ length: configData.periods_per_day }, (_, i) => i + 1).map((period) => {
                                                    const key = `${rowLabel}-${period}`;
                                                    const timings = calculatePeriodTimings(period); // Recalculate timings for each period
                                                    const slot = isSpecialMode
                                                        ? specialSlots.find(s => {
                                                            // Calculate DB time to AM/PM format to match timings.start
                                                            const [h, m] = s.start_time.split(':').map(Number);
                                                            const hh = h % 12 || 12;
                                                            const ampm = h >= 12 ? 'PM' : 'AM';
                                                            const formattedStartTime = `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

                                                            return formattedStartTime === timings.start &&
                                                                (selectedFaculty ? s.faculty_id === selectedFaculty.id : true);
                                                        })
                                                        : viewTimetableData[key];

                                                    return (
                                                        <Fragment key={period}>
                                                            <td
                                                                className="border p-2 min-w-[140px] h-20 align-top hover:bg-primary/5 transition-colors cursor-pointer"
                                                                onClick={() => handleSlotClick(isSpecialMode ? rowLabel : rowLabel, period)}
                                                            >
                                                                {slot ? (
                                                                    <div className="space-y-1 p-1">
                                                                        <Badge variant="default" className="w-full justify-start line-clamp-1 bg-primary/10 text-primary border-0 mb-1">
                                                                            {slot.subject_name || (slot as any).subjects?.name || 'Subject'}
                                                                        </Badge>
                                                                        <div className="text-xs font-medium pl-1">
                                                                            {slot.class_name || (slot as any).classes?.name || 'Class'}
                                                                        </div>
                                                                        {(slot.section || slot.room_number) && (
                                                                            <div className="text-[10px] text-muted-foreground pl-1">
                                                                                {slot.section && `Sec: ${slot.section}`}
                                                                                {slot.section && slot.room_number && ' • '}
                                                                                {slot.room_number && `Rm: ${slot.room_number}`}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[10px] text-muted-foreground pl-1">
                                                                            {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                                                        </div>
                                                                        {isSpecialMode && (
                                                                            <div className="flex flex-col gap-1 mt-1">
                                                                                <Badge variant="outline" className="text-[8px] h-4 bg-orange-50 text-orange-600 border-orange-200">SPECIAL</Badge>
                                                                                {slot.title && (
                                                                                    <div className="text-[9px] italic text-orange-700 font-medium truncate px-1">
                                                                                        {slot.title}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-xs hover:text-muted-foreground/40">
                                                                        Click to {isSpecialMode ? "schedule" : "add"}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {calculateAllTimings()
                                                                .filter((s, idx, arr) => s.type !== 'period' && idx > 0 && arr[idx - 1].type === 'period' && arr[idx - 1].index === period)
                                                                .map((b, bi) => (
                                                                    <td key={bi} className={`border p-2 ${b.type === 'lunch' ? 'bg-orange-50/20' : 'bg-blue-50/20'} align-middle text-center`}>
                                                                        <div className={`[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold ${b.type === 'lunch' ? 'text-orange-400' : 'text-blue-400'} tracking-[0.2em] uppercase mx-auto`}>
                                                                            {b.name}
                                                                        </div>
                                                                    </td>
                                                                ))}
                                                        </Fragment>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit Slot Dialog */}
            {/* Configuration Dialog */}
            <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                <DialogContent className="max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Timetable Configuration</DialogTitle>
                        <DialogDescription>
                            Configure the default structure for all timetables in your institution.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">General Settings</h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Periods Per Day</label>
                                        <Input
                                            type="number"
                                            value={configData.periods_per_day}
                                            onChange={(e) => setConfigData({ ...configData, periods_per_day: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Days Per Week</label>
                                        <Select value={String(configData.days_per_week)} onValueChange={(v) => setConfigData({ ...configData, days_per_week: parseInt(v) })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                                                <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                                                <SelectItem value="7">7 Days (Full Week)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Period Duration (min)</label>
                                        <Input
                                            type="number"
                                            value={configData.period_duration_minutes}
                                            onChange={(e) => setConfigData({ ...configData, period_duration_minutes: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Buffer (min)</label>
                                        <Input
                                            type="number"
                                            value={configData.buffer_time_minutes}
                                            onChange={(e) => setConfigData({ ...configData, buffer_time_minutes: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Default Start Time</label>
                                        <Input
                                            type="time"
                                            value={configData.start_time}
                                            onChange={(e) => setConfigData({ ...configData, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="border-t pt-4 grid grid-cols-1 gap-4">
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lunch Break</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold">Start Time</label>
                                                    <Input
                                                        type="time"
                                                        value={configData.lunch_start_time}
                                                        onChange={(e) => setConfigData({ ...configData, lunch_start_time: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold">Duration (min)</label>
                                                    <Input
                                                        type="number"
                                                        value={configData.lunch_duration_minutes}
                                                        onChange={(e) => setConfigData({ ...configData, lunch_duration_minutes: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Short Breaks (Refreshments)</h4>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[10px] gap-1"
                                                    onClick={() => setConfigData({
                                                        ...configData,
                                                        extra_breaks: [...(configData.extra_breaks || []), { name: 'Recess', start_time: '11:00', duration: 15 }]
                                                    })}
                                                >
                                                    <Plus className="w-3 h-3" /> Add Break
                                                </Button>
                                            </div>

                                            <div className="space-y-3">
                                                {/* Legacy Short Break (kept for backward compatibility UI, but it's now just part of the list logic) */}
                                                <div className="p-3 border rounded-lg bg-muted/10 space-y-3">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{configData.short_break_name}</label>
                                                        <Input
                                                            className="h-8 text-sm"
                                                            value={configData.short_break_name}
                                                            onChange={(e) => setConfigData({ ...configData, short_break_name: e.target.value })}
                                                            placeholder="Break Name"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] font-bold uppercase opacity-60">Start Time</label>
                                                            <Input
                                                                type="time"
                                                                className="h-8 text-sm"
                                                                value={configData.short_break_start_time}
                                                                onChange={(e) => setConfigData({ ...configData, short_break_start_time: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] font-bold uppercase opacity-60">Duration (min)</label>
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm"
                                                                value={configData.short_break_duration_minutes}
                                                                onChange={(e) => setConfigData({ ...configData, short_break_duration_minutes: parseInt(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Dynamic Extra Breaks */}
                                                {(configData.extra_breaks || []).map((breakItem, index) => (
                                                    <div key={index} className="p-3 border rounded-lg bg-muted/20 space-y-3 relative group">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                const newBreaks = [...configData.extra_breaks];
                                                                newBreaks.splice(index, 1);
                                                                setConfigData({ ...configData, extra_breaks: newBreaks });
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Additional Break {index + 1}</label>
                                                            <Input
                                                                className="h-8 text-sm font-medium"
                                                                value={breakItem.name}
                                                                onChange={(e) => {
                                                                    const newBreaks = [...configData.extra_breaks];
                                                                    newBreaks[index] = { ...newBreaks[index], name: e.target.value };
                                                                    setConfigData({ ...configData, extra_breaks: newBreaks });
                                                                }}
                                                                placeholder="Break Name"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] font-bold uppercase opacity-60">Start Time</label>
                                                                <Input
                                                                    type="time"
                                                                    className="h-8 text-sm"
                                                                    value={breakItem.start_time}
                                                                    onChange={(e) => {
                                                                        const newBreaks = [...configData.extra_breaks];
                                                                        newBreaks[index] = { ...newBreaks[index], start_time: e.target.value };
                                                                        setConfigData({ ...configData, extra_breaks: newBreaks });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] font-bold uppercase opacity-60">Duration (min)</label>
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-sm"
                                                                    value={breakItem.duration}
                                                                    onChange={(e) => {
                                                                        const newBreaks = [...configData.extra_breaks];
                                                                        newBreaks[index] = { ...newBreaks[index], duration: parseInt(e.target.value) || 0 };
                                                                        setConfigData({ ...configData, extra_breaks: newBreaks });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" />
                                    Schedule Preview
                                </h4>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(calculateAllTimings() as any[]).map((slot, i) => (
                                        <div key={i} className={`flex items-center justify-between p-2 rounded text-[11px] ${slot.type === 'lunch' ? 'bg-orange-100/50 text-orange-700 font-bold border border-orange-200' :
                                            slot.type === 'short' ? 'bg-blue-100/50 text-blue-700 font-bold border border-blue-200' :
                                                'bg-background border'}`}>
                                            <span>{slot.type === 'lunch' ? 'LUNCH BREAK' : slot.type === 'short' ? slot.name?.toUpperCase() : `Period ${slot.index}`}</span>
                                            <span className="font-medium opacity-80">{slot.start} - {slot.end}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto">
                        <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                            {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            Edit Slot - {editingSlot?.day} Period {editingSlot?.period}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the timing, subject, class and section for this slot.
                        </DialogDescription>
                    </DialogHeader>

                    {editingSlot && (
                        <div className="space-y-4 py-4">
                            {/* Timing (Read-only) */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Start Time
                                    </label>
                                    <div className="text-sm font-semibold">{editingSlot.data.start_time}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> End Time
                                    </label>
                                    <div className="text-sm font-semibold">{editingSlot.data.end_time}</div>
                                </div>
                            </div>

                            {/* Class and Section - Filtered by faculty assignments */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Class</label>
                                    <Select
                                        value={editingSlot.data.class_id || 'none'}
                                        onValueChange={(v) => {
                                            updateEditingSlot('class_id', v === 'none' ? null : v);
                                            updateEditingSlot('section', ''); // Reset section when class changes
                                            updateEditingSlot('subject_id', null); // Reset subject when class changes
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select class" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Select a class</SelectItem>
                                            {uniqueClasses
                                                .filter((c: any) => {
                                                    // Filter classes assigned to this faculty
                                                    return facultyAssignments.some((a: any) => 
                                                        String(a.class_id) === String(c.id) || 
                                                        (a.subjects?.class_name === c.name)
                                                    );
                                                })
                                                .map((c: any) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Section</label>
                                    <Select
                                        value={editingSlot.data.section || 'none'}
                                        onValueChange={(v) => {
                                            updateEditingSlot('section', v === 'none' ? '' : v);
                                            updateEditingSlot('subject_id', null); // Reset subject when section changes
                                        }}
                                        disabled={!editingSlot.data.class_id || editingSlot.data.class_id === 'none'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Select section</SelectItem>
                                            {editingSlot.data.class_id && (
                                                facultyAssignments
                                                    .filter((a: any) => {
                                                        const selectedClass = uniqueClasses.find((cl: any) => String(cl.id) === String(editingSlot.data.class_id));
                                                        return String(a.class_id) === String(editingSlot.data.class_id) || 
                                                               (selectedClass && a.subjects?.class_name === selectedClass.name);
                                                    })
                                                    .map((a: any, idx: number) => (
                                                        <SelectItem key={`${a.section}-${idx}`} value={String(a.section)}>{String(a.section)}</SelectItem>
                                                    ))
                                                    // Ensure unique sections
                                                    .filter((item, pos, self) => self.findIndex(s => s.props.value === item.props.value) === pos)
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Subject - Dependent on Class and Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subject</label>
                                <Select
                                    value={editingSlot.data.subject_id || 'none'}
                                    onValueChange={(v) => updateEditingSlot('subject_id', v === 'none' ? null : v)}
                                    disabled={!editingSlot.data.section}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={!editingSlot.data.section ? "Select Class & Section first" : "Select subject"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Subject (Free Period)</SelectItem>
                                        {editingSlot.data.class_id && editingSlot.data.section && (
                                            facultyAssignments
                                                .filter((a: any) => {
                                                    const selectedClass = uniqueClasses.find((cl: any) => String(cl.id) === String(editingSlot.data.class_id));
                                                    const isClassMatch = String(a.class_id) === String(editingSlot.data.class_id) || 
                                                                       (selectedClass && a.subjects?.class_name === selectedClass.name);
                                                    const isSectionMatch = String(a.section) === String(editingSlot.data.section);
                                                    return isClassMatch && isSectionMatch;
                                                })
                                                .map((a: any) => (
                                                    <SelectItem key={a.subject_id} value={String(a.subject_id)}>
                                                        {a.subjects?.name}
                                                    </SelectItem>
                                                ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Room Number */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Room Number</label>
                                <Input
                                    placeholder="e.g., 101"
                                    value={editingSlot.data.room_number || ''}
                                    onChange={(e) => updateEditingSlot('room_number', e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => isSpecialMode ? saveSpecialSlotMutation.mutate() : saveSlotMutation.mutate()}
                            disabled={isSpecialMode ? saveSpecialSlotMutation.isPending : saveSlotMutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSpecialMode ? "Schedule Special Class" : "Save Slot"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </InstitutionLayout >
    );
}
