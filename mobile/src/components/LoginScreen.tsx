import React, { useState } from 'react'
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/auth'
import { User, Lock, ArrowRight } from 'lucide-react-native'

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandSection}>
            <View style={styles.logoRow}>
              <Image source={require('../../assets/images/logo1.png')} style={styles.logoIcon} resizeMode="contain" />
              <Text style={styles.brandCredit}>by Auri IT Dept</Text>
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.eyebrow}>OPERASIONAL HARIAN</Text>
              <Text style={styles.heroTitle}>Driver Task Management System</Text>
              <Text style={styles.heroSubtitle}>Kelola tugas, driver, bukti kerja, dan laporan harian.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk Akun</Text>
            <Text style={styles.cardSubtitle}>Gunakan akun operasional Anda untuk melanjutkan.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputContainer}>
                <User size={18} color="#6B7570" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan username"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color="#6B7570" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.buttonRow}>
                  <Text style={styles.primaryButtonText}>Masuk ke Akun</Text>
                  <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.footerNote}>TugasGo · RS Banyumanik 2</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F3' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 24 },
  brandSection: { marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoIcon: { width: 34, height: 34, marginRight: 8 },
  brandCredit: { fontSize: 12, fontWeight: '600', color: '#6B7570' },
  heroTextContainer: { marginTop: 2 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#176B46', marginBottom: 4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#17211B', lineHeight: 28, marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: '#6B7570', lineHeight: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E4E9E6', elevation: 2, marginBottom: 18 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#17211B', marginBottom: 2 },
  cardSubtitle: { fontSize: 12.5, color: '#6B7570', marginBottom: 16 },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#17211B', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFCFA', borderWidth: 1.2, borderColor: '#E4E9E6', borderRadius: 10, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14.5, color: '#17211B' },
  primaryButton: { backgroundColor: '#176B46', borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 6, elevation: 3 },
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footerNote: { textAlign: 'center', fontSize: 11.5, color: '#94A3B8' },
})
