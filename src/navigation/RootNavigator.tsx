import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import UsageMonitoringScreen from '../screens/UsageMonitoringScreen';
import AnalyticsDashboardScreen from '../screens/AnalyticsDashboardScreen';
import DetoxPlanScreen from '../screens/DetoxPlanScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import SettingsPrivacyScreen from '../screens/SettingsPrivacyScreen';

const AuthStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function TabLabel({
  text,
  focused,
}: {
  text: string;
  focused: boolean;
}) {
  return (
    <Text style={focused ? styles.tabLabelFocused : styles.tabLabel}>
      {text}
    </Text>
  );
}

function buildTabOptions(text: string) {
  return {
    tabBarLabel: ({ focused }: { focused: boolean }) => (
      <TabLabel text={text} focused={focused} />
    ),
  };
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeDashboardScreen}
        options={buildTabOptions('Home')}
      />
      <Tab.Screen
        name="UsageTab"
        component={UsageMonitoringScreen}
        options={buildTabOptions('Usage')}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsDashboardScreen}
        options={buildTabOptions('Analytics')}
      />
      <Tab.Screen
        name="PlanTab"
        component={DetoxPlanScreen}
        options={buildTabOptions('AI Plan')}
      />
    </Tab.Navigator>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </ProfileStack.Navigator>
  );
}

const rootStackScreenOptions = {
  headerStyle: { backgroundColor: '#0B1220' },
  headerTintColor: '#FFFFFF',
  contentStyle: { backgroundColor: '#0B1220' },
};

export default function RootNavigator() {
  const { loading, token, user } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!token) {
    return <AuthStackNavigator />;
  }

  if (!user?.isOnboarded) {
    return <ProfileStackNavigator />;
  }

  return (
    <RootStack.Navigator
      screenOptions={rootStackScreenOptions}
      key={`root-${token ? 'signed-in' : 'signed-out'}-${
        user?.isOnboarded ? 'onboarded' : 'not-onboarded'
      }`}
    >
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="Rewards" component={RewardsScreen} />
      <RootStack.Screen name="Settings" component={SettingsPrivacyScreen} />
      <RootStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F172A',
    borderTopColor: '#1E293B',
    height: 68,
  },
  tabLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelFocused: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
});