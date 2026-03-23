import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

export default function PrimaryButton({
  title,
  onPress,
  loading,
  variant = 'primary'
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      style={[styles.button, variant === 'secondary' && styles.secondary]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10
  },
  secondary: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155'
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16
  },
  secondaryText: {
    color: '#E2E8F0'
  }
});