import React, { useState, useEffect } from 'react'
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, Alert, RefreshControl, SafeAreaView
} from 'react-native'
import { useAuth } from '../lib/auth'
import { Task } from '../lib/types'
import { request, uploadTaskPhoto } from '../lib/api'
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../lib/gps'
import * as ImagePicker from 'expo-image-picker'
import { MapPin, Camera, Play, LogOut, RefreshCw } from 'lucide-react-native'

export function DriverDashboard() {
  const { user, logout } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchTasks = async () => {
    try {
      const data = await request<{ tasks: Task[] }>('/tasks')
      setTasks(data.tasks || [])
      const inProgress = data.tasks.find((t) => t.status === 'IN_PROGRESS')
      setActiveTask(inProgress || null)
      if (inProgress && user?.role === 'DRIVER') {
        startBackgroundLocationTracking().catch(() => {})
      } else if (!inProgress && user?.role === 'DRIVER') {
        stopBackgroundLocationTracking().catch(() => {})
      }
    } catch (err: any) {
      console.warn('Fetch error:', err.message)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const onRefresh = async () => {
    setIsRefreshing(true)
    await fetchTasks()
    setIsRefreshing(false)
  }

  const handleStartTask = async (task: Task) => {
    try {
      setActionLoading(true)
      await request(`/tasks/${task.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      await startBackgroundLocationTracking()
      await fetchTasks()
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteTask = async (task: Task) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Izin Kamera', 'Izin kamera diperlukan untuk upload bukti tugas.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return

    try {
      setActionLoading(true)
      const photoKey = await uploadTaskPhoto(result.assets[0].uri, 'COMPLETION')
      await request(`/tasks/${task.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED', photos: [photoKey] }),
      })
      await stopBackgroundLocationTracking()
      await fetchTasks()
      Alert.alert('Sukses', 'Tugas berhasil diselesaikan!')
    } catch (err: any) {
      Alert.alert('Gagal', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetingText}>Halo, {user?.name}</Text>
          <Text style={styles.roleBadge}>{user?.role} {user?.division ? `• ${user.division}` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {activeTask && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerTitle}>SEDANG BERJALAN</Text>
          <Text style={styles.activeTaskDest}>{activeTask.destination}</Text>
          <Text style={styles.activeTaskAddress} numberOfLines={2}>{activeTask.address}</Text>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleCompleteTask(activeTask)}
            disabled={actionLoading}
          >
            <Camera size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.completeButtonText}>Foto & Selesai</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listSectionTitle}>Daftar Tugas</Text>
            <TouchableOpacity onPress={onRefresh}><RefreshCw size={18} color="#64748B" /></TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <View style={styles.taskCardHeader}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
            <Text style={styles.taskLocationText}><MapPin size={14} color="#64748B" /> {item.destination}</Text>
            <Text style={styles.taskAddressText}>{item.address}</Text>
            {user?.role === 'DRIVER' && item.status === 'WAITING' && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => handleStartTask(item)}
                disabled={actionLoading}
              >
                <Play size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.startButtonText}>Mulai Kerjakan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  greetingText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  roleBadge: { fontSize: 13, color: '#64748B', marginTop: 2 },
  logoutButton: { padding: 8, borderRadius: 8, backgroundColor: '#FEF2F2' },
  activeBanner: { backgroundColor: '#1E293B', margin: 16, padding: 16, borderRadius: 12 },
  activeBannerTitle: { fontSize: 12, fontWeight: '700', color: '#34D399', marginBottom: 4 },
  activeTaskDest: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  activeTaskAddress: { fontSize: 13, color: '#94A3B8', marginTop: 2, marginBottom: 12 },
  completeButton: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  completeButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  listSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  taskCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  taskLocationText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  taskAddressText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  startButton: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  startButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
})

