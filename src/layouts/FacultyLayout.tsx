import { ReactNode } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useTranslation } from '@/i18n/TranslationContext';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  FileQuestion,
  BarChart3,
  Users,
  Megaphone,
  Calendar,
  Settings,
  Camera,
} from 'lucide-react';


export function FacultyLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Check if user is a class teacher to show/hide Timetable link
  const { data: isClassTeacher = false } = useQuery({
    queryKey: ['is-class-teacher', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('faculty_subjects')
        .select('id')
        .eq('faculty_profile_id', user.id)
        .eq('assignment_type', 'class_teacher')
        .limit(1)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const facultyNavItems = [
    { label: t.nav.dashboard, href: '/faculty', icon: LayoutDashboard },
    { label: t.nav.courses, href: '/faculty/courses', icon: BookOpen },
    { label: t.nav.attendance, href: '/faculty/attendance', icon: ClipboardCheck },
    { label: t.nav.assignments, href: '/faculty/assignments', icon: FileText },
    { label: t.nav.marks, href: '/faculty/marks', icon: GraduationCap },
    { label: 'Materials', href: '/faculty/exams', icon: FileQuestion },

    { label: t.nav.students, href: '/faculty/students', icon: Users },
    { label: 'Academic Calendar', href: '/faculty/calendar', icon: Calendar },
    { label: 'Timetable', href: '/faculty/timetable', icon: BarChart3 },
    { label: t.nav.notifications, href: '/faculty/notifications', icon: Megaphone },
    { label: 'Upload Certificate', href: '/faculty/upload-certificate', icon: FileText },
    { label: t.nav.leave, href: '/faculty/leave', icon: Calendar },
    { label: t.nav.settings, href: '/faculty/settings', icon: Settings },
  ];

  return (
    <DashboardLayout navItems={facultyNavItems} roleColor="text-faculty">
      {children}
    </DashboardLayout>
  );
}
