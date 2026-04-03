import React, { useEffect } from 'react';
import { AppState, InteractionManager, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import {
  clearLocalInterventionCooldowns,
  runLocalInterventionCheck,
} from './src/services/interventionService';

function NotificationBootstrap() {
  const { loading, token, user } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      const clearLocalState = async () => {
        try {
          await resetDetoxNotificationSync();
          await clearLocalInterventionCooldowns();
        } catch {
          // ignore cleanup failures while logged out
        }
      };

      clearLocalState().catch(() => {
        // ignore logged-out cleanup failures
      });

      return;
    }

    if (!user?.isOnboarded) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let appStateSubscription: { remove: () => void } | null = null;
    let cancelled = false;

    const syncNow = async () => {
      if (cancelled) {
        return;
      }

      try {
        await syncDetoxNotifications();
        await runLocalInterventionCheck();
      } catch {
        // ignore sync failures to keep app stable
      }
    };

    const delayedStartupSync = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        syncNow().catch(() => {
          // ignore delayed startup sync failures
        });
      }, 1200);
    });

    appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncNow().catch(() => {
          // ignore app-active sync failures
        });
      }
    });

    intervalId = setInterval(() => {
      syncNow().catch(() => {
        // ignore periodic sync failures
      });
    }, 60000);

    return () => {
      cancelled = true;

      delayedStartupSync.cancel();

      if (appStateSubscription) {
        appStateSubscription.remove();
      }

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loading, token, user?.isOnboarded]);

  return null;
}

function AppNavigationShell() {
  const { token } = useAuth();

  return (
    <>
      <NotificationBootstrap />
      <NavigationContainer
        key={token ? 'signed-in' : 'signed-out'}
        ref={navigationRef}
        onReady={() => {
          if (!token) {
            return;
          }

          flushPendingNotificationPress().catch(() => {
            // ignore pending notification flush failures
          });
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  useEffect(() => {
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        if (cancelled) {
          return;
        }

        try {
          await initializeNotifications();
          await consumeInitialNotificationPress();
        } catch {
          // ignore notification bootstrap failures
        }
      }, 800);
    });

    const unsubscribe = registerForegroundNotificationEvents();

    return () => {
      cancelled = true;
      task.cancel();
      unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigationShell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});