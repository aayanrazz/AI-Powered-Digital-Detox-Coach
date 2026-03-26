import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  ScrollViewProps,
} from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
};

export default function Screen({
  children,
  scroll = true,
  refreshControl,
}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  container: {
    flex: 1,
    padding: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
  },
});