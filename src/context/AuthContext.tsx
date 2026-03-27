import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/appConfig';
import { api } from '../api/api';
import { LoginPayload, RegisterPayload, User } from '../types';

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserDirect: (user: User | null) => void;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

async function clearAuthStorage() {
  await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
  await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
}

async function persistUser(user: User | null) {
  if (!user) {
    await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
    return;
  }

  await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
}

function parseStoredUser(raw: string | null): User | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshUser = React.useCallback(async () => {
    const me = await api.getMe();
    setUser(me.user);
    await persistUser(me.user);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
        const savedUserRaw = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);

        const tokenValue = savedToken || null;
        const parsedUser = parseStoredUser(savedUserRaw || null);

        if (!isMounted) {
          return;
        }

        if (tokenValue) {
          setToken(tokenValue);
        }

        if (parsedUser) {
          setUser(parsedUser);
        } else if (savedUserRaw) {
          await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
        }

        if (!tokenValue) {
          setLoading(false);
          return;
        }

        if (parsedUser) {
          setLoading(false);
          refreshUser().catch(() => {
            // keep cached user so app opens even if backend is temporarily unreachable
          });
          return;
        }

        await refreshUser();
      } catch {
        await clearAuthStorage();

        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap().catch(async () => {
      await clearAuthStorage();

      if (isMounted) {
        setToken(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshUser]);

  const login = React.useCallback(async (payload: LoginPayload) => {
    const data = await api.login(payload);

    setToken(data.token);
    setUser(data.user);

    await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.token);
    await persistUser(data.user);
  }, []);

  const register = React.useCallback(
    async (payload: RegisterPayload) => {
      const data = await api.register(payload);

      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);

        await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.token);
        await persistUser(data.user);
        return;
      }

      await login({ email: payload.email, password: payload.password });
    },
    [login]
  );

  const logout = React.useCallback(async () => {
    await clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  const setUserDirect = React.useCallback((nextUser: User | null) => {
    setUser(nextUser);
    persistUser(nextUser).catch(() => {
      // ignore storage update failures for manual local user updates
    });
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUserDirect,
    }),
    [loading, login, logout, refreshUser, register, setUserDirect, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}