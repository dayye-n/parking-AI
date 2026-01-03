import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { parkingSpotsApi, ParkingSpot } from '../api/parkingSpots';

export default function SpotDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { spotId } = route.params as { spotId: number };
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSpot();
  }, [spotId]);

  const loadSpot = async () => {
    try {
      const data = await parkingSpotsApi.get(spotId);
      setSpot(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load parking spot');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Parking Spot',
      'Are you sure you want to delete this parking spot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await parkingSpotsApi.delete(spotId);
              Alert.alert('Success', 'Parking spot deleted', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete parking spot');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!spot) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{spot.title}</Text>
          <View style={[styles.statusBadge, spot.status === 'active' && styles.statusActive]}>
            <Text style={styles.statusText}>{spot.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.sectionValue}>{spot.location}</Text>
        </View>

        {spot.lat && spot.lng && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coordinates</Text>
            <Text style={styles.sectionValue}>
              {spot.lat.toFixed(6)}, {spot.lng.toFixed(6)}
            </Text>
          </View>
        )}

        {spot.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionValue}>{spot.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created</Text>
          <Text style={styles.sectionValue}>
            {new Date(spot.created_at).toLocaleString()}
          </Text>
        </View>

        {spot.updated_at && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Updated</Text>
            <Text style={styles.sectionValue}>
              {new Date(spot.updated_at).toLocaleString()}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Parking Spot</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionValue: {
    fontSize: 16,
    color: '#333',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

