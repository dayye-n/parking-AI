import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { placesApi, AutocompleteSuggestion } from '../api/places';
import { recommendationsApi } from '../api/recommendations';

export default function SearchScreen() {
  const navigation = useNavigation();
  const [destinationQuery, setDestinationQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<AutocompleteSuggestion | null>(null);

  // Request location permission and get current location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch (error: any) {
        setLocationError('Failed to get location');
        console.error('Location error:', error);
      }
    })();
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (!destinationQuery || destinationQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await placesApi.autocomplete(destinationQuery);
        setSuggestions(results);
      } catch (error: any) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [destinationQuery]);

  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setSelectedDestination(suggestion);
    setDestinationQuery(suggestion.description);
    setSuggestions([]);
  };

  const handleFindParking = async () => {
    if (!selectedDestination) {
      Alert.alert('Error', 'Please select a destination');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location not available. Please enable location services.');
      return;
    }

    setSearching(true);
    try {
      const response = await recommendationsApi.getRecommendations({
        origin_lat: location.lat,
        origin_lng: location.lng,
        destination_place_id: selectedDestination.place_id,
        results: 6,
        sort: 'best',
      });

      navigation.navigate('Results' as never, {
        recommendations: response.recommendations,
        destinationName: response.destination_name,
        destinationAddress: response.destination_address,
      } as never);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to find parking recommendations'
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>ParkSense</Text>
          <Text style={styles.subtitle}>Find the best parking near your destination</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Your Location</Text>
            {location ? (
              <View style={styles.locationBox}>
                <Text style={styles.locationText}>
                  ✓ {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Text>
              </View>
            ) : locationError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{locationError}</Text>
              </View>
            ) : (
              <View style={styles.locationBox}>
                <ActivityIndicator size="small" />
                <Text style={styles.locationText}>Getting location...</Text>
              </View>
            )}

            <Text style={styles.label}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="Search for a place..."
              value={destinationQuery}
              onChangeText={setDestinationQuery}
              autoCapitalize="none"
            />

            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}

            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={suggestion.place_id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedDestination && (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedText}>
                  Selected: {selectedDestination.description}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (!selectedDestination || !location || searching) && styles.buttonDisabled,
              ]}
              onPress={handleFindParking}
              disabled={!selectedDestination || !location || searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Find Parking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#2e7d32',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  selectedText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

