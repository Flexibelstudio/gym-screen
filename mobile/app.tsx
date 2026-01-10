
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QRScannerScreen from './screens/QRScannerScreen';
import { WorkoutLogScreen } from './screens/WorkoutLogScreen';
import WorkoutFeedbackScreen from './screens/WorkoutFeedbackScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ title: 'Skanna Kod' }} />
        <Stack.Screen name="WorkoutLog" component={WorkoutLogScreen} options={{ title: 'Logga Pass' }} />
        <Stack.Screen name="WorkoutFeedback" component={WorkoutFeedbackScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
