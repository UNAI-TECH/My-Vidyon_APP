import { SearchProvider } from "@/context/SearchContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GenericPage } from "@/components/common/GenericPage";
import { TranslationProvider } from "@/i18n/TranslationContext";

// Layouts
import { StudentLayout } from "@/layouts/StudentLayout";
import { FacultyLayout } from "@/layouts/FacultyLayout";
import { InstitutionLayout } from "@/layouts/InstitutionLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { LoginPage } from "./pages/auth/LoginPage";
import { ProfileSwitcherPage } from "./pages/auth/ProfileSwitcherPage";

// Student Pages
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentCourses } from "./pages/student/StudentCourses";
import { StudentAttendance } from "./pages/student/StudentAttendance";
import { StudentAssignments } from "./pages/student/StudentAssignments";
import { StudentTimetable } from "./pages/student/StudentTimetable";
import { StudentGrades } from "./pages/student/StudentGrades";
import { StudentMaterials } from "./pages/student/StudentMaterials";
import { StudentFees } from "./pages/student/StudentFees";
import { StudentCertificates } from "./pages/student/StudentCertificates";
import { StudentNotifications } from "./pages/student/StudentNotifications";
import { StudentAITutor } from "./pages/student/StudentAITutor";
import { StudentSettings } from "./pages/student/StudentSettings";
import { StudentCalendar } from "./pages/student/StudentCalendar";

// Faculty Pages
import { FacultyDashboard } from "./pages/faculty/FacultyDashboard";
import { FacultyCourses } from "./pages/faculty/FacultyCourses";
import { FacultyAttendance } from "./pages/faculty/FacultyAttendance";
import { FacultyAssignments } from "./pages/faculty/FacultyAssignments";
import { FacultyMarks } from "./pages/faculty/FacultyMarks";
import { FacultyExams } from "./pages/faculty/FacultyExams";

import { FacultyStudents } from "./pages/faculty/FacultyStudents";
import { FacultyStudentLeaves } from "@/pages/faculty/FacultyStudentLeaves";
import { FacultyAnnouncements } from "./pages/faculty/FacultyAnnouncements";
import { FacultyNotifications } from "./pages/faculty/FacultyNotifications";
import { FacultyLeave } from "./pages/faculty/FacultyLeave";
import { CreateAssignment } from "./pages/faculty/CreateAssignment";
import { FacultyUploadCertificate } from "./pages/faculty/FacultyUploadCertificate";
import { CreateSubject } from "./pages/faculty/CreateSubject";
import { UploadExamPaper } from "./pages/faculty/UploadExamPaper";
import { FacultySettings } from "./pages/faculty/FacultySettings";
import { FacultyCourseDetails } from "./pages/faculty/FacultyCourseDetails";
import { TimetableManagement } from "./pages/faculty/TimetableManagement";
import { ReviewSubmission } from "./pages/faculty/ReviewSubmission";
import { UpdateAssignment } from "./pages/faculty/UpdateAssignment";
import { StudentProfile } from "./pages/faculty/StudentProfile";
import { FacultyCalendar } from "./pages/faculty/FacultyCalendar";
import { FacultyScanAttendance } from "./pages/faculty/FacultyScanAttendance";

// Institution Pages
import { InstitutionDashboard } from "./pages/institution/InstitutionDashboard";
import { InstitutionDepartments } from "./pages/institution/InstitutionDepartments";
import { InstitutionCourses } from "./pages/institution/InstitutionCourses";
// import { InstitutionFaculty } from "./pages/institution/InstitutionFaculty"; // Removed
import { InstitutionCalendar } from "./pages/institution/InstitutionCalendar";
import { InstitutionLeaveApproval } from "./pages/institution/InstitutionLeaveApproval";
import { InstitutionNotifications } from "./pages/institution/InstitutionNotifications";
import { InstitutionUsers } from "./pages/institution/InstitutionUsers";
import { InstitutionStudentDetails } from "./pages/institution/InstitutionStudentDetails";
import { InstitutionAddStudent } from "./pages/institution/InstitutionAddStudent";

