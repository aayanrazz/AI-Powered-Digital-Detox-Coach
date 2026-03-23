import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      await login({ email, password });
    } catch (error: any) {
      Alert.alert('Login failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your digital detox journey</Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <PrimaryButton title="Login" onPress={onLogin} loading={loading} />

        <Pressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.link}>Don’t have an account? Sign Up</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800'
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 24
  },
  input: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14
  },
  link: {
    color: '#A5B4FC',
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '600'
  }
});