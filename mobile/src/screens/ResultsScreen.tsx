import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Recommendation } from '../api/recommendations';

export default function ResultsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { recommendations, destinationName, destinationAddress } = route.params as {
    recommendations: Recommendation[];
    destinationName: string;
    destinationAddress: string;
  };

  const [sortMode, setSortMode] = useState<'best' | 'distance' | 'price' | 'congestion'>('best');
  const [sortedRecs, setSortedRecs] = useState(recommendations);

  React.useEffect(() => {
    const sorted = [...recommendations];
    switch (sortMode) {
      case 'distance':
        sorted.sort((a, b) => a.distance_meters_drive - b.distance_meters_drive);
        break;
      case 'price':
        sorted.sort((a, b) => a.price_per_hour - b.price_per_hour);
        break;
      case 'congestion':
        sorted.sort((a, b) => a.congestion_score - b.congestion_score);
        break;
      default: // 'best'
        sorted.sort((a, b) => b.score - a.score);
    }
    setSortedRecs(sorted);
  }, [sortMode, recommendations]);

  const handleOpenDirections = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open Google Maps');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open directions');
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const renderRecommendation = ({ item, index }: { item: Recommendation; index: number }) => {
    const isBest = sortMode === 'best' && index === 0;
    const driveMinutes = Math.round(item.duration_drive_seconds / 60);
    const congestionPercent = Math.round(item.congestion_score * 100);

    return (
      <TouchableOpacity
        style={[styles.card, isBest && styles.bestCard]}
        onPress={() => handleOpenDirections(item.google_maps_directions_url)}
      >
        {isBest && (
          <View style={styles.bestBadge}>
            <Text style={styles.bestBadgeText}>⭐ Best</Text>
          </View>
        )}
        
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{(item.score * 100).toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Walk</Text>
            <Text style={styles.metricValue}>{item.walk_minutes.toFixed(1)} min</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Drive</Text>
            <Text style={styles.metricValue}>{formatDuration(item.duration_drive_seconds)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{formatDistance(item.distance_meters_drive)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Price</Text>
            <Text style={styles.metricValue}>{item.price_per_hour.toFixed(0)} AED/hr</Text>
          </View>
        </View>

        <View style={styles.congestionBar}>
          <View style={styles.congestionBarFill} />
          <Text style={styles.congestionText}>
            Traffic: {congestionPercent}% delay
          </Text>
        </View>

        {item.reasons.length > 0 && (
          <View style={styles.reasons}>
            {item.reasons.map((reason, idx) => (
              <Text key={idx} style={styles.reasonText}>
                • {reason}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => handleOpenDirections(item.google_maps_directions_url)}
        >
          <Text style={styles.directionsButtonText}>Open in Google Maps</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destinationTitle}>{destinationName}</Text>
        <Text style={styles.destinationAddress}>{destinationAddress}</Text>
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortButtons}>
          {(['best', 'distance', 'price', 'congestion'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.sortButton, sortMode === mode && styles.sortButtonActive]}
              onPress={() => setSortMode(mode)}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  sortMode === mode && styles.sortButtonTextActive,
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={sortedRecs}
        renderItem={renderRecommendation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recommendations found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  destinationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: '#666',
  },
  sortContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  bestCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#f1f8f4',
  },
  bestBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  scoreBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  congestionBar: {
    height: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  congestionBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ff9800',
    borderRadius: 12,
    width: '50%', // This would be dynamic based on congestion_score
  },
  congestionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  reasons: {
    marginBottom: 12,
  },
  reasonText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  directionsButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});

