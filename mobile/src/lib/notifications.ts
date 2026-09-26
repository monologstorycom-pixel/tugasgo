import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { registerPushToken } from './api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
})

export async function setupPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TugasGo Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    })
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync()
    const token = tokenData.data
    if (token) {
      await registerPushToken(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID')
    }
    return token
  } catch (err) {
    console.warn('[PushNotification] Error getting token:', err)
    return null
  }
}

