
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Define route params type if using TypeScript strictly, but 'any' is sufficient for this scope
interface WorkoutFeedbackScreenProps {
    route: any; 
}

export default function WorkoutFeedbackScreen({ route }: WorkoutFeedbackScreenProps) {
  const navigation = useNavigation<any>();
  
  // Extract feedback text passed from WorkoutLogScreen
  const { feedbackText } = route.params || {};

  const handleClose = () => {
    // Reset the navigation stack to the initial route (Scanner).
    // This handles both deep-link scenarios (where history is empty) 
    // and in-app navigation (clearing the log form from history).
    navigation.reset({
      index: 0,
      routes: [{ name: 'QRScanner' }],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.content}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerEmoji}>🎉</Text>
                <Text style={styles.headerTitle}>Bra jobbat!</Text>
                <Text style={styles.headerSubtitle}>Passet är registrerat.</Text>
            </View>

            <View style={styles.feedbackCard}>
                <View style={styles.feedbackHeader}>
                    <Ionicons name="sparkles" size={24} color="#8b5cf6" /> 
                    <Text style={styles.feedbackTitle}>AI-Coachens analys</Text>
                </View>
                <Text style={styles.feedbackText}>
                    {feedbackText || "Bra intensitet idag! Starkt jobbat. Kom ihåg att dricka vatten och vila ordentligt."}
                </Text>
            </View>
        </View>

        <View style={styles.footer}>
            <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>Tillbaka till Start</Text>
            </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#8b5cf6', // Violet shadow for AI feel
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  feedbackText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#4B5563',
  },
  footer: {
    width: '100%',
    paddingBottom: 16,
  },
  button: {
    backgroundColor: '#14b8a6',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
