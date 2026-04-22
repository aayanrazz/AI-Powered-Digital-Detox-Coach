import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/appConfig';
import {
  handleAuthSessionExpired,
  isAuthSessionError,
  isAuthSessionMessage,
} from '../utils/authSession';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function http<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    headers: extraHeaders = {},
  } = options;

  const token = auth
    ? await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN)
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    APP_CONFIG.API_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const message =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : `Request failed with status ${response.status}`;

      if (auth && (response.status === 401 || isAuthSessionMessage(message))) {
        throw await handleAuthSessionExpired(message);
      }

      throw new Error(message);
    }

    return data as T;
  } catch (error: any) {
    if (isAuthSessionError(error)) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new Error(
        'Request timed out. Check that your backend is running on port 5000 and that your phone can reach the backend.'
      );
    }

    if (
      String(error?.message || '').includes('Network request failed') ||
      error instanceof TypeError
    ) {
      throw new Error(
        'Network request failed. Make sure the backend is running on port 5000 and that the device can reach the backend API.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}