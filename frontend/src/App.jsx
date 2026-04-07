import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Login pages
import ScanLogin from './pages/scanning/ScanLogin';
import TeacherLogin from './pages/teacher/TeacherLogin';
import ExamLogin from './pages/examdept/ExamLogin';

// Scanning staff pages
import SessionCreate from './pages/scanning/SessionCreate';
import ImageUpload from './pages/scanning/ImageUpload';
import BundleReview from './pages/scanning/BundleReview';

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import EvaluationScreen from './pages/teacher/EvaluationScreen';

// Exam dept pages
import ExamDashboard from './pages/examdept/ExamDashboard';
import AssignTeacher from './pages/examdept/AssignTeacher';
import SchemeManager from './pages/examdept/SchemeManager';
import Reports from './pages/examdept/Reports';
import UserManagement from './pages/examdept/UserManagement';

function RootRedirect() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login/scanning" replace />;
  const paths = {
    scanning_staff: '/scanning',
    teacher: '/teacher',
    exam_dept: '/exam-dept',
  };
  return <Navigate to={paths[auth.role] || '/login/scanning'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Login routes */}
          <Route path="/login/scanning" element={<ScanLogin />} />
          <Route path="/login/teacher" element={<TeacherLogin />} />
          <Route path="/login/exam-dept" element={<ExamLogin />} />

          {/* Scanning Staff routes */}
          <Route path="/scanning" element={
            <ProtectedRoute requiredRole="scanning_staff">
              <SessionCreate />
            </ProtectedRoute>
          } />
          <Route path="/scanning/upload/:bundleId" element={
            <ProtectedRoute requiredRole="scanning_staff">
              <ImageUpload />
            </ProtectedRoute>
          } />
          <Route path="/scanning/review/:bundleId" element={
            <ProtectedRoute requiredRole="scanning_staff">
              <BundleReview />
            </ProtectedRoute>
          } />

          {/* Teacher routes */}
          <Route path="/teacher" element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          } />
          <Route path="/teacher/evaluate/:sheetId" element={
            <ProtectedRoute requiredRole="teacher">
              <EvaluationScreen />
            </ProtectedRoute>
          } />

          {/* Exam dept routes */}
          <Route path="/exam-dept" element={
            <ProtectedRoute requiredRole="exam_dept">
              <ExamDashboard />
            </ProtectedRoute>
          } />
          <Route path="/exam-dept/assign" element={
            <ProtectedRoute requiredRole="exam_dept">
              <AssignTeacher />
            </ProtectedRoute>
          } />
          <Route path="/exam-dept/users" element={
            <ProtectedRoute requiredRole="exam_dept">
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="/exam-dept/schemes" element={
            <ProtectedRoute requiredRole="exam_dept">
              <SchemeManager />
            </ProtectedRoute>
          } />
          <Route path="/exam-dept/reports" element={
            <ProtectedRoute requiredRole="exam_dept">
              <Reports />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
