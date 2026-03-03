import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { StudentLayout } from '@/layouts/StudentLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { CourseCard } from '@/components/cards/CourseCard';
import { AssignmentCard } from '@/components/cards/AssignmentCard';
import { NotificationCard } from '@/components/cards/NotificationCard';
import { AdCard } from '@/components/cards/AdCard';
import { AdCarousel } from '@/components/cards/AdCarousel';
import { NotificationDynamicCard } from '@/components/cards/NotificationDynamicCard';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n/TranslationContext';
import { supabase } from '@/lib/supabase';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Calendar,
  CheckCircle,
  DollarSign,
  GraduationCap,
} from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Fetch Student Profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      if (!user?.email) return null;

      const query = supabase
        .from('students')
        .select('*')
        .ilike('email', user.email.trim());

      if (user.institutionId) {
        query.eq('institution_id', user.institutionId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Profile Fetch Error:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.email,
    staleTime: 1000 * 60,
  });

  // Use the hook for all data
  const { stats, assignments, attendanceRecords, grades, subjects } = useStudentDashboard(
    studentProfile?.id,
    studentProfile?.institution_id
  );

  // Get today's attendance status
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRecord = attendanceRecords.find(r => r.date === today);
  const isAfterAbsentThreshold = new Date().getHours() >= 10;

  // 10. Fetch real academic events
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['upcoming-events', user?.institutionId || studentProfile?.institution_id],
    queryFn: async () => {
      const instId = user?.institutionId || studentProfile?.institution_id;
      if (!instId) return [];

      const { data, error } = await supabase
        .from('academic_events')
        .select('*')
        .eq('institution_id', instId)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!(user?.institutionId || studentProfile?.institution_id),
  });

  return (
    <StudentLayout>
      <PageHeader
        title={`${t.common.welcome}, ${user?.name.split(' ')[0]}!`}
        subtitle={t.dashboard.overview}
      />

      {/* MyGate-style Shortcuts */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 px-1">Quick Services</h3>
        <div className="shortcut-grid">
          <Link to="/student/attendance" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-blue-100 text-blue-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Attendance</span>
          </Link>
          <Link to="/student/timetable" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-purple-100 text-purple-600">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Timetable</span>
          </Link>
          <Link to="/student/courses" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-orange-100 text-orange-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Courses</span>
          </Link>
          <Link to="/student/assignments" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-green-100 text-green-600">
              <Clock className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Assignments</span>
          </Link>
          <Link to="/student/grades" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-red-100 text-red-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Grades</span>
          </Link>
          <Link to="/student/ai-tutor" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-indigo-100 text-indigo-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="shortcut-label">AI Tutor</span>
          </Link>
          <Link to="/student/materials" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-yellow-100 text-yellow-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Materials</span>
          </Link>
          <Link to="/student/settings" className="shortcut-card">
            <div className="shortcut-icon-wrapper bg-gray-100 text-gray-600">
              <Clock className="w-6 h-6" />
            </div>
            <span className="shortcut-label">Profile</span>
          </Link>
        </div>
      </section>

      <AdCarousel
        ads={[
          {
            title: "New Stationeries & Learning Tools",
            description: "Upgrade your performance with our latest collection of premium stationeries and advanced AI learning tools.",
            Icon: TrendingUp,
            iconBgColor: "bg-gradient-to-tr from-primary to-orange-400 text-white",
            badgeText: "New Arrival"
          },
          {
            title: "Join the Science Olympiad 2024",
            description: "Register now for the biggest inter-school science competition and win exciting scholarships.",
            Icon: GraduationCap,
            iconBgColor: "bg-gradient-to-tr from-blue-500 to-indigo-600 text-white",
            badgeText: "Competition"
          },
          {
            title: "Creative Arts Workshop",
            description: "Unleash your creativity this weekend! Join our masterclass for sketching and digital art.",
            Icon: BookOpen,
            iconBgColor: "bg-gradient-to-tr from-purple-500 to-pink-500 text-white",
            badgeText: "Workshop"
          }
        ]}
        className="mb-6"
      />

      {/* Stats Grid - 2 columns on mobile, 4 on desktop */}
      <div className="stats-grid mb-6 sm:mb-8">
        <StatCard
          title="Subjects"
          value={subjects.length}
          icon={BookOpen}
          iconColor="text-student"
          change="Enrolled Courses"
        />
        <StatCard
          title="Attendance Status"
          value={
            todayRecord?.status === 'present' ? 'PRESENT' :
              todayRecord?.status === 'late' ? 'LATE' :
                todayRecord?.status === 'absent' ? 'ABSENT' :
                  (isAfterAbsentThreshold ? 'ABSENT' : 'NOT MARKED')
          }
          icon={CheckCircle}
          iconColor={
            todayRecord?.status === 'present' ? 'text-success' :
              todayRecord?.status === 'late' ? 'text-warning' :
                (todayRecord?.status === 'absent' || (!todayRecord && isAfterAbsentThreshold)) ? 'text-destructive' : 'text-muted-foreground'
          }
          change={stats.attendancePercentage}
          changeType={parseInt(stats.attendancePercentage) >= 75 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Average Grade"
          value={stats.averageGrade}
          icon={TrendingUp}
          iconColor="text-primary"
          change={`${grades.length} subjects graded`}
          changeType="positive"
        />
        <StatCard
          title="Academic Info"
          value={`${studentProfile?.class_name || 'N/A'}-${studentProfile?.section || ''}`}
          icon={Clock}
          iconColor="text-warning"
          change={studentProfile?.register_number || "No ID"}
        />
      </div>

      {/* Notifications Row */}
      <div className="mb-6 sm:mb-8">
        <NotificationDynamicCard />
      </div>

    </StudentLayout>
  );
}
