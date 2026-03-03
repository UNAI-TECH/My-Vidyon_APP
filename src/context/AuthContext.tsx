import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, UserRole, AuthState, LoginCredentials, ROLE_ROUTES } from '@/types/auth';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured, testSupabaseConnection, setActiveAccount, capacitorStorage } from '@/lib/supabase';
import { Preferences } from '@capacitor/preferences';
import { toast } from 'sonner';
import { SplashScreen } from '@capacitor/splash-screen';
import { initializePushNotifications, removePushToken } from '@/services/pushNotification.service';

interface AuthStateWithAccounts extends AuthState {
  accounts: User[];
  activeAccountId: string | null;
}

interface AuthContextType extends AuthStateWithAccounts {
  login: (credentials: LoginCredentials, isAdding?: boolean) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  forgetAccount: (userId: string) => Promise<void>;
  switchRole: (role: UserRole) => void; // Demo feature
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthStateWithAccounts>({
    user: null,
    accounts: [],
    activeAccountId: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
    try {
      console.log('[AUTH] Verifying role for:', email);
      console.log('[AUTH] Starting profile fetch at:', new Date().toISOString());

      //  30-second timeout for profile fetch (increased for slower connections)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          console.error('[AUTH] ⏱️ Profile fetch timed out after 30 seconds - database is not responding');
          reject(new Error('Profile fetch timed out after 30 seconds. Please check your network connection.'));
        }, 30000)
      );

