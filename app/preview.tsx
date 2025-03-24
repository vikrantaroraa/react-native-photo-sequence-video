import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Download, Share2 } from "lucide-react-native";
import { Audio } from "expo-av";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import * as MediaLibrary from "expo-media-library";
import { Image } from "react-native";
import * as FileSystem from "expo-file-system";

export default function PreviewScreen() {
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { photos } = useLocalSearchParams();
  const parsedPhotos = typeof photos === "string" ? JSON.parse(photos) : [];
  console.log("Parsed photos:", parsedPhotos);
  console.log("first Parsed photos:", parsedPhotos[currentPhotoIndex]?.uri);

  useEffect(() => {
    loadAudio();
    return () => {
      sound?.unloadAsync();
    };
  }, []);

  async function loadAudio() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/audio/background-music.mp3"), // Update path to your file
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
    } catch (error) {
      console.error("Error loading audio:", error);
    }
  }

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withSequence(
      withTiming(1, { duration: 1000 }),
      withDelay(2000, withTiming(0, { duration: 1000 }))
    ),
  }));

  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSequence(
          withTiming(0, { duration: 1000 }),
          withDelay(2000, withTiming(-300, { duration: 1000 }))
        ),
      },
    ],
  }));

  useEffect(() => {
    async function checkPermission() {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access media library was denied.");
      } else if (status === "granted") {
        console.log("Permission to access media library was granted.");
      }
    }
    checkPermission();
  }, []);

  const fallbackUri = "https://picsum.photos/300/500";
  const photoUri = parsedPhotos[currentPhotoIndex]?.uri.startsWith("file://")
    ? parsedPhotos[currentPhotoIndex]?.uri
    : fallbackUri;

  async function checkFileType(uri: string) {
    const info = await FileSystem.getInfoAsync(uri);
    console.log("File Info:", info);
  }
  useEffect(() => {
    if (parsedPhotos[currentPhotoIndex]?.uri) {
      checkFileType(parsedPhotos[currentPhotoIndex]?.uri);
    }
  }, [currentPhotoIndex]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            sound?.stopAsync();
            router.back();
          }}
        >
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Download size={20} color="#fff" />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={20} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.preview}>
        {parsedPhotos?.length > 0 ? (
          <Animated.Image
            source={{ uri: parsedPhotos[currentPhotoIndex]?.uri }}
            style={[
              styles.previewImage,
              fadeStyle,
              slideStyle,
              {
                width: 300, // Temporary width
                height: 500, // Temporary height
                borderWidth: 1,
                borderColor: "#fff",
                resizeMode: "cover", // Replace objectFit with this
                backgroundColor: "#000", // Add this to make it visible
              },
            ]}
          />
        ) : (
          <Text style={{ color: "#fff", fontSize: 16 }}>
            No photos available for preview.
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => {
            if (isPlaying) {
              sound?.pauseAsync();
            } else {
              sound?.playAsync();
            }
            setIsPlaying(!isPlaying);
          }}
        >
          <Text style={styles.playButtonText}>
            {isPlaying ? "Pause" : "Play"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  preview: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  controls: {
    padding: 20,
    alignItems: "center",
  },
  playButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
