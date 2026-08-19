import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import { tokenStore } from '@/lib/token-store';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!tokenStore.getAccessToken()) {
          const refreshed = await authApi.refresh();
          if (!refreshed) {
            setIsLoading(false);
            return;
          }
          setUser(refreshed.user);
          connectSocket();
          setIsLoading(false);
          return;
        }
        const me = await authApi.me();
        setUser(me);
        connectSocket();
      } catch {
        tokenStore.clear();
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      disconnectSocket();
      queryClient.clear();
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.login(email, password);
    tokenStore.setAccessToken(result.accessToken);
    setUser(result.user);
    connectSocket();
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      tokenStore.clear();
    }
    disconnectSocket();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refreshUser }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
