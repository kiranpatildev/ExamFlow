import React, { Component } from 'react';
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
import TeacherBundleDetail from './pages/teacher/TeacherBundleDetail';
import EvaluationScreen from './pages/teacher/EvaluationScreen';

// Exam dept pages
import ExamDashboard from './pages/examdept/ExamDashboard';
import AssignTeacher from './pages/examdept/AssignTeacher';
import SchemeManager from './pages/examdept/SchemeManager';
import Reports from './pages/examdept/Reports';
import UserManagement from './pages/examdept/UserManagement';

// ─── Root Error Boundary ──────────────────────────────────────────────────────
// Catches any React render crash and shows a readable error instead of blank page
class RootErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fef2f2', padding: '40px', fontFamily: 'system-ui',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
        <h1 style={{ color: '#991b1b', marginBottom: '8px', fontSize: '22px' }}>Application Error</h1>
        <p style={{ color: '#dc2626', maxWidth: '600px', textAlign: 'center', marginBottom: '16px', lineHeight: 1.6 }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <pre style={{
          background: '#fff', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '14px', maxWidth: '700px', width: '100%',
          fontSize: '12px', color: '#991b1b', overflow: 'auto',
          maxHeight: '180px', marginBottom: '24px', textAlign: 'left',
        }}>
          {this.state.error?.stack}
        </pre>
        <button
          style={{
            padding: '10px 28px', background: '#1a202c', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
          }}
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    );
  }
}

// ─── Root Redirect ────────────────────────────────────────────────────────────
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#1a202c',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
              },
              success: { iconTheme: { primary: '#38a169', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#e53e3e', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            {/* Login */}
            <Route path="/login/scanning"  element={<ScanLogin />} />
            <Route path="/login/teacher"   element={<TeacherLogin />} />
            <Route path="/login/exam-dept" element={<ExamLogin />} />

            {/* Scanning Staff */}
            <Route path="/scanning" element={
              <ProtectedRoute requiredRole="scanning_staff"><SessionCreate /></ProtectedRoute>
            } />
            <Route path="/scanning/upload/:bundleId" element={
              <ProtectedRoute requiredRole="scanning_staff"><ImageUpload /></ProtectedRoute>
            } />
            <Route path="/scanning/review/:bundleId" element={
              <ProtectedRoute requiredRole="scanning_staff"><BundleReview /></ProtectedRoute>
            } />

            {/* Teacher */}
            <Route path="/teacher" element={
              <ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>
            } />
            <Route path="/teacher/bundle/:bundleId" element={
              <ProtectedRoute requiredRole="teacher"><TeacherBundleDetail /></ProtectedRoute>
            } />
            <Route path="/teacher/evaluate/:sheetId" element={
              <ProtectedRoute requiredRole="teacher"><EvaluationScreen /></ProtectedRoute>
            } />

            {/* Exam Department */}
            <Route path="/exam-dept" element={
              <ProtectedRoute requiredRole="exam_dept"><ExamDashboard /></ProtectedRoute>
            } />
            <Route path="/exam-dept/assign" element={
              <ProtectedRoute requiredRole="exam_dept"><AssignTeacher /></ProtectedRoute>
            } />
            <Route path="/exam-dept/users" element={
              <ProtectedRoute requiredRole="exam_dept"><UserManagement /></ProtectedRoute>
            } />
            <Route path="/exam-dept/schemes" element={
              <ProtectedRoute requiredRole="exam_dept"><SchemeManager /></ProtectedRoute>
            } />
            <Route path="/exam-dept/reports" element={
              <ProtectedRoute requiredRole="exam_dept"><Reports /></ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  );
}
