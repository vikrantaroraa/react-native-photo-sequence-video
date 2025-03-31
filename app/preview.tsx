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
  useSharedValue,
} from "react-native-reanimated";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";
import { FFmpegKit, ReturnCode } from "ffmpeg-kit-react-native";
import { Asset } from "expo-asset";

export default function PreviewScreen() {
  const soundRef = useRef<Audio.Sound | null>(null); // Ref for audio

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const opacity = useSharedValue(1); // Shared value for fade effect
  const translateX = useSharedValue(0); // Position for sliding
  const { photos } = useLocalSearchParams();
  const parsedPhotos = typeof photos === "string" ? JSON.parse(photos) : [];

  // Slide photos every 3 seconds
  useEffect(() => {
    if (parsedPhotos.length === 0) return;

    // Start time tracking
    const start = Date.now();

    // Use a timer to track elapsed time accurately
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 1000);

    // Setup photo transition interval
    const interval = setInterval(() => {
      translateX.value = -300; // Slide out to the left
      opacity.value = 0; // Fade out
      setTimeout(() => {
        setCurrentPhotoIndex((prev) => {
          const nextIndex = (prev + 1) % parsedPhotos.length; // Correct array
          // Check file type only when photo changes
          if (parsedPhotos[nextIndex]?.uri) {
            checkFileType(parsedPhotos[nextIndex]?.uri);
          }
          return nextIndex;
        });
        translateX.value = 300; // Reset to right for next slide
        opacity.value = 0;
        setTimeout(() => {
          translateX.value = 0; // Slide in from right
          opacity.value = 1; // Fade in
        }, 100);
      }, 500);
    }, 2500); // Every 3 seconds

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [parsedPhotos.length]); // Correct dependency

  // Load audio when component mounts
  useEffect(() => {
    loadAudio();
    return () => {
      if (soundRef.current) {
        stopAndUnloadAudio(); // Stop and unload audio when leaving
      }
    };
  }, []);

  async function loadAudio() {
    if (soundRef.current) return; // Skip if already loaded
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        require("../assets/audio/background-music.mp3"),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      console.log("Audio loaded successfully and set to loop!");
    } catch (error) {
      console.error("Error loading audio:", error);
    }
  }
  // Request permission to access media library
  useEffect(() => {
    async function checkPermission() {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        console.log("Permission to access media library was granted.");
      } else {
        console.log("Permission to access media library was denied.");
      }
    }
    checkPermission();
  }, []);

  // Check file type of the current photo
  async function checkFileType(uri: string) {
    const info = await FileSystem.getInfoAsync(uri);
    // console.log("File Info:", info);
  }

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
      // Handle hardware back button (Android)
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          stopAndUnloadAudio();
          router.back(); // Navigate back
          return true; // Prevent default back behavior
        }
      );

      return () => {
        stopAndUnloadAudio(); //  Clean up audio when navigating away
        backHandler.remove(); // Clean up back handler
      };
    }, [])
  );

  async function stopAndUnloadAudio() {
    if (soundRef.current) {
      await soundRef.current.stopAsync(); // Stop audio if playing
      await soundRef.current.unloadAsync(); // Unload audio to free resources
      soundRef.current = null; // Clear ref to avoid issues
    }
  }

  // code to stitch photos into a video with overlay sound

  // Get audio file path for FFmpeg command
  async function getAudioFilePath(): Promise<string | null> {
    const audioAsset = Asset.fromModule(
      require("../assets/audio/background-music.mp3")
    );
    await audioAsset.downloadAsync(); // Make sure the asset is ready

    // Get info about the audio file
    if (audioAsset.localUri) {
      console.log("🎵 Audio file found at:", audioAsset.localUri);
      return audioAsset.localUri.replace("file://", "");
    } else {
      console.error("❌ Audio file not found!");
      return null;
    }
  }

  useEffect(() => {
    async function loadFFmpeg() {
      console.log("🚀 Initializing FFmpeg...");
      // Run a basic command to ensure FFmpeg is ready
      await FFmpegKit.executeAsync("-version");
      console.log("✅ FFmpeg is ready for use!");
    }

    loadFFmpeg();
  }, []);

  async function checkFFmpegReady() {
    console.log("⚡️ Checking FFmpeg status...");
    await FFmpegKit.executeAsync("-version");
    console.log("✅ FFmpegKit is ready!");
  }

  // Generate a unique filename using timestamp
  const getUniqueFileName = (baseName: string, extension: string) => {
    const timestamp = Date.now(); // Get current time in milliseconds
    return `${baseName}_${timestamp}.${extension}`;
  };

  // Save the generated video in File Explorer
  async function saveToMediaLibrary(fileUri: string) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Permission to access media library is required.");
      }

      // Save video to media library (visible in file explorer or gallery)
      const asset = await MediaLibrary.createAssetAsync(fileUri);

      // Move to the Downloads folder (optional)
      const album = await MediaLibrary.getAlbumAsync("Download");
      if (album == null) {
        await MediaLibrary.createAlbumAsync("Download", asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      console.log("✅ Video saved to media library and Downloads folder!");
    } catch (error) {
      console.error("❌ Error saving to media library:", error);
    }
  }

  // Generate video and store in app's internal storage
  async function createVideoFromPhotos(
    photoUris: string[],
    outputFileName: string,
    actualDuration: number
  ) {
    try {
      // Ensure file:// prefix is removed for local file paths
      const cleanUris = photoUris.map((uri) =>
        uri.startsWith("file://") ? uri.replace("file://", "") : uri
      );

      // Use a different approach for Android file paths
      const baseDirectory =
        Platform.OS === "android"
          ? `${FileSystem.documentDirectory}` // Use documentDirectory for Android
          : FileSystem.documentDirectory;

      if (!baseDirectory) {
        throw new Error("Unable to access file system directory");
      }

      // Create a unique name for the video file
      const uniqueFileName = getUniqueFileName("final_video", "mp4");

      // Set output path with unique name
      const outputPath = `${baseDirectory}${uniqueFileName}`.replace(
        "file://",
        ""
      );

      // Calculate how many photos we need based on actual elapsed time
      // with 3 seconds per photo (match your UI preview timing)
      const photoDuration = 3; // 3 seconds per photo in the slideshow
      const secsElapsed = actualDuration / 1000; // Convert ms to seconds

      // Calculate how many complete cycles through photos have elapsed
      // and how many additional photos were shown in the partial cycle
      const fullCycles = Math.floor(
        secsElapsed / (photoDuration * photoUris.length)
      );
      const extraPhotos = Math.ceil(
        (secsElapsed % (photoDuration * photoUris.length)) / photoDuration
      );

      // Calculate total photos needed
      const totalPhotosNeeded = fullCycles * photoUris.length + extraPhotos;

      // Create the sequence of photos exactly as they appeared during preview
      let sequenceOfPhotos = [];
      for (let i = 0; i < totalPhotosNeeded; i++) {
        const photoIndex = i % photoUris.length;
        sequenceOfPhotos.push(cleanUris[photoIndex]);
      }

      // Generate FFmpeg input list matching our actual preview
      let inputList = sequenceOfPhotos
        .map((uri) => `file '${uri}'\nduration ${photoDuration}`)
        .join("\n");

      // Add the last frame with 0.1s duration (required for concat demuxer)
      const lastPhotoUri = sequenceOfPhotos[sequenceOfPhotos.length - 1];
      inputList += `\nfile '${lastPhotoUri}'\nduration 0.1`;

      // Create input list file path
      const inputListPath = `${baseDirectory}input.txt`;

      // Write the input list to a file
      try {
        // Ensure base directory exists
        await FileSystem.makeDirectoryAsync(baseDirectory, {
          intermediates: true,
        }).catch((err) => {
          console.log("Directory may already exist:", err);
        });

        // Write file
        await FileSystem.writeAsStringAsync(inputListPath, inputList);

        const fileInfo = await FileSystem.getInfoAsync(inputListPath);
        if (!fileInfo.exists) {
          throw new Error("Input list file creation failed");
        }

        // Log file info without referencing the size property directly
        console.log("✅ Input list created successfully:", {
          path: inputListPath,
          exists: fileInfo.exists,
          uri: fileInfo.uri,
        });
      } catch (error) {
        console.error("❌ Error writing input list:", error);
        throw error;
      }

      // Get audio file path
      const audioPath = await getAudioFilePath();
      if (!audioPath) {
        throw new Error("Audio file path is invalid!");
      }

      // Exact duration for our video in seconds
      const exactDuration = sequenceOfPhotos.length * photoDuration + 0.1;

      // Create two temporary files - one for video without audio, one for extended audio
      const tempVideoPath = `${baseDirectory}temp_video.mp4`.replace(
        "file://",
        ""
      );
      const tempAudioPath = `${baseDirectory}temp_audio.aac`.replace(
        "file://",
        ""
      );

      // Clean up any existing temporary files before starting
      try {
        await FileSystem.deleteAsync(tempVideoPath, { idempotent: true });
        await FileSystem.deleteAsync(tempAudioPath, { idempotent: true });
        console.log("🧹 Cleaned up existing temporary files");
      } catch (cleanupError) {
        console.log("Note: No existing temp files to clean up");
      }

      // Step 1: Create the video first (with no audio)
      const videoCmd = `-y -f concat -safe 0 -i ${inputListPath} -vf "scale=720:1280,format=yuv420p" -r 30 -pix_fmt yuv420p -t ${exactDuration} -an ${tempVideoPath}`;
      console.log("🎥 Video creation command:", videoCmd);

      const videoSession = await FFmpegKit.execute(videoCmd);
      if (!ReturnCode.isSuccess(await videoSession.getReturnCode())) {
        console.error(
          "❌ Error creating temp video:",
          await videoSession.getFailStackTrace()
        );
        throw new Error("Error creating video without audio");
      }

      // Step 2: Extract and loop audio to match the exact video duration (plus padding to be safe)
      const audioPaddedDuration = exactDuration + 1; // Add 1 second to be safe
      const audioCmd = `-y -i ${audioPath} -filter_complex "aloop=loop=-1:size=0,atrim=0:${audioPaddedDuration}" -c:a aac -b:a 192k ${tempAudioPath}`;
      console.log("🎵 Audio extraction command:", audioCmd);

      const audioSession = await FFmpegKit.execute(audioCmd);
      if (!ReturnCode.isSuccess(await audioSession.getReturnCode())) {
        console.error(
          "❌ Error extracting audio:",
          await audioSession.getFailStackTrace()
        );
        throw new Error("Error creating audio track");
      }

      // Step 3: Combine the video and audio
      const mergeCmd = `-y -i ${tempVideoPath} -i ${tempAudioPath} -c:v copy -c:a aac -shortest ${outputPath}`;
      console.log("🔄 Merging command:", mergeCmd);

      const mergeSession = await FFmpegKit.execute(mergeCmd);
      if (!ReturnCode.isSuccess(await mergeSession.getReturnCode())) {
        console.error(
          "❌ Error merging video and audio:",
          await mergeSession.getFailStackTrace()
        );
        throw new Error("Error merging video and audio");
      }

      // Clean up temporary files
      try {
        await FileSystem.deleteAsync(tempVideoPath, { idempotent: true });
        await FileSystem.deleteAsync(tempAudioPath, { idempotent: true });
        console.log("🧹 Temporary files cleaned up");
      } catch (cleanupError) {
        console.log("Warning: Could not clean up temp files:", cleanupError);
      }

      console.log("✅ Video created successfully at:", outputPath);
      // Save the file to Media Library (Gallery/Downloads)
      await saveToMediaLibrary(outputPath);
      return outputPath;
    } catch (error) {
      console.error("❗️ Error during video creation:", error);
      throw error;
    }
  }

  // Export or download video after combining photos
  async function exportVideo() {
    try {
      // Check if FFmpeg is ready before exporting
      await checkFFmpegReady();

      if (parsedPhotos?.length === 0) {
        console.error("No photos available to create video");
        return;
      }

      // Get current elapsed time in milliseconds
      const currentElapsedTime = elapsedTime;
      console.log("⏱️ Elapsed preview time:", currentElapsedTime, "ms");

      // Set final video output path
      const outputFileName = "final_video.mp4";

      // Create the video from selected photos with the exact elapsed time
      const outputPath = await createVideoFromPhotos(
        parsedPhotos.map((photo: any) => photo.uri),
        outputFileName,
        currentElapsedTime
      );

      console.log("✅ Final video ready at:", outputPath);
    } catch (error) {
      console.error("❌ Error exporting video:", error);
    }
  }

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
          <TouchableOpacity style={styles.actionButton} onPress={exportVideo}>
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
            style={[styles.previewImage, animatedStyle]}
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
