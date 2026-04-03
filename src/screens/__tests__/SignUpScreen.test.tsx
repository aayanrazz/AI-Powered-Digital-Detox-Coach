import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../SignUpScreen';

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

const mockRegister = jest.fn<(payload: RegisterPayload) => Promise<void>>();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}));

describe('SignUpScreen', () => {
  const navigation = {
    goBack: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_AUTH_010 shows alert when fields are missing', async () => {
    const { getByText } = render(<SignUpScreen navigation={navigation} />);

    fireEvent.press(getByText('Create Account'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing fields',
      'Please fill in all fields.'
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('TC_AUTH_011 sends trimmed name and email to register', async () => {
    mockRegister.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <SignUpScreen navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Full name'), '  Aayan  ');
    fireEvent.changeText(getByPlaceholderText('Email'), '  aayan@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Aayan',
        email: 'aayan@example.com',
        password: 'password123',
      });
    });
  });

  it('shows backend error when signup fails', async () => {
    mockRegister.mockImplementation(async () => {
      throw new Error('Email already exists.');
    });

    const { getByPlaceholderText, getByText } = render(
      <SignUpScreen navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Full name'), 'Aayan');
    fireEvent.changeText(getByPlaceholderText('Email'), 'aayan@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign up failed',
        'Email already exists.'
      );
    });
  });
});