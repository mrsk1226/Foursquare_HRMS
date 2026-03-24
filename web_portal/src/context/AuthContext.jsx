import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase_client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      
      if (_event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user);
        }
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
    console.log('Fetching profile for user:', currentUser.email);
    
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), 3000);
    });

    const fetchPromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    try {
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.timeout) {
        console.warn('Profile fetch timed out after 3 seconds. Using fallback.');
        setProfile({
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.email === 'santhoshfoursquare@gmail.com' ? 'admin' : 'employee',
          employee_id: 'TEMP123'
        });
        return;
      }

      const { data, error } = result;
        
      if (error && error.code !== 'PGRST116') {
        console.error('Database error fetching profile:', error);
        throw error;
      }
      
      if (data) {
        console.log('Profile fetched successfully:', data);
        setProfile(data);
        
        // Forced Password Change Redirect
        if (data.must_change_password && window.location.pathname !== '/change-password') {
          window.location.href = '/change-password';
        }
      } else {

        console.warn('No profile found in database. Using fallback.');
        setProfile({
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.email === 'santhoshfoursquare@gmail.com' ? 'admin' : 'employee',
          employee_id: 'TEMP123'
        });
      }
    } catch (error) {
      console.error('Error in profile fetch logic:', error.message);
      setProfile({
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.email === 'santhoshfoursquare@gmail.com' ? 'admin' : 'employee',
        employee_id: 'TEMP123'
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
