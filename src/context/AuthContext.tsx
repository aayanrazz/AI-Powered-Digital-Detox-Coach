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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
        const savedUser = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);

        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
          }
        }

        if (savedToken) {
          setToken(savedToken);

          try {
            const me = await api.getMe();
            setUser(me.user);

            await AsyncStorage.setItem(
              APP_CONFIG.STORAGE_KEYS.USER,
              JSON.stringify(me.user)
            );
          } catch {
            await clearAuthStorage();
            setToken(null);
            setUser(null);
          }
        }
      } catch {
        await clearAuthStorage();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (payload: LoginPayload) => {
    const data = await api.login(payload);

    setToken(data.token);
    setUser(data.user);

    await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.token);
    await AsyncStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.USER,
      JSON.stringify(data.user)
    );
  };

  const register = async (payload: RegisterPayload) => {
    const data = await api.register(payload);

    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);

      await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.token);
      await AsyncStorage.setItem(
        APP_CONFIG.STORAGE_KEYS.USER,
        JSON.stringify(data.user)
      );
      return;
    }

    await login({ email: payload.email, password: payload.password });
  };

  const logout = async () => {
    await clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.getMe();
    setUser(me.user);
    await AsyncStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.USER,
      JSON.stringify(me.user)
    );
  };

  const setUserDirect = (nextUser: User | null) => {
    setUser(nextUser);
  };

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
    [user, token, loading]
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