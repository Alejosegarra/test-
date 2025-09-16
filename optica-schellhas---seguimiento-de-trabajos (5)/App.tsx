
import React, { useState, useCallback, useMemo, createContext, useContext, useEffect } from 'react';
import type { User, AuthContextType } from './types';
import { apiLogin } from './services/api';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { CheckCircleIcon, XIcon, AlertTriangleIcon } from './components/common/Icons';

// --- Toast (Notification) Context ---
type ToastMessage = { id: number; message: string; type: 'success' | 'error' };
type ToastContextType = {
  addToast: (message: string, type?: 'success' | 'error') => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);
  
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-[100] w-full max-w-sm space-y-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex items-start p-4 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            <div className="flex-shrink-0">
                {toast.type === 'success' ? <CheckCircleIcon className="h-6 w-6" /> : <AlertTriangleIcon className="h-6 w-6"/>}
            </div>
            <div className="ml-3 flex-1">
                <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- Theme Context ---
type Theme = 'light' | 'dark';
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// --- Refresh Context ---
type RefreshContextType = {
  refreshKey: number;
  triggerRefresh: () => void;
};

const RefreshContext = createContext<RefreshContextType | null>(null);

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};

const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { addToast } = useToast();

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    addToast('Datos actualizados.', 'success');
  }, [addToast]);

  const value = useMemo(() => ({ refreshKey, triggerRefresh }), [refreshKey, triggerRefresh]);

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
};


// --- Auth Context ---
const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const login = useCallback(async (username: string, password: string): Promise<User | null> => {
    setLoading(true);
    try {
      const user = await apiLogin(username, password);
      if (user) {
        setCurrentUser(user);
        addToast(`Bienvenido, ${user.username}!`);
        return user;
      } else {
        addToast('Credenciales inválidas.', 'error');
        setCurrentUser(null);
        return null;
      }
    } catch (error) {
      console.error("Login failed", error);
      addToast('Ocurrió un error al iniciar sesión.', 'error');
      setCurrentUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    addToast('Sesión cerrada exitosamente.');
  }, [addToast]);

  const value = useMemo(() => ({ currentUser, login, logout }), [currentUser, login, logout]);

  if (loading && !currentUser) {
     return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-slate-900">
            <div className="text-xl font-semibold text-gray-700 dark:text-slate-300">Cargando...</div>
        </div>
     )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


function App() {
  return (
    <ThemeProvider>
        <ToastProvider>
          <RefreshProvider>
            <AuthProvider>
              <Main />
            </AuthProvider>
          </RefreshProvider>
        </ToastProvider>
    </ThemeProvider>
  );
}

const Main: React.FC = () => {
    const { currentUser } = useAuth();
    return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
            {currentUser ? <Dashboard /> : <LoginScreen />}
        </div>
    )
}

export default App;