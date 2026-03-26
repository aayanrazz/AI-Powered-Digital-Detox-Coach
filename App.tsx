import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationService';
import {
  consumeInitialNotificationPress,
  flushPendingNotificationPress,
  initializeNotifications,
  registerForegroundNotificationEvents,
} from './src/services/notificationService';
import {
  resetDetoxNotificationSync,
  syncDetoxNotifications,
} from './src/services/notificationSyncService';

function NotificationBootstrap() {
  const { loading, token, user } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      void resetDetoxNotificationSync();
      return;
    }

    if (!user?.isOnboarded) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncNow = async () => {
      try {
        await syncDetoxNotifications();
      } catch {
        // keep app stable if sync fails
      }
    };

    void syncNow();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncNow();
      }
    });

    intervalId = setInterval(() => {
      void syncNow();
    }, 60000);

    return () => {
      subscription.remove();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loading, token, user?.isOnboarded]);

  return null;
}

export default function App() {
  useEffect(() => {
    void initializeNotifications();
    void consumeInitialNotificationPress();

    const unsubscribe = registerForegroundNotificationEvents();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NotificationBootstrap />
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            void flushPendingNotificationPress();
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}