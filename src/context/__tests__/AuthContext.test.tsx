import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../api/api';
import * as authSession from '../../utils/authSession';

jest.mock('../../api/api', () => ({
  api: {
    getMe: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  },
}));

jest.mock('../../utils/authSession', () => ({
  clearStoredAuthSession: jest.fn(),
  isAuthSessionError: jest.fn(),
  registerAuthSessionExpiredHandler: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedAuthSession = authSession as jest.Mocked<typeof authSession>;

function TestHarness() {
  const {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
  } = useAuth();

  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="token">{token ?? ''}</Text>
      <Text testID="email">{user?.email ?? ''}</Text>
      <Text testID="name">{user?.name ?? ''}</Text>

      <Pressable
        testID="login-btn"
        onPress={() => login({ email: ' login@example.com ', password: 'password123' })}
      >
        <Text>login</Text>
      </Pressable>

      <Pressable
        testID="register-btn"
        onPress={() =>
          register({
            name: ' New User ',
            email: ' new@example.com ',
            password: 'password123',
          })
        }
      >
        <Text>register</Text>
      </Pressable>

      <Pressable testID="logout-btn" onPress={() => logout()}>
        <Text>logout</Text>
      </Pressable>

      <Pressable testID="refresh-btn" onPress={() => refreshUser()}>
        <Text>refresh</Text>
      </Pressable>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    mockedAuthSession.clearStoredAuthSession.mockResolvedValue();
    mockedAuthSession.isAuthSessionError.mockReturnValue(false);
    mockedAuthSession.registerAuthSessionExpiredHandler.mockImplementation(
      () => jest.fn()
    );
  });

  it('TC_AUTH_001 restores saved session on bootstrap and refreshes user', async () => {
    await AsyncStorage.setItem('detox_token', 'saved-token');
    await AsyncStorage.setItem(
      'detox_user',
      JSON.stringify({ email: 'cached@example.com', name: 'Cached User' })
    );

    mockedApi.getMe.mockResolvedValue({
      user: { email: 'fresh@example.com', name: 'Fresh User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    expect(getByTestId('token').props.children).toBe('saved-token');
    expect(getByTestId('email').props.children).toBe('fresh@example.com');
    expect(getByTestId('name').props.children).toBe('Fresh User');
    expect(mockedApi.getMe).toHaveBeenCalledTimes(1);
  });

  it('TC_AUTH_002 login saves token and user', async () => {
    mockedApi.login.mockResolvedValue({
      token: 'login-token',
      user: { email: 'login@example.com', name: 'Login User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('login-token');
    });

    expect(getByTestId('email').props.children).toBe('login@example.com');
    expect(await AsyncStorage.getItem('detox_token')).toBe('login-token');

    const storedUser = await AsyncStorage.getItem('detox_user');
    expect(storedUser).toContain('login@example.com');
  });

  it('TC_AUTH_003 register saves token and user when register returns auth data', async () => {
    mockedApi.register.mockResolvedValue({
      token: 'register-token',
      user: { email: 'new@example.com', name: 'New User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    fireEvent.press(getByTestId('register-btn'));

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('register-token');
    });

    expect(getByTestId('email').props.children).toBe('new@example.com');
    expect(await AsyncStorage.getItem('detox_token')).toBe('register-token');
  });

  it('TC_AUTH_004 register falls back to login when register returns no token/user', async () => {
    mockedApi.register.mockResolvedValue({} as any);
    mockedApi.login.mockResolvedValue({
      token: 'fallback-token',
      user: { email: 'new@example.com', name: 'New User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    fireEvent.press(getByTestId('register-btn'));

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('fallback-token');
    });

    expect(mockedApi.login).toHaveBeenCalledWith({
      email: ' new@example.com ',
      password: 'password123',
    });
  });

  it('TC_AUTH_005 logout clears token and user', async () => {
    mockedApi.login.mockResolvedValue({
      token: 'login-token',
      user: { email: 'login@example.com', name: 'Login User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('login-token');
    });

    fireEvent.press(getByTestId('logout-btn'));

    await waitFor(() => {
      expect(mockedAuthSession.clearStoredAuthSession).toHaveBeenCalled();
    });

    expect(getByTestId('token').props.children).toBe('');
    expect(getByTestId('email').props.children).toBe('');
  });

  it('TC_AUTH_006 refreshUser updates current user from API', async () => {
    mockedApi.getMe
      .mockResolvedValueOnce({
        user: { email: 'initial@example.com', name: 'Initial User' } as any,
      })
      .mockResolvedValueOnce({
        user: { email: 'updated@example.com', name: 'Updated User' } as any,
      });

    await AsyncStorage.setItem('detox_token', 'saved-token');
    await AsyncStorage.setItem(
      'detox_user',
      JSON.stringify({ email: 'cached@example.com', name: 'Cached User' })
    );

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('email').props.children).toBe('initial@example.com');
    });

    fireEvent.press(getByTestId('refresh-btn'));

    await waitFor(() => {
      expect(getByTestId('email').props.children).toBe('updated@example.com');
    });
  });

  it('TC_AUTH_007 refreshUser clears session when auth session expires', async () => {
    await AsyncStorage.setItem('detox_token', 'saved-token');
    await AsyncStorage.setItem(
      'detox_user',
      JSON.stringify({ email: 'cached@example.com', name: 'Cached User' })
    );

    mockedApi.getMe.mockResolvedValueOnce({
      user: { email: 'initial@example.com', name: 'Initial User' } as any,
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('email').props.children).toBe('initial@example.com');
    });

    mockedApi.getMe.mockRejectedValueOnce(new Error('Session expired'));
    mockedAuthSession.isAuthSessionError.mockReturnValue(true);

    fireEvent.press(getByTestId('refresh-btn'));

    await waitFor(() => {
      expect(mockedAuthSession.clearStoredAuthSession).toHaveBeenCalled();
    });

    expect(getByTestId('token').props.children).toBe('');
    expect(getByTestId('email').props.children).toBe('');
  });
});