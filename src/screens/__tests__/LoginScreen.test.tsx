import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

type LoginPayload = {
  email: string;
  password: string;
};

const mockLogin = jest.fn<(payload: LoginPayload) => Promise<void>>();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe('LoginScreen', () => {
  const navigation = {
    navigate: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_AUTH_008 shows alert when email or password is missing', async () => {
    const { getByText } = render(<LoginScreen navigation={navigation} />);

    fireEvent.press(getByText('Login'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing fields',
      'Please enter both email and password.'
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC_AUTH_009 sends trimmed email to login', async () => {
    mockLogin.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), '  user@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });

  it('shows backend error when login fails', async () => {
    mockLogin.mockImplementation(async () => {
      throw new Error('Invalid email or password.');
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpass');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login failed',
        'Invalid email or password.'
      );
    });
  });
});