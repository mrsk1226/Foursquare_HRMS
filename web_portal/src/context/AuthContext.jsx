import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase_client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (_event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (currentUser) => {
    try {
      // Step 1: profiles table fetch
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileData) {
        // Step 2: employees table - employee_id, full_name, designation fetch
        const empEmail = currentUser.email;
        const { data: empData } = await supabase
          .from('employees')
          .select('employee_id, full_name, designation, department, work_location, photo_url')
          .or(`email.eq.${empEmail},personal_email.eq.${empEmail}`)
          .maybeSingle();

        const designation = empData?.designation?.toLowerCase() ?? '';
        let role = profileData.role ?? 'employee';
        if (designation.includes('hr')) role = 'hr';
        else if (designation.includes('md') || designation.includes('managing director')) role = 'md';
        if (empData?.employee_id === 'FSQ000') role = 'md';
        if (empData?.employee_id === 'FSQ002') role = 'hr';

        const mergedProfile = {
          ...profileData,
          employee_id: empData?.employee_id ?? profileData.employee_id ?? '',
          full_name: empData?.full_name ?? profileData.full_name ?? currentUser.email,
          designation: empData?.designation ?? '',
          department: empData?.department ?? '',
          work_location: empData?.work_location ?? '',
          photo_url: empData?.photo_url ?? '',
          role: role,
        };

        setProfile(mergedProfile);

        if (profileData.must_change_password && window.location.pathname !== '/change-password') {
          window.location.href = '/change-password';
        }
        return;
      }

      // No profile — direct employees table fallback
      const { data: empData } = await supabase
        .from('employees')
        .select('employee_id, full_name, designation, department, work_location, photo_url')
        .or(`email.eq.${currentUser.email},personal_email.eq.${currentUser.email}`)
        .maybeSingle();

      const designation = empData?.designation?.toLowerCase() ?? '';
      let role = 'employee';
      if (designation.includes('hr')) role = 'hr';
      else if (designation.includes('md') || designation.includes('managing director')) role = 'md';
      if (empData?.employee_id === 'FSQ000') role = 'md';
      if (empData?.employee_id === 'FSQ002') role = 'hr';

      setProfile({
        id: currentUser.id,
        email: currentUser.email,
        employee_id: empData?.employee_id ?? '',
        full_name: empData?.full_name ?? currentUser.email,
        designation: empData?.designation ?? '',
        department: empData?.department ?? '',
        work_location: empData?.work_location ?? '',
        photo_url: empData?.photo_url ?? '',
        role: role,
      });

    } catch (error) {
      console.error('Profile fetch error:', error.message);
      // Last resort fallback
      setProfile({
        id: currentUser.id,
        email: currentUser.email,
        employee_id: '',
        full_name: currentUser.email,
        role: 'employee',
      });
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};