import React, { useRef, useState, useEffect } from 'react'
import {
  StyleSheet, View, ActivityIndicator, BackHandler,
  Platform, Text, TouchableOpacity, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import * as Notifications from 'expo-notifications'
import { RefreshCw, WifiOff } from 'lucide-react-native'

const APP_URL = 'https://tugasgo.rsby.cloud'

export default function App() {
  const webViewRef = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Request runtime permissions on mount
  useEffect(() => {
    async function requestPermissions() {
      try {
        await Location.requestForegroundPermissionsAsync()
        await Location.requestBackgroundPermissionsAsync().catch(() => {})
        await ImagePicker.requestCameraPermissionsAsync()
        await Notifications.requestPermissionsAsync().catch(() => {})
      } catch (e) {
        console.warn('Permission request error:', e)
      }
    }
    requestPermissions()
  }, [])

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [canGoBack])

  const handleReload = () => {
    setHasError(false)
    setLoading(true)
    webViewRef.current?.reload()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F5F3" />

      {hasError ? (
        <View style={styles.errorContainer}>
          <WifiOff size={48} color="#C0392B" style={{ marginBottom: 12 }} />
          <Text style={styles.errorTitle}>Koneksi Gagal</Text>
          <Text style={styles.errorSubtitle}>
            Tidak dapat terhubung ke server TugasGo. Periksa jaringan internet Anda.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReload} activeOpacity={0.8}>
            <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webviewWrapper}>
          <WebView
            ref={webViewRef}
            source={{ uri: APP_URL }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            cacheEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack)
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setHasError(true)
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent
              if (nativeEvent.statusCode >= 500) {
                setHasError(true)
              }
            }}
          />

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#176B46" />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F3',
  },
  webviewWrapper: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#F3F5F3',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(243, 245, 243, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F3F5F3',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17211B',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6B7570',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#176B46',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 2,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
})
