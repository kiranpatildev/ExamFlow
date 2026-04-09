import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// ---------- tab-session helpers ----------
// sessionStorage is isolated per browser tab.
// A brand-new tab starts with empty sessionStorage, so even if
// localStorage contains tokens from another tab the user must
// log in again — preventing silent cross-tab session sharing.
const TAB_KEY = 'examflow_tab_authenticated';

function isTabAuthenticated() {
  return sessionStorage.getItem(TAB_KEY) === 'true';
}

function setTabAuthenticated() {
  sessionStorage.setItem(TAB_KEY, 'true');
}

function clearTabAuthenticated() {
  sessionStorage.removeItem(TAB_KEY);
}
// -----------------------------------------

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    // Only restore session if THIS tab explicitly set the flag.
    // Page refresh preserves sessionStorage, so the user stays  
    // logged in after F5 — but a new tab starts fresh.
    if (!isTabAuthenticated()) return null;

    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const role = localStorage.getItem('role');
    const fullName = localStorage.getItem('full_name');
    if (token && role) {
      return { token, refreshToken, role, fullName };
    }
    return null;
  });

  const login = useCallback((data) => {
    const authData = {
      token: data.access,
      refreshToken: data.refresh,
      role: data.role,
      fullName: data.full_name,
    };
    // Persist tokens for silent refresh cycle
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('role', data.role);
    localStorage.setItem('full_name', data.full_name);
    // Mark THIS tab as an active authenticated session
    setTabAuthenticated();
    setAuth(authData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    localStorage.removeItem('full_name');
    // Clear the tab flag so this tab also goes back to login
    clearTabAuthenticated();
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
