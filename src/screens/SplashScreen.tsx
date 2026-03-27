import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Digital Detox Coach</Text>
      <Text style={styles.tagline}>Mindful screen habits. Smarter daily focus.</Text>
      <ActivityIndicator size="large" color="#4F46E5" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  tagline: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
});