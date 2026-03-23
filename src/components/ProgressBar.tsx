import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 999,
    overflow: 'hidden'
  },
  inner: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999
  }
});