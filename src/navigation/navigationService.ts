import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (!navigationRef.isReady()) {
    return;
  }

  (navigationRef as any).navigate(name, params);
}