import { InstitutionFees } from "./pages/institution/InstitutionFees";
import { InstitutionFeeStructure } from "./pages/institution/InstitutionFeeStructure";
import { InstitutionAnalytics } from "./pages/institution/InstitutionAnalytics";
import { InstitutionReports } from "./pages/institution/InstitutionReports";
import { InstitutionSettings } from "./pages/institution/InstitutionSettings";
import { InstitutionTimetable } from "./pages/institution/InstitutionTimetable";
import { InstitutionTimetableEdit } from "./pages/institution/InstitutionTimetableEdit";

import { InstitutionFacultyAssigning } from "./pages/institution/InstitutionFacultyAssigning";
import { InstitutionStaffAttendance } from "./pages/institution/InstitutionStaffAttendance";
import { FaceRegistration } from "./pages/institution/FaceRegistration";
import { InstitutionProvider } from "@/context/InstitutionContext";

// Parent Pages
import { ParentDashboard } from "./pages/parent/ParentDashboard";
import { ParentChildDetail } from "./pages/parent/ParentChildDetail";
import { ParentNotifications } from "./pages/parent/ParentNotifications";
import { ParentFees } from "./pages/parent/ParentFees";
import { ParentFeeReceipt } from "./pages/parent/ParentFeeReceipt";
import { ParentLeave } from "./pages/parent/ParentLeave";
import { ParentSettings } from "./pages/parent/ParentSettings";
import { ParentCalendar } from "./pages/parent/ParentCalendar";
import { ParentExamSchedule } from "./pages/parent/ParentExamSchedule";
import { ParentChildExamSchedule } from "./pages/parent/ParentChildExamSchedule";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";

import { AdminInstitutionAnalytics } from "./pages/admin/AdminInstitutionAnalytics";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminStructure } from "./pages/admin/AdminStructure";
import { AdminSubjects } from "./pages/admin/AdminSubjects";
import { AdminApprovals } from "./pages/admin/AdminApprovals";
import { AdminAnnouncements } from "./pages/admin/AdminAnnouncements";
import { AdminInstitutions } from "./pages/admin/AdminInstitutions";
import { AddInstitution } from "./pages/admin/AddInstitution";
import { InstitutionDetail } from "./pages/admin/InstitutionDetail";
import { AdminNotifications } from "./pages/admin/AdminNotifications";

// Accountant Pages
import { AccountantFees } from "./pages/accountant/AccountantFees";
import { AccountantDashboard } from "./pages/accountant/AccountantDashboard";

// Canteen Pages
import { CanteenDashboard } from "./pages/canteen/CanteenDashboard";
import { CanteenSettings } from "./pages/canteen/CanteenSettings";

import { App as CapacitorApp } from '@capacitor/app';

