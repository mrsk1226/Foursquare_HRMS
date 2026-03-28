import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase_client';
import { Lock, Mail, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const MotionDiv = motion.div;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_40%,#0f2d55_70%,#0a1628_100%)] flex items-center justify-center p-4"
    >
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0px 1000px rgba(30,58,95,0.9) inset !important;
          -webkit-text-fill-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        input::placeholder {
          color: rgba(255,255,255,0.45) !important;
        }
      `}</style>
      {/* Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(59,130,246,0.15)_0%,transparent_60%)]" />

      <MotionDiv
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative max-w-md w-full rounded-[20px] border border-white/12 bg-white/7 backdrop-blur-[20px] overflow-hidden shadow-2xl"
      >
        <div className="p-10 flex flex-col items-center justify-center text-center">
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <img 
              src="/images/4square_white.png" 
              alt="Foursquare Logo" 
              className="h-[56px] w-auto object-contain"
            />
          </MotionDiv>

          <div className="w-full">
            <div className="mb-8 text-center text-white">
              <h1 className="text-3xl font-black">Welcome Back</h1>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-6 text-sm text-center border border-red-500/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!showForgot ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-blue-100 mb-2 underline underline-offset-4 decoration-blue-500/30">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-white/50" />
                      </div>
                      <input
                        type="email"
                        required
                        className="block w-full pl-10 pr-3 py-3 border border-white/15 rounded-lg focus:ring-0 focus:border-blue-400/80 transition-all bg-white/10 text-white placeholder-white/45 caret-white outline-none"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        placeholder="you@foursquare.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-100 mb-2 underline underline-offset-4 decoration-blue-500/30">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-white/50" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="block w-full pl-10 pr-12 py-3 border border-white/15 rounded-lg focus:ring-0 focus:border-blue-400/80 transition-all bg-white/10 text-white placeholder-white/45 caret-white outline-none"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs font-bold text-[#60a5fa] hover:text-blue-300 transition-colors"
                    >
                      Forgot Password?
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Please contact your HR/Admin to get your login credentials.')}
                      className="text-xs font-bold text-[#60a5fa] hover:text-blue-300 transition-colors"
                    >
                      Find my User ID
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SIGN IN'}
                  </button>
                </>
              ) : (
                <div className="animate-in fade-in duration-300">
                  {resetSent ? (
                    <div className="text-center space-y-4">
                      <div className="bg-green-500/10 text-green-400 p-4 rounded-lg text-sm font-medium border border-green-500/20">
                        Password reset email sent! Check your inbox.
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowForgot(false); setResetSent(false); }}
                        className="text-sm font-bold text-blue-400 hover:underline"
                      >
                        Return to Login
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-200">
                        <ArrowLeft className="h-4 w-4" />
                        Password reset
                      </div>
                      <p className="text-sm text-blue-300/60 text-center">Enter your email and we&apos;ll send you a link to reset your password.</p>
                      <div>
                        <input
                          type="email"
                          required
                          className="block w-full px-3 py-3 border border-white/15 rounded-lg focus:ring-0 focus:border-blue-400/80 bg-white/10 text-white placeholder-white/45 caret-white outline-none"
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                          placeholder="you@foursquare.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={handleForgotSubmit}
                          disabled={isLoading}
                          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SEND RESET LINK'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowForgot(false)}
                          className="text-sm text-blue-300/40 hover:text-blue-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
            
            <div className="mt-8 border-t border-white/5 pt-6 text-center">
              <p className="font-bold mb-1" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>Internal Human Resources Management System</p>
              <div className="font-black uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                FOUR SQUARE GROUP
              </div>
            </div>
          </div>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
};

export default Login;
