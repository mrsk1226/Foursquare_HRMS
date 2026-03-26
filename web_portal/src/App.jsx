import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute, RoleBasedRoute } from './components/Layout';

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
  transition: { duration: 0.25, ease: 'easeOut' },
};


function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <motion.div {...pageTransition}>
              <Login />
            </motion.div>
          }
        />
        <Route
          path="/access-denied"
          element={
            <motion.div {...pageTransition}>
              <AccessDenied />
            </motion.div>
          }
        />
        <Route
          path="/change-password"
          element={
            <motion.div {...pageTransition}>
              <ChangePassword />
            </motion.div>
          }
        />
        <Route
          path="/reset-password"
          element={
            <motion.div {...pageTransition}>
              <ChangePassword />
            </motion.div>
          }
        />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={
              <motion.div {...pageTransition}>
                <Dashboard />
              </motion.div>
            }
          />
          <Route
            path="/welcome"
            element={
              <motion.div {...pageTransition}>
                <Welcome />
              </motion.div>
            }
          />
          
          {/* Routes accessible by all roles */}
          <Route
            path="/announcements"
            element={
              <motion.div {...pageTransition}>
                <Announcements />
              </motion.div>
            }
          />
          <Route
            path="/attendance"
            element={
              <motion.div {...pageTransition}>
                <Attendance />
              </motion.div>
            }
          />
          <Route
            path="/leaves"
            element={
              <motion.div {...pageTransition}>
                <LeaveManagement />
              </motion.div>
            }
          />
          <Route
            path="/manager-approvals"
            element={
              <RoleBasedRoute allowedRoles={['manager']}>
                <motion.div {...pageTransition}>
                  <ManagerApprovals />
                </motion.div>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <motion.div {...pageTransition}>
                <Payroll />
              </motion.div>
            }
          />
          <Route
            path="/expenses"
            element={
              <motion.div {...pageTransition}>
                <Expenses />
              </motion.div>
            }
          />

          {/* New accessible to all but previously restricted */}
          <Route
            path="/profile"
            element={
              <motion.div {...pageTransition}>
                <MyProfile />
              </motion.div>
            }
          />
          <Route
            path="/hr-contact"
            element={
              <motion.div {...pageTransition}>
                <HRContact />
              </motion.div>
            }
          />

          {/* HR & Admin Only Routes */}
          <Route
            path="/employees"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
                <motion.div {...pageTransition}>
                  <Employees />
                </motion.div>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
                <motion.div {...pageTransition}>
                  <Performance />
                </motion.div>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
                <motion.div {...pageTransition}>
                  <Onboarding />
                </motion.div>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
                <motion.div {...pageTransition}>
                  <Reports />
                </motion.div>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'md', 'hr']}>
                <motion.div {...pageTransition}>
                  <Settings />
                </motion.div>
              </RoleBasedRoute>
            }
          />

          {/* Admin Only Route */}
          <Route
            path="/workflow"
            element={
              <AdminRoute>
                <motion.div {...pageTransition}>
                  <Workflow />
                </motion.div>
              </AdminRoute>
            }
          />
        </Route>


        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AnimatedRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
