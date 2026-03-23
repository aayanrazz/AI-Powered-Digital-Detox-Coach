import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

export default function SignUpScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    try {
      setLoading(true);
      await register({ name, email, password });
    } catch (error: any) {
      Alert.alert('Sign up failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start building healthier screen habits</Text>

        <TextInput
          placeholder="Full name"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

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

        <PrimaryButton title="Create Account" onPress={onRegister} loading={loading} />

        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Already have an account? Login</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50
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