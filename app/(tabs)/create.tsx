import { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Trash2, Play } from "lucide-react-native";
import { Link } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as FileSystem from "expo-file-system";

const MAX_PHOTOS = 12;

export default function CreateScreen() {
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);

  async function savePhoto(uri: string) {
    const fileName = uri.split("/").pop(); // Extract file name
    const newPath = `${FileSystem.documentDirectory}${fileName}`; // Save to app's permanent storage

    try {
      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });
      console.log("File moved successfully:", newPath);
      return newPath;
    } catch (error) {
      console.log("Error moving file:", error);
      return uri; // Return original URI if moving fails
    }
  }

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      const savedPhotos = await Promise.all(
        result.assets.map(async (photo) => {
          const newUri = await savePhoto(photo.uri); // Save photo
          return { ...photo, uri: newUri }; // Update photo with new path
        })
      );

      if (savedPhotos.length + photos.length <= MAX_PHOTOS) {
        setPhotos([...photos, ...savedPhotos]);
      } else {
        alert(`You can only select up to ${MAX_PHOTOS} photos!`);
      }
    } else {
      console.log("Photo selection cancelled");
    }
  };

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) =>
      current.filter((photo) => photo.assetId !== id && photo.uri !== id)
    );
  }, []);

  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Sorry, we need media library permissions to proceed!");
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Video</Text>
        {photos.length > 0 && (
          <Link
            href={{
              pathname: "/preview",
              params: { photos: JSON.stringify(photos) },
            }}
            asChild
          >
            <TouchableOpacity style={styles.previewButton}>
              <Play size={20} color="#fff" />
              <Text style={styles.previewText}>Preview</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <Animated.View
            key={photo.assetId || photo.uri}
            entering={FadeIn.delay(index * 100)}
            exiting={FadeOut}
            style={styles.photoContainer}
          >
            <Image
              source={{ uri: photo.uri }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removePhoto(photo.assetId || photo.uri)}
            >
              <Trash2 size={16} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        ))}

        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[styles.photoContainer, styles.addButton]}
            onPress={pickPhotos}
          >
            <ImagePlus size={32} color="#fff" />
            <Text style={styles.addText}>
              Add Photos ({photos.length}/{MAX_PHOTOS})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {photos.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Select up to {MAX_PHOTOS} photos to create your video
          </Text>
          <TouchableOpacity style={styles.startButton} onPress={pickPhotos}>
            <ImagePlus size={24} color="#fff" />
            <Text style={styles.startText}>Select Photos</Text>
          </TouchableOpacity>
        </View>
      )}
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  previewText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  photoGrid: {
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoContainer: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 6,
  },
  addButton: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333",
    borderStyle: "dashed",
  },
  addText: {
    color: "#fff",
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  startText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
