import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (!navigationRef.isReady()) {
    return;
  }

  (navigationRef as any).navigate(name, params);
}

export function goBack() {
  if (!navigationRef.isReady()) {
    return;
  }

  if (navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}