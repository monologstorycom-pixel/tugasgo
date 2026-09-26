import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '../lib/auth'
import { LoginScreen } from '../components/LoginScreen'
import { DriverDashboard } from '../components/DriverDashboard'

export default function Index() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return <DriverDashboard />
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
})

