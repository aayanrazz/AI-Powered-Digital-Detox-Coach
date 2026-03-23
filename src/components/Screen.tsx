import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
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
        contentContainerStyle={styles.scroll}
        refreshControl={refreshControl}
      >
        <View style={styles.container}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  scroll: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 18,
  },
});