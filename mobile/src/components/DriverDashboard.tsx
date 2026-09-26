import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, Alert,
  RefreshControl, Modal, TextInput, Image, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/auth'
import { Task } from '../lib/types'
import {
  fetchTasks, startTask, completeTask, cancelTask,
  fetchTaskTimeline, uploadTaskPhoto, formatAge, formatDuration, formatDateTime,
} from '../lib/api'
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../lib/gps'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import {
  MapPin, Camera, Play, LogOut, RefreshCw, CheckCircle2,
  XCircle, Clock, AlertCircle, Calendar, ChevronRight, X, User,
} from 'lucide-react-native'

export function DriverDashboard() {
  const { user, logout } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Modals state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailEvents, setDetailEvents] = useState<any[]>([])
  const [completeModalTask, setCompleteModalTask] = useState<Task | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([])
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false)

  // Cancel Modal state
  const [cancelModalTask, setCancelModalTask] = useState<Task | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Live timer for active task
  const [timerSeconds, setTimerSeconds] = useState(0)

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks()
      const list = data.tasks || []
      setTasks(list)
      const inProgress = list.find((t) => t.status === 'IN_PROGRESS')
      setActiveTask(inProgress || null)
      if (inProgress && user?.role === 'DRIVER') {
        startBackgroundLocationTracking().catch(() => {})
      } else if (!inProgress && user?.role === 'DRIVER') {
        stopBackgroundLocationTracking().catch(() => {})
      }
    } catch (err: any) {
      console.warn('Fetch error:', err.message)
    }
  }, [user?.role])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (!activeTask?.startedAt) return
    const updateTimer = () => {
      const startMs = activeTask.startedAt ? new Date(activeTask.startedAt).getTime() : Date.now()
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      setTimerSeconds(diffSec)
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeTask])

  const onRefresh = async () => {
    setIsRefreshing(true)
    await loadTasks()
    setIsRefreshing(false)
  }

  const handleStartTask = async (task: Task) => {
    try {
      setActionLoading(true)
      await startTask(task.id)
      await startBackgroundLocationTracking()
      await loadTasks()
      if (selectedTask?.id === task.id) {
        setSelectedTask(null)
      }
      Alert.alert('Sukses', 'Tugas dimulai! Timer dan pelacak GPS aktif.')
    } catch (err: any) {
      Alert.alert('Gagal Memulai', err.message || 'Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task)
    setDetailEvents([])
    try {
      const data = await fetchTaskTimeline(task.id)
      setDetailEvents(data.events || [])
    } catch {}
  }

  const openCompleteModal = (task: Task) => {
    setCompleteModalTask(task)
    setCompletionNote('')
    setCompletionPhotos([])
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Izin Kamera', 'Izin kamera diperlukan untuk mengambil foto bukti tugas.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCompletionPhotos((prev) => [...prev, result.assets[0].uri])
    }
  }

  const handleFinishTask = async () => {
    if (!completeModalTask) return
    if (completionPhotos.length === 0) {
      Alert.alert('Perhatian', 'Minimal 1 foto bukti penyelesaian wajib dilampirkan')
      return
    }

    try {
      setIsSubmittingCompletion(true)
      let lat: number | null = null
      let lng: number | null = null
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          lat = loc.coords.latitude
          lng = loc.coords.longitude
        }
      } catch {}

      const uploadedKeys: string[] = []
      for (const uri of completionPhotos) {
        const key = await uploadTaskPhoto(uri, 'COMPLETION')
        uploadedKeys.push(key)
      }

      await completeTask(completeModalTask.id, {
        note: completionNote.trim() || 'Tugas selesai.',
        photos: uploadedKeys,
        latitude: lat,
        longitude: lng,
      })

      await stopBackgroundLocationTracking()
      setCompleteModalTask(null)
      if (selectedTask?.id === completeModalTask.id) setSelectedTask(null)
      await loadTasks()
      Alert.alert('Sukses', 'Tugas berhasil diselesaikan!')
    } catch (err: any) {
      Alert.alert('Gagal Menyelesaikan', err.message || 'Terjadi kesalahan')
    } finally {
      setIsSubmittingCompletion(false)
    }
  }

  const handleCancelTaskSubmit = async () => {
    if (!cancelModalTask) return
    if (!cancelReason.trim()) {
      Alert.alert('Perhatian', 'Alasan pembatalan wajib diisi')
      return
    }
    try {
      setActionLoading(true)
      await cancelTask(cancelModalTask.id, cancelReason.trim())
      setCancelModalTask(null)
      if (selectedTask?.id === cancelModalTask.id) setSelectedTask(null)
      await loadTasks()
      Alert.alert('Sukses', 'Tugas telah dibatalkan')
    } catch (err: any) {
      Alert.alert('Gagal Membatalkan', err.message || 'Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const rank = (t: Task) => (t.status === 'IN_PROGRESS' ? 0 : t.status === 'WAITING' ? 1 : 2)
      return rank(a) - rank(b) || a.created - b.created
    })
  }, [tasks])

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.topBar}>
        <View style={styles.topBarBrand}>
          <Image source={require('../../assets/images/logo1.png')} style={styles.brandLogo} resizeMode="contain" />
          <View>
            <Text style={styles.brandTitle}>TugasGo</Text>
            <Text style={styles.brandSub}>RS Banyumanik 2</Text>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.readyBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.readyText}>Siap bertugas</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
            <LogOut size={16} color="#C0392B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <FlatList
        data={sortedTasks}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#176B46']} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Greeting Header */}
            <View style={styles.greetingSection}>
              <Text style={styles.eyebrow}>TUGAS HARI INI</Text>
              <Text style={styles.greetingName}>Halo, {user?.name?.split(' ')[0]}.</Text>
            </View>

            {/* Active Task Banner */}
            {activeTask && (
              <View style={styles.activeBanner}>
                <View style={styles.activeBannerHeader}>
                  <Text style={styles.activeEyebrow}>SEDANG DIKERJAKAN</Text>
                  <View style={styles.timerBadge}>
                    <Clock size={12} color="#D8F06D" style={{ marginRight: 4 }} />
                    <Text style={styles.timerText}>{formatDuration(timerSeconds)}</Text>
                  </View>
                </View>

                <Text style={styles.activeTitle}>{activeTask.title}</Text>
                <View style={styles.activeDestRow}>
                  <MapPin size={14} color="#E4E9E6" style={{ marginRight: 4, marginTop: 1 }} />
                  <Text style={styles.activeDestText}>{activeTask.destination}</Text>
                </View>
                {activeTask.address ? (
                  <Text style={styles.activeAddressText} numberOfLines={2}>{activeTask.address}</Text>
                ) : null}

                <View style={styles.activeBannerActions}>
                  <TouchableOpacity
                    style={styles.detailButton}
                    onPress={() => openTaskDetail(activeTask)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailButtonText}>Lihat Detail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.completeHeroButton}
                    onPress={() => openCompleteModal(activeTask)}
                    activeOpacity={0.8}
                  >
                    <Camera size={16} color="#17211B" style={{ marginRight: 6 }} />
                    <Text style={styles.completeHeroButtonText}>Selesaikan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Queue Section Title */}
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>Antrean Tugas</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{sortedTasks.length} TUGAS</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AlertCircle size={36} color="#94A3B8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Tidak ada tugas aktif</Text>
            <Text style={styles.emptySubtitle}>Tugas baru yang ditugaskan akan otomatis muncul di sini.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUrgent = item.priority === 'URGENT'
          const isInProgress = item.status === 'IN_PROGRESS'
          const isWaiting = item.status === 'WAITING'
          const isCompleted = item.status === 'COMPLETED'
          const isCancelled = item.status === 'CANCELLED'

          return (
            <TouchableOpacity
              style={[styles.taskCard, isInProgress && styles.taskCardActive]}
              onPress={() => openTaskDetail(item)}
              activeOpacity={0.75}
            >
              <View style={styles.taskCardRow}>
                {/* Priority dot indicator */}
                <View style={[styles.priorityDot, isUrgent ? styles.dotUrgent : styles.dotNormal]} />

                <View style={{ flex: 1 }}>
                  {/* Title & Badges */}
                  <View style={styles.taskTitleRow}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.badgesWrap}>
                      {isUrgent && <View style={[styles.badge, styles.badgeRed]}><Text style={styles.badgeRedText}>URGENT</Text></View>}
                      {isInProgress && <View style={[styles.badge, styles.badgeBlue]}><Text style={styles.badgeBlueText}>BERJALAN</Text></View>}
                      {isWaiting && <View style={[styles.badge, styles.badgeGray]}><Text style={styles.badgeGrayText}>WAITING</Text></View>}
                      {isCompleted && <View style={[styles.badge, styles.badgeGreen]}><Text style={styles.badgeGreenText}>SELESAI</Text></View>}
                      {isCancelled && <View style={[styles.badge, styles.badgeRed]}><Text style={styles.badgeRedText}>BATAL</Text></View>}
                    </View>
                  </View>

                  {/* Destination & Requester */}
                  <View style={styles.locationRow}>
                    <MapPin size={13} color="#6B7570" style={{ marginRight: 4 }} />
                    <Text style={styles.taskDestText} numberOfLines={1}>{item.destination} · {item.requester || item.division}</Text>
                  </View>

                  {item.address ? (
                    <Text style={styles.taskAddressText} numberOfLines={1}>{item.address}</Text>
                  ) : null}

                  {/* Scheduled info if available */}
                  {item.scheduledAt ? (
                    <View style={styles.scheduleRow}>
                      <Calendar size={12} color="#B45309" style={{ marginRight: 4 }} />
                      <Text style={styles.scheduleText}>Jadwal: {formatDateTime(item.scheduledAt)}</Text>
                    </View>
                  ) : null}

                  {/* Age Footer */}
                  <Text style={styles.taskAgeText}>
                    {isWaiting ? `${formatAge(item.created)} belum dikerjakan` : `${formatAge(item.created)}`}
                  </Text>
                </View>

                <ChevronRight size={18} color="#94A3B8" style={{ marginLeft: 8 }} />
              </View>

              {/* Quick Action Button for Waiting Task */}
              {isWaiting && user?.role === 'DRIVER' && (
                <TouchableOpacity
                  style={styles.quickStartButton}
                  onPress={() => handleStartTask(item)}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  <Play size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.quickStartButtonText}>Mulai Kerjakan</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )
        }}
      />

      {/* Task Detail Modal */}
      <Modal visible={!!selectedTask} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailEyebrow}>DETAIL TUGAS #{selectedTask?.id}</Text>
                <Text style={styles.detailTitle}>{selectedTask?.title}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTask(null)}>
                <X size={20} color="#17211B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailBody}>
              {/* Destination info */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>TUJUAN & LOKASI</Text>
                <Text style={styles.infoValueBold}>{selectedTask?.destination}</Text>
                <Text style={styles.infoValueMuted}>{selectedTask?.address}</Text>
              </View>

              {/* Requester info */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>PEMOHON / DIVISI</Text>
                <Text style={styles.infoValue}>{selectedTask?.requester} ({selectedTask?.division})</Text>
              </View>

              {/* Instructions */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>INSTRUKSI</Text>
                <Text style={styles.infoValue}>{selectedTask?.description || 'Tidak ada catatan tambahan.'}</Text>
              </View>

              {/* Reference Photo */}
              {selectedTask?.referencePhoto ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>FOTO REFERENSI</Text>
                  <Image
                    source={{ uri: selectedTask.referencePhoto }}
                    style={styles.refImage}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              {/* Timeline */}
              {detailEvents.length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>RIWAYAT AKTIVITAS</Text>
                  {detailEvents.map((ev, idx) => (
                    <View key={idx} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEventText}>{ev.event_type?.replace(/_/g, ' ')}</Text>
                        <Text style={styles.timelineMetaText}>{ev.actor_name} · {formatDateTime(new Date(ev.created_at).getTime())}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Actions inside Detail */}
              {selectedTask?.status === 'WAITING' && user?.role === 'DRIVER' && (
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={styles.detailPrimaryButton}
                    onPress={() => handleStartTask(selectedTask)}
                    disabled={actionLoading}
                  >
                    <Play size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.detailPrimaryButtonText}>Mulai Kerjakan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailCancelButton}
                    onPress={() => {
                      setCancelModalTask(selectedTask)
                      setCancelReason('')
                    }}
                  >
                    <Text style={styles.detailCancelButtonText}>Batalkan Tugas</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedTask?.status === 'IN_PROGRESS' && (
                <TouchableOpacity
                  style={styles.detailCompleteButton}
                  onPress={() => openCompleteModal(selectedTask)}
                >
                  <Camera size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.detailPrimaryButtonText}>Selesaikan Tugas</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Completion Modal */}
      <Modal visible={!!completeModalTask} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailEyebrow}>BUKTI PENYELESAIAN</Text>
                <Text style={styles.detailTitle}>Selesaikan Tugas</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setCompleteModalTask(null)}>
                <X size={20} color="#17211B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailBody}>
              {/* Photo Evidence Picker */}
              <Text style={styles.formSectionLabel}>Foto Bukti (Wajib)</Text>
              <TouchableOpacity style={styles.photoUploadBox} onPress={pickImage} activeOpacity={0.8}>
                <Camera size={28} color="#176B46" />
                <Text style={styles.uploadBoxTitle}>Ambil Foto Kamera</Text>
                <Text style={styles.uploadBoxSub}>
                  {completionPhotos.length > 0 ? `${completionPhotos.length} foto terpilih` : 'Ketuk untuk mengambil foto'}
                </Text>
              </TouchableOpacity>

              {/* Photo Previews */}
              {completionPhotos.length > 0 && (
                <View style={styles.photoPreviewsRow}>
                  {completionPhotos.map((uri, idx) => (
                    <View key={idx} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => setCompletionPhotos((p) => p.filter((_, i) => i !== idx))}
                      >
                        <X size={12} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Note input */}
              <Text style={styles.formSectionLabel}>Catatan Penyelesaian</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Contoh: Dokumen telah diserahkan kepada PIC Farmasi..."
                placeholderTextColor="#94A3B8"
                value={completionNote}
                onChangeText={setCompletionNote}
                multiline
                numberOfLines={3}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.finishSubmitBtn, isSubmittingCompletion && { opacity: 0.7 }]}
                onPress={handleFinishTask}
                disabled={isSubmittingCompletion}
              >
                {isSubmittingCompletion ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CheckCircle2 size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.finishSubmitBtnText}>Konfirmasi Selesai</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Cancel Task Modal */}
      <Modal visible={!!cancelModalTask} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.cancelCard}>
            <Text style={styles.cancelCardTitle}>Batalkan Tugas</Text>
            <Text style={styles.cancelCardSub}>Masukkan alasan pembatalan tugas ini:</Text>
            <TextInput
              style={styles.cancelInput}
              placeholder="Alasan pembatalan..."
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <View style={styles.cancelCardActions}>
              <TouchableOpacity
                style={styles.cancelBackBtn}
                onPress={() => setCancelModalTask(null)}
              >
                <Text style={styles.cancelBackBtnText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={handleCancelTaskSubmit}
                disabled={actionLoading}
              >
                <Text style={styles.cancelConfirmBtnText}>Batalkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F3' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E4E9E6',
  },
  topBarBrand: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { width: 32, height: 32, marginRight: 8 },
  brandTitle: { fontSize: 16, fontWeight: '800', color: '#17211B' },
  brandSub: { fontSize: 11, color: '#6B7570', fontWeight: '500' },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
  readyText: { fontSize: 11, fontWeight: '700', color: '#176B46' },
  logoutButton: { padding: 6, borderRadius: 8, backgroundColor: '#FDF0EE' },
  listContent: { padding: 16, paddingBottom: 32 },
  greetingSection: { marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#176B46', marginBottom: 2, textTransform: 'uppercase' },
  greetingName: { fontSize: 22, fontWeight: '800', color: '#17211B' },
  activeBanner: {
    backgroundColor: '#17211B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#D8F06D', textTransform: 'uppercase' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(216,240,109,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  timerText: { fontSize: 12, fontWeight: '700', color: '#D8F06D' },
  activeTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  activeDestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  activeDestText: { fontSize: 14, fontWeight: '600', color: '#EAF4EE' },
  activeAddressText: { fontSize: 12.5, color: '#94A3B8', marginBottom: 12 },
  activeBannerActions: { flexDirection: 'row', gap: 8 },
  detailButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  detailButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  completeHeroButton: { flex: 1.2, backgroundColor: '#D8F06D', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  completeHeroButtonText: { color: '#17211B', fontSize: 13, fontWeight: '700' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  queueTitle: { fontSize: 16, fontWeight: '700', color: '#17211B' },
  countBadge: { backgroundColor: '#E4E9E6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  countBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#17211B' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E9E6' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#17211B', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: '#6B7570', textAlign: 'center', paddingHorizontal: 20 },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4E9E6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCardActive: { borderColor: '#176B46', borderWidth: 1.5 },
  taskCardRow: { flexDirection: 'row', alignItems: 'center' },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10, alignSelf: 'flex-start', marginTop: 5 },
  dotUrgent: { backgroundColor: '#C0392B' },
  dotNormal: { backgroundColor: '#6B7570' },
  taskTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: '#17211B', flex: 1, marginRight: 6 },
  badgesWrap: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeRed: { backgroundColor: '#FDF0EE' },
  badgeRedText: { color: '#C0392B', fontSize: 10, fontWeight: '700' },
  badgeBlue: { backgroundColor: '#E5F2F9' },
  badgeBlueText: { color: '#1D6FA0', fontSize: 10, fontWeight: '700' },
  badgeGreen: { backgroundColor: '#EAF4EE' },
  badgeGreenText: { color: '#176B46', fontSize: 10, fontWeight: '700' },
  badgeGray: { backgroundColor: '#F1F5F9' },
  badgeGrayText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  taskDestText: { fontSize: 13, fontWeight: '600', color: '#17211B' },
  taskAddressText: { fontSize: 12, color: '#6B7570', marginTop: 1 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  scheduleText: { fontSize: 11, fontWeight: '600', color: '#B45309' },
  taskAgeText: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  quickStartButton: {
    backgroundColor: '#176B46',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 10,
  },
  quickStartButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#F3F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderColor: '#E4E9E6' },
  detailEyebrow: { fontSize: 10, fontWeight: '800', color: '#176B46', letterSpacing: 1 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#17211B' },
  closeBtn: { padding: 4 },
  detailBody: { padding: 16 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E4E9E6' },
  infoLabel: { fontSize: 10.5, fontWeight: '800', color: '#6B7570', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  infoValueBold: { fontSize: 15, fontWeight: '700', color: '#17211B' },
  infoValueMuted: { fontSize: 13, color: '#6B7570', marginTop: 2 },
  infoValue: { fontSize: 14, color: '#17211B', lineHeight: 20 },
  refImage: { width: '100%', height: 160, borderRadius: 8, marginTop: 8 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#176B46', marginTop: 4, marginRight: 8 },
  timelineEventText: { fontSize: 13, fontWeight: '600', color: '#17211B' },
  timelineMetaText: { fontSize: 11, color: '#6B7570' },
  detailActions: { marginTop: 10, gap: 10 },
  detailPrimaryButton: { backgroundColor: '#176B46', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10 },
  detailPrimaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  detailCancelButton: { backgroundColor: '#FDF0EE', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  detailCancelButtonText: { color: '#C0392B', fontSize: 14, fontWeight: '600' },
  detailCompleteButton: { backgroundColor: '#176B46', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, marginTop: 10 },
  formSectionLabel: { fontSize: 13, fontWeight: '700', color: '#17211B', marginBottom: 8 },
  photoUploadBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#176B46', borderStyle: 'dashed', padding: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  uploadBoxTitle: { fontSize: 14, fontWeight: '700', color: '#176B46', marginTop: 6 },
  uploadBoxSub: { fontSize: 12, color: '#6B7570', marginTop: 2 },
  photoPreviewsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 70, height: 70, borderRadius: 8 },
  photoRemoveBtn: { position: 'absolute', top: -4, right: -4, backgroundColor: '#C0392B', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  noteInput: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E4E9E6', padding: 12, fontSize: 14, color: '#17211B', textAlignVertical: 'top', height: 80, marginBottom: 16 },
  finishSubmitBtn: { backgroundColor: '#176B46', borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  finishSubmitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  cancelCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  cancelCardTitle: { fontSize: 17, fontWeight: '700', color: '#17211B', marginBottom: 4 },
  cancelCardSub: { fontSize: 13, color: '#6B7570', marginBottom: 12 },
  cancelInput: { backgroundColor: '#FAFCFA', borderWidth: 1, borderColor: '#E4E9E6', borderRadius: 8, padding: 10, height: 70, textAlignVertical: 'top', fontSize: 14, color: '#17211B', marginBottom: 14 },
  cancelCardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBackBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  cancelBackBtnText: { color: '#6B7570', fontSize: 14, fontWeight: '600' },
  cancelConfirmBtn: { backgroundColor: '#C0392B', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  cancelConfirmBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
})
