import React, { Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute, RoleBasedRoute } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import LeaveManagement from './pages/LeaveManagement';
import Payroll from './pages/Payroll';
import Onboarding from './pages/Onboarding';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MyProfile from './pages/MyProfile';
import HRContact from './pages/HRContact';
import Announcements from './pages/Announcements';
import AccessDenied from './pages/AccessDenied';
import ChangePassword from './pages/ChangePassword';
import Welcome from './pages/Welcome';
import Expenses from './pages/Expenses';
import Performance from './pages/Performance';
import Workflow from './pages/Workflow';
import ManagerApprovals from './pages/ManagerApprovals';

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: "easeOut" }
};


function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/login" element={<ErrorBoundary><motion.div {...pageTransition}><Login /></motion.div></ErrorBoundary>} />
        <Route path="/access-denied" element={<ErrorBoundary><motion.div {...pageTransition}><AccessDenied /></motion.div></ErrorBoundary>} />
        <Route path="/change-password" element={<ErrorBoundary><motion.div {...pageTransition}><ChangePassword /></motion.div></ErrorBoundary>} />
        <Route path="/reset-password" element={<ErrorBoundary><motion.div {...pageTransition}><ChangePassword /></motion.div></ErrorBoundary>} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ErrorBoundary><motion.div {...pageTransition}><Dashboard /></motion.div></ErrorBoundary>} />
          <Route path="/welcome" element={<ErrorBoundary><motion.div {...pageTransition}><Welcome /></motion.div></ErrorBoundary>} />
          
          <Route path="/announcements" element={<ErrorBoundary><motion.div {...pageTransition}><Announcements /></motion.div></ErrorBoundary>} />
          <Route path="/attendance" element={<ErrorBoundary><motion.div {...pageTransition}><Attendance /></motion.div></ErrorBoundary>} />
          <Route path="/leaves" element={<ErrorBoundary><motion.div {...pageTransition}><LeaveManagement /></motion.div></ErrorBoundary>} />
          
          <Route path="/manager-approvals" element={
            <RoleBasedRoute allowedRoles={['manager']}>
              <ErrorBoundary><motion.div {...pageTransition}><ManagerApprovals /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />
          
          <Route path="/payroll" element={<ErrorBoundary><motion.div {...pageTransition}><Payroll /></motion.div></ErrorBoundary>} />
          <Route path="/expenses" element={<ErrorBoundary><motion.div {...pageTransition}><Expenses /></motion.div></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><motion.div {...pageTransition}><MyProfile /></motion.div></ErrorBoundary>} />
          <Route path="/hr-contact" element={<ErrorBoundary><motion.div {...pageTransition}><HRContact /></motion.div></ErrorBoundary>} />

          {/* HR & Admin Only Routes */}
          <Route path="/employees" element={
            <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
              <ErrorBoundary><motion.div {...pageTransition}><Employees /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />
          <Route path="/performance" element={
            <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
              <ErrorBoundary><motion.div {...pageTransition}><Performance /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />
          <Route path="/onboarding" element={
            <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
              <ErrorBoundary><motion.div {...pageTransition}><Onboarding /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />
          <Route path="/reports" element={
            <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
              <ErrorBoundary><motion.div {...pageTransition}><Reports /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />
          <Route path="/settings" element={
            <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
              <ErrorBoundary><motion.div {...pageTransition}><Settings /></motion.div></ErrorBoundary>
            </RoleBasedRoute>
          } />

          {/* Admin Only Route */}
          <Route path="/workflow" element={
            <AdminRoute>
              <ErrorBoundary><motion.div {...pageTransition}><Workflow /></motion.div></ErrorBoundary>
            </AdminRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <MotionConfig transition={{ duration: 0.2 }}>
      <Router>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </Router>
    </MotionConfig>
  );
}

export default App;
