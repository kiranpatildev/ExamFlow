import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LOGIN_ROUTES = {
  scanning_staff: '/login/scanning',
  teacher: '/login/teacher',
  exam_dept: '/login/exam-dept',
};

export default function ProtectedRoute({ children, requiredRole }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to={LOGIN_ROUTES[requiredRole] || '/login/scanning'} replace />;
  }

  if (requiredRole && auth.role !== requiredRole) {
    // Wrong role — redirect to their correct portal
    const correctRoute = LOGIN_ROUTES[auth.role] || '/login/scanning';
    return <Navigate to={correctRoute} replace />;
  }

  return children;
}
