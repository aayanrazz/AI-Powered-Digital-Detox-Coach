import React, { useEffect } from 'react';
import { AppState, InteractionManager, StyleSheet } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
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

const appNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0B1220',
    card: '#0B1220',
    text: '#FFFFFF',
    border: '#1E293B',
    primary: '#4F46E5',
    notification: '#EF4444',
  },
};

const NOTIFICATION_BOOTSTRAP_DELAY_MS = __DEV__ ? 1500 : 800;
const STARTUP_SYNC_DELAY_MS = __DEV__ ? 2200 : 1200;
const PERIODIC_SYNC_INTERVAL_MS = __DEV__ ? 300000 : 60000; // 5 min in dev, 1 min in prod
const ACTIVE_SYNC_COOLDOWN_MS = __DEV__ ? 45000 : 15000; // avoid repeated active-state bursts

function NotificationBootstrap() {
  const { loading, token, user } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      let cancelled = false;

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

      return () => {
        cancelled = true;
        void cancelled;
      };
    }

    if (!user?.isOnboarded) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let appStateSubscription: { remove: () => void } | null = null;
    let inFlightSync: Promise<void> | null = null;
    let lastSyncAt = 0;
    let lastKnownAppState = AppState.currentState;

    const syncNow = async (force = false): Promise<void> => {
      if (cancelled) {
        return;
      }

      const now = Date.now();

      if (!force && now - lastSyncAt < ACTIVE_SYNC_COOLDOWN_MS) {
        return;
      }

      if (inFlightSync) {
        return inFlightSync;
      }

      inFlightSync = (async () => {
        try {
          await syncDetoxNotifications();
          await runLocalInterventionCheck();
          lastSyncAt = Date.now();
        } catch {
          // ignore sync failures to keep app stable
        }
      })();

      try {
        await inFlightSync;
      } finally {
        inFlightSync = null;
      }
    };

    const delayedStartupTask = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(() => {
        syncNow(true).catch(() => {
          // ignore delayed startup sync failures
        });
      }, STARTUP_SYNC_DELAY_MS);

      return () => clearTimeout(timer);
    });

    appStateSubscription = AppState.addEventListener('change', nextState => {
      const wasBackgrounded =
        lastKnownAppState === 'background' || lastKnownAppState === 'inactive';

      lastKnownAppState = nextState;

      if (nextState === 'active' && wasBackgrounded) {
        syncNow(false).catch(() => {
          // ignore app-active sync failures
        });
      }
    });

    intervalId = setInterval(() => {
      syncNow(false).catch(() => {
        // ignore periodic sync failures
      });
    }, PERIODIC_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;

      delayedStartupTask.cancel();

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
        theme={appNavigationTheme}
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
      const timer = setTimeout(async () => {
        if (cancelled) {
          return;
        }

        try {
          await initializeNotifications();
          await consumeInitialNotificationPress();
        } catch {
          // ignore notification bootstrap failures
        }
      }, NOTIFICATION_BOOTSTRAP_DELAY_MS);

      return () => clearTimeout(timer);
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
    backgroundColor: '#0B1220',
  },
});