import { queryClient } from "@/lib/queryClient";

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <WebSocketProvider>
                <SearchProvider>
                  <InstitutionProvider>
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/profile-switcher" element={<ProfileSwitcherPage />} />

                      {/* Student Routes */}
                      <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
                      <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>} />
                      <Route path="/student/timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentTimetable /></ProtectedRoute>} />
                      <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentAttendance /></ProtectedRoute>} />
                      <Route path="/student/assignments" element={<ProtectedRoute allowedRoles={['student']}><StudentAssignments /></ProtectedRoute>} />
                      <Route path="/student/grades" element={<ProtectedRoute allowedRoles={['student']}><StudentGrades /></ProtectedRoute>} />
                      <Route path="/student/materials" element={<ProtectedRoute allowedRoles={['student']}><StudentMaterials /></ProtectedRoute>} />
                      {/* <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['student']}><StudentFees /></ProtectedRoute>} /> */}
                      <Route path="/student/certificates" element={<ProtectedRoute allowedRoles={['student']}><StudentCertificates /></ProtectedRoute>} />
                      <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={['student']}><StudentNotifications /></ProtectedRoute>} />
                      <Route path="/student/ai-tutor" element={<ProtectedRoute allowedRoles={['student']}><StudentAITutor /></ProtectedRoute>} />
                      <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><StudentSettings /></ProtectedRoute>} />
                      <Route path="/student/calendar" element={<ProtectedRoute allowedRoles={['student']}><StudentCalendar /></ProtectedRoute>} />

                      {/* Faculty Routes */}
                      <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
                      <Route path="/faculty/courses" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourses /></ProtectedRoute>} />
                      <Route path="/faculty/courses/:courseId" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCourseDetails /></ProtectedRoute>} />
                      <Route path="/faculty/attendance" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyAttendance /></ProtectedRoute>} />
                      <Route path="/faculty/assignments" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyAssignments /></ProtectedRoute>} />
                      <Route path="/faculty/assignments/create" element={<ProtectedRoute allowedRoles={['faculty']}><CreateAssignment /></ProtectedRoute>} />
                      <Route path="/faculty/assignments/edit/:id" element={<ProtectedRoute allowedRoles={['faculty']}><UpdateAssignment /></ProtectedRoute>} />
                      <Route path="/faculty/marks" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyMarks /></ProtectedRoute>} />
                      <Route path="/faculty/exams" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyExams /></ProtectedRoute>} />

                      <Route path="/faculty/students" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyStudents /></ProtectedRoute>} />
                      <Route path="/faculty/student-leaves" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyStudentLeaves /></ProtectedRoute>} />
                      <Route path="/faculty/students/:studentId" element={<ProtectedRoute allowedRoles={['faculty', 'institution', 'admin']}><StudentProfile /></ProtectedRoute>} />
                      <Route path="/faculty/notifications" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyNotifications /></ProtectedRoute>} />
                      <Route path="/faculty/announcements" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyAnnouncements /></ProtectedRoute>} />
                      <Route path="/faculty/upload-certificate" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyUploadCertificate /></ProtectedRoute>} />
                      <Route path="/faculty/leave" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyLeave /></ProtectedRoute>} />
                      <Route path="/faculty/courses/create" element={<ProtectedRoute allowedRoles={['faculty']}><CreateSubject /></ProtectedRoute>} />
                      <Route path="/faculty/exams/upload" element={<ProtectedRoute allowedRoles={['faculty']}><UploadExamPaper /></ProtectedRoute>} />
                      <Route path="/faculty/timetable" element={<ProtectedRoute allowedRoles={['faculty']}><TimetableManagement /></ProtectedRoute>} />
                      <Route path="/faculty/review-submission" element={<ProtectedRoute allowedRoles={['faculty']}><ReviewSubmission /></ProtectedRoute>} />
                      <Route path="/faculty/settings" element={<ProtectedRoute allowedRoles={['faculty']}><FacultySettings /></ProtectedRoute>} />
                      <Route path="/faculty/scan-attendance" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyScanAttendance /></ProtectedRoute>} />
                      <Route path="/faculty/calendar" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyCalendar /></ProtectedRoute>} />

                      {/* Institution Routes */}
                      <Route path="/institution" element={<ProtectedRoute allowedRoles={['institution', 'accountant']}><InstitutionDashboard /></ProtectedRoute>} />
                      {/* Accountant Specific Dashboard Route (optional alias if we want strict separation, but /institution is working as shared. 
                          However, prompt asked for new page. Let's add it.) 
                      */}
                      <Route path="/accountant/dashboard" element={<ProtectedRoute allowedRoles={['accountant']}><AccountantDashboard /></ProtectedRoute>} />

                      <Route path="/institution/departments" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionDepartments /></ProtectedRoute>} />
                      <Route path="/institution/courses" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionCourses /></ProtectedRoute>} />
                      {/* <Route path="/institution/faculty" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionFaculty /></ProtectedRoute>} /> */}
                      <Route path="/institution/faculty-assigning" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionFacultyAssigning /></ProtectedRoute>} />
                      <Route path="/institution/calendar" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionCalendar /></ProtectedRoute>} />
                      <Route path="/institution/leave-approval" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionLeaveApproval /></ProtectedRoute>} />
                      <Route path="/institution/notifications" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionNotifications /></ProtectedRoute>} />
                      <Route path="/institution/users" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionUsers /></ProtectedRoute>} />
                      <Route path="/institution/students/:studentId" element={<ProtectedRoute allowedRoles={['institution', 'admin']}><StudentProfile /></ProtectedRoute>} />
                      <Route path="/institution/add-student" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionAddStudent /></ProtectedRoute>} />

                      <Route path="/institution/fees" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionFees /></ProtectedRoute>} />
                      <Route path="/institution/timetable" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionTimetable /></ProtectedRoute>} />
                      <Route path="/institution/timetable/edit/:facultyId" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionTimetableEdit /></ProtectedRoute>} />
                      <Route path="/institution/analytics" element={<ProtectedRoute allowedRoles={['institution', 'accountant']}><InstitutionAnalytics /></ProtectedRoute>} />
                      <Route path="/institution/reports" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionReports /></ProtectedRoute>} />
                      <Route path="/institution/staff-attendance" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionStaffAttendance /></ProtectedRoute>} />
                      <Route path="/institution/settings" element={<ProtectedRoute allowedRoles={['institution']}><InstitutionSettings /></ProtectedRoute>} />

                      {/* Accountant Routes */}
                      <Route path="/accountant" element={<ProtectedRoute allowedRoles={['accountant']}><AccountantFees /></ProtectedRoute>} />
                      <Route path="/accountant/fees" element={<ProtectedRoute allowedRoles={['accountant']}><AccountantFees /></ProtectedRoute>} />
                      <Route path="/accountant/fee-structure" element={<ProtectedRoute allowedRoles={['accountant']}><InstitutionFeeStructure /></ProtectedRoute>} />

                      {/* Canteen Routes */}
                      <Route path="/canteen" element={<ProtectedRoute allowedRoles={['canteen_manager']}><CanteenDashboard /></ProtectedRoute>} />
                      <Route path="/canteen/settings" element={<ProtectedRoute allowedRoles={['canteen_manager']}><CanteenSettings /></ProtectedRoute>} />

                      {/* Parent Routes */}
                      <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
                      <Route path="/parent/child/:studentId" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetail /></ProtectedRoute>} />
                      <Route path="/parent/notifications" element={<ProtectedRoute allowedRoles={['parent']}><ParentNotifications /></ProtectedRoute>} />
                      <Route path="/parent/fees" element={<ProtectedRoute allowedRoles={['parent']}><ParentFees /></ProtectedRoute>} />
                      <Route path="/parent/fees/receipt/:invoiceId" element={<ProtectedRoute allowedRoles={['parent']}><ParentFeeReceipt /></ProtectedRoute>} />
                      <Route path="/parent/leave" element={<ProtectedRoute allowedRoles={['parent']}><ParentLeave /></ProtectedRoute>} />
                      <Route path="/parent/settings" element={<ProtectedRoute allowedRoles={['parent']}><ParentSettings /></ProtectedRoute>} />
                      <Route path="/parent/calendar" element={<ProtectedRoute allowedRoles={['parent']}><ParentCalendar /></ProtectedRoute>} />
                      <Route path="/parent/exam-schedule" element={<ProtectedRoute allowedRoles={['parent']}><ParentExamSchedule /></ProtectedRoute>} />
                      <Route path="/parent/exam-schedule/:childId" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildExamSchedule /></ProtectedRoute>} />

                      {/* Admin Routes */}
                      {/* SaaS Admin Routes */}
                      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                      <Route path="/admin/institutions" element={<ProtectedRoute allowedRoles={['admin']}><AdminInstitutions /></ProtectedRoute>} />
                      <Route path="/admin/add-institution" element={<ProtectedRoute allowedRoles={['admin']}><AddInstitution /></ProtectedRoute>} />
                      <Route path="/admin/institutions/:institutionId" element={<ProtectedRoute allowedRoles={['admin']}><InstitutionDetail /></ProtectedRoute>} />

                      <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminInstitutionAnalytics /></ProtectedRoute>} />
                      <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
                      <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminNotifications /></ProtectedRoute>} />

                      {/* School Admin Routes - Deactivated */}
                      {/* <Route path="/admin/structure" element={<ProtectedRoute allowedRoles={['admin']}><AdminStructure /></ProtectedRoute>} /> */}
                      {/* <Route path="/admin/subjects" element={<ProtectedRoute allowedRoles={['admin']}><AdminSubjects /></ProtectedRoute>} /> */}
                      {/* <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin']}><AdminApprovals /></ProtectedRoute>} /> */}
                      {/* <Route path="/admin/communication" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} /> */}

                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </InstitutionProvider>
                </SearchProvider>
              </WebSocketProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </TranslationProvider>
    </QueryClientProvider>
  );
};

export default App;
