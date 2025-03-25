import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  BackHandler,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Download, Share2 } from "lucide-react-native";
import { Audio } from "expo-av";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  useSharedValue,
} from "react-native-reanimated";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";

export default function PreviewScreen() {
  const soundRef = useRef<Audio.Sound | null>(null); // Ref for audio

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const opacity = useSharedValue(1); // Shared value for fade effect
  const translateX = useSharedValue(0); // Position for sliding

  const { photos } = useLocalSearchParams();
  const parsedPhotos = typeof photos === "string" ? JSON.parse(photos) : [];

  // Slide photos every 3 seconds
  useEffect(() => {
    if (parsedPhotos.length === 0) return;
    const interval = setInterval(() => {
      translateX.value = -300; // Slide out to the left
      opacity.value = 0; // Fade out
      setTimeout(() => {
        setCurrentPhotoIndex((prev) => {
          const nextIndex = (prev + 1) % parsedPhotos.length; // Correct array
          return nextIndex;
        });
        translateX.value = 300; // Reset to right for next slide
        opacity.value = 0;
        setTimeout(() => {
          translateX.value = 0; // Slide in from right
          opacity.value = 1; // Fade in
        }, 100);
      }, 500);
    }, 3000); // Every 3 seconds

    return () => clearInterval(interval);
  }, [parsedPhotos.length]); // Correct dependency

  // Load audio when component mounts
  useEffect(() => {
    loadAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync(); // Unload audio when leaving
      }
    };
  }, []);

  async function loadAudio() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/audio/background-music.mp3"),
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
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

  // Request permission to access media library
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

  // Check file type of the current photo
  async function checkFileType(uri: string) {
    const info = await FileSystem.getInfoAsync(uri);
    console.log("File Info:", info);
  }
  useEffect(() => {
    if (parsedPhotos[currentPhotoIndex]?.uri) {
      checkFileType(parsedPhotos[currentPhotoIndex]?.uri);
    }
  }, [currentPhotoIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(opacity.value, { duration: 500 }),
    transform: [
      { translateX: withTiming(translateX.value, { duration: 500 }) },
    ],
  }));

  // Stops the audio when:-
  // Pressing the hardware back button on Android.
  // Using the header back button.
  // Navigating away from the PreviewScreen.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true; // To prevent race conditions
      const stopAudioOnBack = async () => {
        if (soundRef.current && isMounted) {
          console.log("Stopping audio...");
          await soundRef.current.stopAsync(); // Stop audio properly
        }
      };

      // Handle hardware back button (Android)
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          stopAudioOnBack(); // Stop audio on back
          router.back(); // Navigate back
          return true; // Prevent default back behavior
        }
      );

      return () => {
        isMounted = false; // Clean up flag
        stopAudioOnBack(); // Stop audio when unmounting
        backHandler.remove(); // Clean up back handler
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (soundRef.current) {
              soundRef.current.stopAsync(); // Stop audio on header back
            }
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
              animatedStyle,
              // {
              //   width: 300, // Temporary width
              //   height: 500, // Temporary height
              //   borderWidth: 1,
              //   borderColor: "#fff",
              //   resizeMode: "cover", // Replace objectFit with this
              //   backgroundColor: "#000", // Add this to make it visible
              // },
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
            if (soundRef.current) {
              if (isPlaying) {
                soundRef.current.pauseAsync(); // Pause the audio
              } else {
                soundRef.current.playAsync(); // Play the audio
              }
              setIsPlaying(!isPlaying);
            }
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
