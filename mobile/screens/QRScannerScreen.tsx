
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, Linking, Platform } from 'react-native';
import { CameraView, useCameraPermissions, BarCodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { sendCheckIn } from '../../services/firebaseService'; // Import the service
import { useAuth } from '../../context/AuthContext'; // Assume this is available or mock it

// Typer för QR-payload
interface QRPayload {
  oid: string; // Organization ID
  wid: string; // Workout ID
  ts: number;  // Timestamp
}

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = 280;

export default function QRScannerScreen() {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  // NOTE: Ideally, the mobile app should have its own Auth Context. 
  // For this mono-repo simulation, we will assume we can get the current user's email.
  // In a real standalone mobile app, you'd use `auth().currentUser?.email`.
  const userEmail = "member@example.com"; // Placeholder/Mock

  // Hantera rättigheter vid start
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = async ({ data }: BarCodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Parsa datan direkt som JSON
      let payload: QRPayload;
      
      try {
        payload = JSON.parse(data);
      } catch (e) {
        throw new Error("Ogiltigt QR-format");
      }

      // Validera struktur (oid, wid krävs)
      if (!payload.oid || !payload.wid) {
        throw new Error("Saknar nödvändig passdata");
      }

      // Timestamp-kontrollen har tagits bort för att göra koden giltig för alltid.
      // Detta möjliggör att samma pass/QR-kod kan användas morgon och kväll.

      // --- SPOTLIGHT TRIGGER ---
      // Send the "I am here" signal before navigation
      try {
          // Fire and forget - don't block navigation if this fails
          sendCheckIn(payload.oid, userEmail); 
      } catch (err) {
          console.log("Spotlight trigger failed (ignoring)", err);
      }
      // -------------------------

      // Navigera till loggningsskärmen
      navigation.replace('WorkoutLog', {
        workoutId: payload.wid,
        organizationId: payload.oid,
      });

    } catch (error) {
      console.log("Scan error:", error);
      Alert.alert(
        "Kunde inte läsa koden",
        "Det verkar inte vara en giltig SmartSkärm-kod.",
        [{ text: "Försök igen", onPress: () => setScanned(false) }]
      );
    }
  };

  // Vy för saknade rättigheter
  if (!permission) {
    return <View style={styles.container} />; // Laddar...
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off-outline" size={80} color="#374151" />
        <Text style={styles.permissionTitle}>Kameraåtkomst krävs</Text>
        <Text style={styles.permissionText}>
          För att kunna logga ditt träningspass behöver appen se QR-koden på skärmen.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Ge åtkomst</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => {
            if (Platform.OS === 'ios') Linking.openURL('app-settings:');
            else Linking.openSettings();
          }}
        >
          <Text style={styles.settingsButtonText}>Öppna Inställningar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Overlay Container */}
        <View style={styles.overlay}>
          
          {/* Top Mask */}
          <View style={styles.maskRow} />
          
          {/* Center Row (Mask - Scan Window - Mask) */}
          <View style={styles.centerRow}>
            <View style={styles.maskSide} />
            <View style={styles.scanWindow}>
              {/* Hörnmarkeringar för visuell tydlighet */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.maskSide} />
          </View>

          {/* Bottom Mask + Text */}
          <View style={[styles.maskRow, styles.bottomMask]}>
            <Text style={styles.instructionText}>
              Sikta på QR-koden på skärmen
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButtonOverlay} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>

        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // --- Permissions UI ---
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F3F4F6',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    textAlign: 'center',
    color: '#4B5563',
    marginBottom: 30,
    fontSize: 16,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#14b8a6', // Primary Teal
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settingsButton: {
    paddingVertical: 14,
  },
  settingsButtonText: {
    color: '#14b8a6',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },

  // --- Camera Overlay UI ---
  overlay: {
    flex: 1,
  },
  maskRow: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centerRow: {
    flexDirection: 'row',
    height: SCAN_AREA_SIZE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanWindow: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  bottomMask: {
    alignItems: 'center',
    paddingTop: 40,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButtonOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // --- Corners for the scanner ---
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#14b8a6',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 16,
  },
});
