import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { sendLocation } from './api'

const LOCATION_TRACKING_TASK = 'TUGASGO_BACKGROUND_LOCATION_TRACKING'

// Define the background task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundGPS] Error:', error.message)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    if (locations && locations.length > 0) {
      const loc = locations[locations.length - 1]
      await sendLocation(
        loc.coords.latitude,
        loc.coords.longitude,
        loc.coords.accuracy || null
      )
    }
  }
})

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
  if (fgStatus !== 'granted') return false

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
  return bgStatus === 'granted'
}

export async function startBackgroundLocationTracking() {
  const hasPermission = await requestLocationPermissions()
  if (!hasPermission) return false

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK)
  if (isRegistered) return true

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000, // Every 15 seconds
    distanceInterval: 15, // Every 15 meters
    deferredUpdatesInterval: 15000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TugasGo Driver Tracking',
      notificationBody: 'GPS aktif melacak rute pengantaran tugas...',
      notificationColor: '#2563eb',
    },
  })
  return true
}

export async function stopBackgroundLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK)
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK)
  }
}