      const profileFetchPromise = (async () => {
        let detectedRole: UserRole | null = null;
        let institutionId: string | undefined = undefined;

        // 1. Fetch profile with institution data in one query
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, institution_id, status, phone')
          .eq('id', userId)
          .maybeSingle();

        // If Super Admin, return immediately
        if (profile?.role === 'admin') {
          return {
            id: userId,
            email: email,
            name: profile.full_name || email.split('@')[0],
            role: 'admin' as UserRole,
            institutionId: profile.institution_id,
            forcePasswordChange: false
          };
        }

        // Check if profile is active
        if (profile?.status === 'inactive') {
          console.error('🚫 [AUTH] BLOCKING LOGIN - Profile is disabled');
          throw new Error('USER_DISABLED');
        }

        // 2. Role detection logic
        if (profile?.role) {
          // If we have a role in the profile, use it immediately
          detectedRole = profile.role as UserRole;
          institutionId = profile.institution_id;
          console.log('[AUTH] Role found in profile:', detectedRole);
        } else {
          // Fallback: Parallel queries for role detection if profile role is missing
          console.log('[AUTH] Role missing from profile, running fallback queries...');
          const [instRes, studentRes, parentRes, staffRes, accountantRes] = await Promise.all([
            supabase.from('institutions').select('institution_id').eq('admin_email', email).maybeSingle(),
            supabase.from('students').select('institution_id, address').eq('email', email).maybeSingle(),
            supabase.from('parents').select('institution_id, phone').eq('email', email).maybeSingle(),
            supabase.from('staff_details').select('institution_id, role').eq('profile_id', userId).maybeSingle(),
            supabase.from('accountants').select('institution_id').eq('profile_id', userId).maybeSingle()
          ]);

          // Check Institution Admin
          if (instRes.data) {
            detectedRole = 'institution';
            institutionId = instRes.data.institution_id;
          }

          // Check Student
          if (!detectedRole && studentRes.data) {
            detectedRole = 'student';
            institutionId = studentRes.data.institution_id;
          }

          // Check Parent
          if (!detectedRole && parentRes.data) {
            detectedRole = 'parent';
            institutionId = parentRes.data.institution_id;
          }

          // --- PARENT AUTO-SYNC & LINKING ---
          if (detectedRole === 'parent' && institutionId) {
            console.log('[AUTH] Syncing parent record and seeking children...');
            try {
              // 1. Ensure parent record exists in public.parents mapped to profile_id
              const { data: parentRecord, error: parentError } = await supabase
                .from('parents')
                .upsert({
                  profile_id: userId,
                  email: email,
                  institution_id: institutionId,
                  name: profile?.full_name || email.split('@')[0]
                }, { onConflict: 'profile_id' })
                .select()
                .single();

              if (!parentError && parentRecord) {
                // 2. Try to link students who have this parent's email as parent_email 
                // but aren't linked in student_parents yet
                const { data: unlinkedChildren } = await supabase
                  .from('students')
                  .select('id')
                  .ilike('parent_email', email.trim());

                if (unlinkedChildren && unlinkedChildren.length > 0) {
                  const linkEntries = unlinkedChildren.map(child => ({
                    student_id: child.id,
                    parent_id: parentRecord.id
                  }));

                  // Upsert to avoid duplicate key errors if already linked
                  await supabase.from('student_parents').upsert(linkEntries, { onConflict: 'student_id,parent_id' });
                  console.log(`[AUTH] Auto-linked ${unlinkedChildren.length} children to parent ${email}`);
                }
              }
            } catch (err) {
              console.warn('[AUTH] Parent sync-linking failed:', err);
            }
          }
          // ---------------------------------

          // Check Staff/Faculty (StaffDetails might have different role field)
          if (!detectedRole && staffRes.data) {
            detectedRole = staffRes.data.role as UserRole;
            institutionId = staffRes.data.institution_id;
          }

          // Check Accountant
          if (!detectedRole && accountantRes.data) {
            detectedRole = 'accountant';
            institutionId = accountantRes.data.institution_id;
          }

          if (!detectedRole) {
            // Last resort: check profiles again but more loosely
            if (institutionId) {
              detectedRole = 'student'; // Default to student if institution found but role not
            } else {
              console.error('No role detected for user');
              return null;
            }
          }

          // --- SYNC LOGIC: Update profiles table if data was missing ---
          if (detectedRole && institutionId) {
            console.log('[AUTH] Syncing profile table with detected data...');
            const syncData = {
              id: userId,
              email: email,
              role: detectedRole,
              institution_id: institutionId,
              full_name: profile?.full_name || email.split('@')[0]
            };

            // Use upsert to handle both missing rows and missing data in existing rows
            const { error: syncError } = await supabase.from('profiles').upsert(syncData, { onConflict: 'id' });
            if (syncError) {
              console.warn('[AUTH] Profile sync failed:', syncError.message);
            }
          }
        }

        // 2b. If institutionId is still missing, try to find it from any associated table
        if (!institutionId) {
          const [s, p, st] = await Promise.all([
            supabase.from('students').select('institution_id').eq('email', email).maybeSingle(),
            supabase.from('parents').select('institution_id').eq('email', email).maybeSingle(),
            supabase.from('staff_details').select('institution_id, role').eq('profile_id', userId).maybeSingle()
          ]);
          institutionId = s.data?.institution_id || p.data?.institution_id || st.data?.institution_id;
        }

        // 5. Fetch additional details for card (Institution info, Class, Section, Student ID, Photo)
        let institutionName = 'Unknown Institution';
        let institutionCode = institutionId || 'N/A';
        let extraDetails: any = {};

        // 2c. Fetch Staff Details if needed
        let staffId = undefined;
        let staffImage = undefined;
        if (detectedRole !== 'student' && detectedRole !== 'parent' && detectedRole !== 'admin') {
          const { data: staff } = await supabase
            .from('staff_details')
            .select('staff_id, image_url, class_assigned, section_assigned')
            .eq('profile_id', userId)
            .maybeSingle();
          if (staff) {
            staffId = staff.staff_id;
            staffImage = (staff as any).image_url;
            extraDetails.className = (staff as any).class_assigned;
            extraDetails.section = (staff as any).section_assigned;
          }
        }

        if (institutionId) {
          const { data: inst } = await supabase
            .from('institutions')
            .select('name, institution_id')
            .eq('institution_id', institutionId)
            .maybeSingle();
          if (inst) {
            institutionName = inst.name;
            institutionCode = inst.institution_id;
          }
        }

        if (detectedRole === 'student') {
          const { data: student } = await supabase
            .from('students')
            .select('register_number, class_name, section, image_url')
            .eq('id', userId)
            .maybeSingle();
          if (student) {
            extraDetails = {
              studentId: student.register_number,
              className: student.class_name,
              section: student.section,
              imageUrl: student.image_url
            };
          }
        }

        return {
          id: userId,
          email: email,
          name: profile?.full_name || email.split('@')[0],
          role: detectedRole,
          avatar: extraDetails.imageUrl || staffImage,
          institutionId: institutionId,
          institutionName,
          institutionCode,
          studentId: extraDetails.studentId,
          staffId: staffId,
          className: extraDetails.className,
          section: extraDetails.section,
          academicYear: '2025-26', // TODO: Fetch from settings
          forcePasswordChange: false,
          phone: profile?.phone,
          address: undefined
        };
      })();

