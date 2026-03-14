export type UserRole = 'student' | 'faculty' | 'institution' | 'admin' | 'parent' | 'accountant' | 'canteen_manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  institutionId?: string;
  institutionUuid?: string;
  institutionName?: string;
  institutionCode?: string;
  studentId?: string;
  staffId?: string;
  className?: string;
  section?: string;
  academicYear?: string;
  departmentId?: string;
  forcePasswordChange?: boolean;
  phone?: string;
  address?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  faculty: 'Faculty',
  institution: 'Institution',
  admin: 'Super Admin',
  parent: 'Parent',
  accountant: 'Accountant',
  canteen_manager: 'Canteen Manager',
};

export const ROLE_ROUTES: Record<UserRole, string> = {
  student: '/student',
  faculty: '/faculty',
  institution: '/institution',
  admin: '/admin',
  parent: '/parent',
  accountant: '/accountant/fees',
  canteen_manager: '/canteen',
};
