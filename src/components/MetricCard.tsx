import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MetricCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    minHeight: 100,
    justifyContent: 'center'
  },
  value: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800'
  },
  label: {
    color: '#94A3B8',
    marginTop: 6,
    fontSize: 13
  }
});