import React, { useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native'
import { useAuth } from '../lib/auth'
import { Truck } from 'lucide-react-native'

export function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Harap isi username dan password')
      return
    }
    try {
      setIsSubmitting(true)
      await login(username.trim(), password)
    } catch (err: any) {
      Alert.alert('Gagal Masuk', err.message || 'Username atau password salah')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginCard}>
        <View style={styles.loginHeader}>
          <View style={styles.iconCircle}>
            <Truck size={36} color="#2563EB" />
          </View>
          <Text style={styles.appTitle}>TugasGo Mobile</Text>
          <Text style={styles.appSubtitle}>Aplikasi Operasional Driver & Staff RSBY</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Masuk ke Akun</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loginCard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
