import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  photoUri: string | null;
  photoError: string | null;
  disabled?: boolean;
  onChange: (uri: string | null) => void;
}

export default function PhotoPicker({ photoUri, photoError, disabled, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function pick(useCamera: boolean) {
    if (disabled || busy) return;
    setBusy(true);
    setPermissionError(null);
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermissionError(
          useCamera
            ? 'Camera permission was denied. You can still submit without a photo.'
            : 'Photo library permission was denied. You can still submit without a photo.'
        );
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.6,
            mediaTypes: ImagePicker.MediaTypeOptions.Images
          });
      if (!result.canceled && result.assets.length > 0) {
        onChange(result.assets[0].uri);
      }
    } catch {
      setPermissionError('The photo could not be selected. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      {photoUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>Photo attached</Text>
            <Text style={styles.previewHint}>Evidence is optional and will be uploaded with your report.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove attached photo"
            onPress={() => onChange(null)}
            disabled={disabled}
            style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>
          Take a photo or choose from gallery. You can submit without a photo.
        </Text>
      )}

      <View style={styles.buttonRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo with camera"
          onPress={() => pick(true)}
          disabled={disabled || busy}
          style={({ pressed }) => [styles.actionButton, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Take Photo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose photo from gallery"
          onPress={() => pick(false)}
          disabled={disabled || busy}
          style={({ pressed }) => [styles.actionButton, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Choose from Gallery</Text>
        </Pressable>
      </View>

      {permissionError ? <Text style={styles.error}>{permissionError}</Text> : null}
      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: font.small,
    marginBottom: spacing.sm
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.offlineSoft
  },
  previewInfo: {
    flex: 1
  },
  previewTitle: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600'
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: font.tiny,
    marginTop: 2
  },
  removeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger
  },
  removeText: {
    color: colors.danger,
    fontSize: font.small,
    fontWeight: '600'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.7
  },
  actionText: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '700'
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  }
});
