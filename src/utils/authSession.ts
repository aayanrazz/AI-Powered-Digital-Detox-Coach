import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/appConfig';

export const AUTH_SESSION_ERROR_CODE = 'AUTH_SESSION_EXPIRED';

type SessionExpiredHandler = () => Promise<void> | void;

const AUTH_ERROR_PATTERNS = [
  'jwt expired',
  'session expired',
  'invalid session token',
  'invalid token',
  'not authorized',
  'not authorised',
  'missing token',
  'user not found',
];

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let pendingSessionExpiryAction: Promise<void> | null = null;

export class AuthSessionError extends Error {
  code: string;
  status: number;

  constructor(message = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'AuthSessionError';
    this.code = AUTH_SESSION_ERROR_CODE;
    this.status = 401;
  }
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
}

export function isAuthSessionMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return AUTH_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function isAuthSessionError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (code === AUTH_SESSION_ERROR_CODE) {
      return true;
    }
  }

  return isAuthSessionMessage(getErrorMessage(error));
}

export async function clearStoredAuthSession(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN),
    AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER),
  ]);
}

export function registerAuthSessionExpiredHandler(
  handler: SessionExpiredHandler
) {
  sessionExpiredHandler = handler;

  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

export async function handleAuthSessionExpired(
  _reason?: unknown
): Promise<AuthSessionError> {
  const friendlyMessage = 'Your session has expired. Please log in again.';

  if (!pendingSessionExpiryAction) {
    pendingSessionExpiryAction = Promise.resolve(
      sessionExpiredHandler ? sessionExpiredHandler() : clearStoredAuthSession()
    )
      .catch(() => {
        // ignore cleanup failures
      })
      .finally(() => {
        pendingSessionExpiryAction = null;
      });
  }

  await pendingSessionExpiryAction;

  return new AuthSessionError(friendlyMessage);
}