      // Race between profile fetch and 30s timeout
      const result = await Promise.race([profileFetchPromise, timeoutPromise]);
      return result as User | null;

    } catch (err: any) {
      console.error('Profile fetch error:', err);
      if (err.message === 'INSTITUTION_INACTIVE' || err.message === 'INSTITUTION_DELETED' || err.message === 'USER_DISABLED') {
        throw err; // Re-throw blocking errors
      }

      // If it's a network timeout or connection error, don't return null (which triggers logout)
      // instead, throw a specific TRANSIENT_ERROR so caller knows not to clear session
      const errorMsg = err.message || '';
      if (errorMsg.includes('timeout') || errorMsg.includes('fetch') || errorMsg.includes('Network')) {
        console.warn('⚠️ [AUTH] Network error during profile fetch - holding session');
        throw new Error('TRANSIENT_NETWORK_ERROR');
      }

      return null;
    }
  }, []);

  const userRef = useRef(state.user);
  const isProcessingAuth = useRef(false);
  const isSwitchingAccount = useRef(false);

  useEffect(() => {
    userRef.current = state.user;
  }, [state.user]);

  const saveAccountsList = async (accounts: User[]) => {
    await Preferences.set({
      key: 'myvidyon-accounts-list',
      value: JSON.stringify(accounts)
    });
  };

  const getAccountsList = async (): Promise<User[]> => {
    const { value } = await Preferences.get({ key: 'myvidyon-accounts-list' });
    return value ? JSON.parse(value) : [];
  };

  const getActiveAccountId = async (): Promise<string | null> => {
    const { value } = await Preferences.get({ key: 'myvidyon-active-account-id' });
    return value;
  };

  const setActiveAccountId = async (id: string | null) => {
    if (id) {
      await Preferences.set({ key: 'myvidyon-active-account-id', value: id });
    } else {
      await Preferences.remove({ key: 'myvidyon-active-account-id' });
    }
    setActiveAccount(id);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    let isInitialLoad = true;

    // Explicitly initialize session from storage on startup
    const initSession = async () => {
      try {
        console.log('[AUTH] Checking for existing accounts...');
        const accounts = await getAccountsList();
        const activeId = await getActiveAccountId();

        // Check if user explicitly logged out
        const { value: loggedOutFlag } = await Preferences.get({ key: 'myvidyon-logged-out' });
        const hasLoggedOut = loggedOutFlag === 'true';

        if (activeId) {
          setActiveAccount(activeId);
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AUTH] Error retrieving session:', error);
          setState(prev => ({ ...prev, accounts, activeAccountId: activeId, isLoading: false }));
          return;
        }

        // If user has logged out, show profile switcher instead of auto-signin
        if (hasLoggedOut) {
          console.log('[AUTH] User logged out - showing profile switcher');
          setState({
            user: null,
            accounts,
            activeAccountId: null,
            isAuthenticated: false,
            isLoading: false
          });

          // Navigate to login page if we have accounts (LoginPage has AccountSwitcher embedded)
          if (accounts.length > 0 && (window.location.pathname === '/' || window.location.pathname === '/login')) {
            navigate('/login');
          }
        } else if (session) {
          // Auto-signin if user hasn't logged out
          console.log('[AUTH] Found existing session, restoring user...');
          try {
            const user = await fetchUserProfile(session.user.id, session.user.email!);

            if (user) {
              setState({
                user,
                accounts: accounts.find(a => a.id === user.id) ? accounts : [...accounts, user],
                activeAccountId: user.id,
                isAuthenticated: true,
                isLoading: false,
              });
              console.log('[AUTH] Session restored successfully, navigating to:', ROLE_ROUTES[user.role]);

              // Only navigate if we're on the root or login path
              if (window.location.pathname === '/' || window.location.pathname === '/login') {
                navigate(ROLE_ROUTES[user.role]);
              }

              // Initialize push notifications after session restoration
              try {
                console.log('[AUTH] Initializing push notifications for restored session...');
                await initializePushNotifications(user.id);
              } catch (error) {
                console.error('[AUTH] Push notification init failed during session restoration:', error);
              }
            } else {
              console.log('[AUTH] Profile not found, clearing session');
              await supabase.auth.signOut();
              setState({ user: null, accounts, activeAccountId: null, isAuthenticated: false, isLoading: false });
            }
          } catch (error: any) {
            console.error('[AUTH] Error restoring session:', error);
            const isBlockingError = ['INSTITUTION_INACTIVE', 'INSTITUTION_DELETED', 'USER_DISABLED'].includes(error.message);
            const isTransientError = error.message === 'TRANSIENT_NETWORK_ERROR';

            if (isBlockingError) {
              await supabase.auth.signOut();
              setState({ user: null, accounts, activeAccountId: null, isAuthenticated: false, isLoading: false });
            } else if (isTransientError) {
              // On network error, try to use the cached account data from preferences if available
              const cachedAccount = accounts.find(a => a.id === activeId);
              if (cachedAccount) {
                console.log('[AUTH] Network error on init, using cached account data');
                setState({
                  user: cachedAccount,
                  accounts,
                  activeAccountId: activeId,
                  isAuthenticated: true,
                  isLoading: false,
                });
              } else {
                setState(prev => ({ ...prev, accounts, activeAccountId: activeId, isLoading: false }));
              }
            } else {
              setState({ user: null, accounts, activeAccountId: null, isAuthenticated: false, isLoading: false });
            }
          }
        } else {
          console.log('[AUTH] No active session found');
          setState({ user: null, accounts, activeAccountId: activeId, isAuthenticated: false, isLoading: false });
        }

        // Hide splash screen after initial session check
        setTimeout(async () => {
          try {
            await SplashScreen.hide();
            console.log('[AUTH] Splash screen hidden after auth check');
          } catch (error) {
            console.log('[AUTH] Splash screen already hidden or not available');
          }
        }, 300);
        isInitialLoad = false;
      } catch (error) {
        console.error('[AUTH] Fatal error during session init:', error);
        const accounts = await getAccountsList();
        setState({ user: null, accounts, activeAccountId: null, isAuthenticated: false, isLoading: false });
      }
    };

    // Initialize session immediately
    initSession();

    // Listen for auth changes and handle initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // STRICT GUARD: If we are manually switching accounts, ignore EVERYTHING from Supabase
      // until the switch is complete and we have navigated away.
      if (isSwitchingAccount.current) {
        console.log(`🔒 [AUTH] Ignoring auth event '${event}' because manual switch is in progress`);
        return;
      }

      if (isProcessingAuth.current) {
        console.log(`🔄 [AUTH] Event ${event} skipped (manual processing in progress)`);
        return;
      }

      console.log(`🔄 [AUTH] Event: ${event}`);

      // Skip initial load events since we handle them above
      if (isInitialLoad) {
        console.log('[AUTH] Skipping event during initial load');
        return;
      }

      if (session) {
        // If we already have the same user and it's just a token refresh (not SIGNED_IN), 
        // we can skip the heavy profile fetch to avoid transient network issues logging the user out.
        if (userRef.current?.id === session.user.id && event !== 'SIGNED_IN') {
          console.log('[AUTH] Token refresh for same user, skipping profile fetch');
          return;
        }

        try {
          // If we just became authenticated but have no activeAccountId, checking accounts
          if (!state.activeAccountId && session.user.id) {
            console.log('[AUTH] Session found but no activeAccountId set, deriving from session user...');
            await setActiveAccountId(session.user.id);
          }

          const user = await fetchUserProfile(session.user.id, session.user.email!);

          if (user) {
            setState(prev => {
              const accounts = prev.accounts.find(a => a.id === user.id)
                ? prev.accounts
                : [...prev.accounts, user];
              saveAccountsList(accounts);
              return {
                ...prev,
                user,
                accounts,
                activeAccountId: user.id,
                isAuthenticated: true,
                isLoading: false,
              };
            });

            // Only auto-navigate on SIGNED_IN events and if NOT switching
            if (event === 'SIGNED_IN' && !isSwitchingAccount.current) {
              console.log('[AUTH] User signed in, navigating to:', ROLE_ROUTES[user.role]);
              if (window.location.pathname === '/login' || window.location.pathname === '/') {
                navigate(ROLE_ROUTES[user.role]);
              }
            }
          } else { // Profile explicitly not found in DB
            console.error('🚫 [AUTH] Profile not found - signing out');
            await supabase.auth.signOut();
            setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
          }
        } catch (error: any) {
          // ... strict error handling ...
          console.error('[AUTH] Error inside auth listener:', error);
          // Don't sign out automatically on transient errors
        }
      } else {
        // No session
        // Triple check: Don't clear user state if we're in the middle of a switch operation
        if (isSwitchingAccount.current) {
          console.log('🔒 [AUTH] Session ended notification ignored during switch');
          return;
        }
        console.log('[AUTH] Session ended');
        setState(prev => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }));
      }
    });

    // Sub-periodic check for institution status (optional, but keep it robust)
    const statusCheckInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !userRef.current) return;

      try {
        // Use a silent fetch that doesn't trigger global loading or aggressive error handling
        await fetchUserProfile(session.user.id, session.user.email!);
      } catch (error: any) {
        if (['INSTITUTION_INACTIVE', 'INSTITUTION_DELETED', 'USER_DISABLED'].includes(error.message)) {
          console.error('🚫 [AUTH] Mid-session block detected');
          await supabase.auth.signOut();
          setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
          toast.error('Session Expired', { description: 'Your access has been revoked.' });
        }
      }
    }, 60000); // Reduce frequency to once per minute

    return () => {
      subscription.unsubscribe();
      clearInterval(statusCheckInterval);
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (credentials: LoginCredentials, isAdding?: boolean) => {
    console.log(`[AUTH] Login started for: ${credentials.email} (Adding: ${isAdding})`);

    // Clear logout flag when logging in
    await Preferences.remove({ key: 'myvidyon-logged-out' });

    setState(prev => ({ ...prev, isLoading: true }));

    isProcessingAuth.current = true;
    try {
      // Mock Login Bypass (Demo Mode)
      if (!isSupabaseConfigured()) {
        const role: UserRole = credentials.email.includes('admin') ? 'admin' : 'student';
        const user: User = { id: `MOCK_${Date.now()}`, email: credentials.email, name: 'Demo User', role };

        setState(prev => {
          const accounts = prev.accounts.find(a => a.email === user.email)
            ? prev.accounts
            : [...prev.accounts, user];
          saveAccountsList(accounts);
          return {
            ...prev,
            user,
            accounts,
            activeAccountId: user.id,
            isAuthenticated: true,
            isLoading: false,
          };
        });
        navigate(ROLE_ROUTES[role]);
        return;
      }

      // If adding a new account, we should sign out existing session first in Supabase client
      // but remember we are in "Adding Mode" so we don't clear our UI state yet.
      if (isAdding) {
        await supabase.auth.signOut();
        setActiveAccountId(null);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;
      if (!data.user?.email) throw new Error("User email not found");

      const user = await fetchUserProfile(data.user.id, data.user.email);

      if (user) {
        // --- SESSION MIGRATION ---
        // 1. Get current session (it was saved to the 'default' slot during signInWithPassword)
        const { data: { session } } = await supabase.auth.getSession();

        // 2. Set the active account ID (this changes the storage key)
        await setActiveAccountId(user.id);

        // 3. Move/Save the session to the new user-specific slot
        if (session) {
          console.log(`[AUTH] Migrating session to slot: myvidyon-auth-session-${user.id}`);
          await capacitorStorage.setItem('myvidyon-auth-session', JSON.stringify(session));
        }
        // -------------------------

        setState(prev => {
          const accounts = prev.accounts.find(a => a.id === user.id)
            ? prev.accounts
            : [...prev.accounts, user];
          saveAccountsList(accounts);
          return {
            ...prev,
            user,
            accounts,
            activeAccountId: user.id,
            isAuthenticated: true,
            isLoading: false,
          };
        });
        navigate(ROLE_ROUTES[user.role]);
        await initializePushNotifications(user.id);
      } else {
        await supabase.auth.signOut();
        throw new Error("Profile not found.");
      }
    } catch (error: any) {
      console.error('[AUTH] Login error:', error);

      // Diagnostic: Test connection on failure
      const connTest = await testSupabaseConnection();
      console.log('[AUTH] Connection Diagnostic:', connTest);
      if (!connTest.success) {
        console.error('[AUTH] ❌ Supabase connectivity check failed:', connTest.error);
        toast.error(`Connectivity Issue: ${connTest.error}`);
      }

      setState(prev => ({ ...prev, isLoading: false }));
      toast.error(error.message || "Login failed");
      throw error;
    } finally {
      isProcessingAuth.current = false;
    }
  }, [navigate, fetchUserProfile]);

  const logout = useCallback(async (all?: boolean) => {
    try {
      const loadingToast = toast.loading(all ? 'Logging out of all accounts...' : 'Logging out...');

      if (all) {
        // Log out of all accounts
        const accounts = await getAccountsList();
        for (const acc of accounts) {
          await setActiveAccountId(acc.id);
          await supabase.auth.signOut();
          await removePushToken(acc.id).catch(() => { });
        }
        await setActiveAccountId(null);
        await saveAccountsList([]);
        setState({ user: null, accounts: [], activeAccountId: null, isAuthenticated: false, isLoading: false });
      } else if (state.user) {
        // Log out current account only
        const userId = state.user.id;
        await supabase.auth.signOut();
        await removePushToken(userId).catch(() => { });

        // IMPORTANT: We NO LONGER filter out the account from the list here.
        // We want the account card to stick around on the login page.
        // The session is removed from storage by Supabase, so the account is effectively "logged out".

        await setActiveAccountId(null);
        setState(prev => ({
          ...prev,
          user: null,
          activeAccountId: null,
          isAuthenticated: false,
          isLoading: false
        }));
      }

      // Set logout flag to prevent auto-signin on next app start
      await Preferences.set({ key: 'myvidyon-logged-out', value: 'true' });

      toast.success('Logged out successfully', { id: loadingToast });
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
      navigate('/login');
    }
  }, [navigate, state.user, state.accounts]);

  // Listen for WebSocket authentication errors for immediate revocation
  useEffect(() => {
    const handleWsAuthError = () => {
      console.error('🛑 [AUTH] WebSocket authentication error - forcing logout');
      logout();
      toast.error('Session Expired', { description: 'Security verification failed. Please login again.' });
    };

    window.addEventListener('websocket:auth_error', handleWsAuthError);
    return () => window.removeEventListener('websocket:auth_error', handleWsAuthError);
  }, [logout]);

  const forgetAccount = useCallback(async (userId: string) => {
    try {
      // 1. If it's the current user, log out first
      if (state.user?.id === userId) {
        await logout();
      }

      // 2. Remove session from storage
      await setActiveAccountId(userId);
      await capacitorStorage.removeItem('myvidyon-auth-session');
      await setActiveAccountId(null);

      // 3. Remove credentials from storage
      const account = state.accounts.find(a => a.id === userId);
      if (account) {
        const credsKey = `creds_${account.email.toLowerCase().trim()}`;
        await Preferences.remove({ key: credsKey });
      }

      // 4. Remove from accounts list
      const remainingAccounts = state.accounts.filter(a => a.id !== userId);
      setState(prev => ({ ...prev, accounts: remainingAccounts }));
      await saveAccountsList(remainingAccounts);

      toast.success("Account forgotten from this device");
    } catch (error) {
      console.error('[AUTH] Forget error:', error);
      toast.error("Failed to remove account");
    }
  }, [state.user, state.accounts, logout]);

  const switchAccount = useCallback(async (userId: string) => {
    try {
      console.log('[AUTH] ===== SWITCH ACCOUNT STARTED =====');
      console.log('[AUTH] Target userId:', userId);
      console.log('[AUTH] Current activeAccountId:', state.activeAccountId);
      console.log('[AUTH] Current isAuthenticated:', state.isAuthenticated);

      console.log('[AUTH] Set isSwitchingAccount flag to true');

      // Guard: Don't switch if already on this account AND authenticated
      if (userId === state.activeAccountId && state.user?.id === userId && state.isAuthenticated) {
        console.log('[AUTH] Already authenticated with this account, just navigating to dashboard');
        if (state.user) {
          navigate(ROLE_ROUTES[state.user.role]);
        }
        // Release lock shortly after
        setTimeout(() => { isSwitchingAccount.current = false; }, 1000);
        return;
      }

      // Clear logout flag when switching accounts
      try {
        await Preferences.remove({ key: 'myvidyon-logged-out' });
        console.log('[AUTH] Logout flag cleared');
      } catch (e) {
        console.error('[AUTH] Failed to clear logout flag', e);
      }

      setState(prev => ({ ...prev, isLoading: true }));

      // 1. Set Active ID first
      await setActiveAccountId(userId);
      console.log('[AUTH] Active account ID set to:', userId);

      // 2. Try to find session in storage or memory
      // We rely on Supabase's 'setSession' to restore the authentication state
      // but we need the specific refresh token for *this* user.
      // If we are merely switching, supabase might still have the *old* session or *no* session in memory.

      const savedSessionStr = await capacitorStorage.getItem('myvidyon-auth-session');
      let restoredSession = null;

      if (savedSessionStr) {
        try {
          const session = JSON.parse(savedSessionStr);
          if (session && session.user && session.user.id === userId) {
            console.log('[AUTH] Valid session found in storage for target user');
            restoredSession = session;
          }
        } catch (e) { console.error('Error parsing saved session', e); }
      }

      if (restoredSession) {
        console.log('[AUTH] Restoring session via setSession...');
        const { error } = await supabase.auth.setSession(restoredSession);
        if (error) throw error;
      } else {
        // If no stored session, we hope supabase auto-recover or we might need to re-login
        console.log('[AUTH] No stored session found for user. Assuming previous session valid or using current.');
        // Use refreshSession if possible? or existing logic?
        // Proceeding to fetch profile using CURRENT session in hopes it matches or we just set it
      }

      // 3. Fetch Profile Verification
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error("No active session established for this account.");
      }

      if (currentSession.user.id !== userId) {
        // This happens if setSession failed to switch user
        console.warn('[AUTH] Session user mismatch! Expected', userId, 'got', currentSession.user.id);
        // throw new Error("Session mismatch - please prompt login");
        // Fallback: If mismatch, maybe we need to resign in?
        // For now, let's proceed and see if fetchUserProfile can handle it? No, unsafe.
      }

      const user = await fetchUserProfile(userId, currentSession.user.email!);

      if (user) {
        setState(prev => ({
          ...prev,
          user,
          accounts: prev.accounts.map(a => a.id === user.id ? user : a), // Update existing
          activeAccountId: user.id,
          isAuthenticated: true,
          isLoading: false
        }));

        console.log('[AUTH] Navigating to:', ROLE_ROUTES[user.role]);
        navigate(ROLE_ROUTES[user.role]);
        toast.success(`Switched to ${user.name}`);

        // Initialize push notifications
        try {
          await initializePushNotifications(user.id);
        } catch (error) {
          console.error('[AUTH] Push notification init failed:', error);
        }

        // Clear switching flag after extended delay to ensure all route/auth events settle
        // "Immediately unmount Profile Switcher" -> done by navigate
        console.log('[AUTH] Keeping lock active for 2s to prevent race conditions...');
        setTimeout(() => {
          isSwitchingAccount.current = false;
          console.log('[AUTH] Lock released.');
        }, 2000);

        return;
      } else {
        throw new Error("User profile not found");
      }
    } catch (error: any) {
      console.error('[AUTH] Switch error:', error);
      isSwitchingAccount.current = false;
      setState(prev => ({ ...prev, isLoading: false }));

      // If session restore failed, maybe we need to login again?
      // navigate('/login')?
      toast.error("Could not switch account. Please log in again.");
      throw error;
    }
  }, [fetchUserProfile, navigate, state.activeAccountId, state.user, state.isAuthenticated]);

  const switchRole = useCallback((role: UserRole) => {
    // Only for demo/testing purposes
    const demoUser: User = {
      id: 'DEMO_' + role.toUpperCase(),
      email: `${role}@demo.com`,
      name: `Demo ${role}`,
      role: role,
    };
    setState(prev => ({
      ...prev,
      user: demoUser,
      isAuthenticated: true,
      isLoading: false,
    }));
    navigate(ROLE_ROUTES[role]);
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchAccount, forgetAccount, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
