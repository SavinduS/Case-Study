import { MAX_PHOTO_BYTES } from '../constants/fieldIncident';

export { MAX_PHOTO_BYTES };

// JPEG/PNG only when a photo is supplied (mirrors
// backend/utils/fieldIncidentTypes.js FIELD_INCIDENT_ALLOWED_PHOTO_MIMETYPES).
const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

function extensionOf(uri: string): string {
  const name = (uri.split('/').pop() || '').split('?')[0];
  if (!name.includes('.')) return '';
  return (name.split('.').pop() || '').toLowerCase();
}

/** Sync extension check. Null uri (no photo) is valid — photos are optional. */
export function photoExtensionError(photoUri: string | null): string | null {
  if (!photoUri) return null;
  const ext = extensionOf(photoUri);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return 'Only JPEG or PNG photos are supported.';
  }
  return null;
}

/**
 * Best-effort file-size lookup. Returns bytes, or null when the size cannot
 * be determined (mocked FS in tests, missing file, older API). Null means
 * "unknown" — the caller must allow it and let the server (413) be the
 * authority rather than blocking a valid report.
 */
export async function getPhotoBytes(photoUri: string): Promise<number | null> {
  try {
    // Lazy require keeps this module importable under plain node/vitest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FS = require('expo-file-system') as {
      File?: new (uri: string) => {
        size?: number | null;
        info?: () => { size?: number } | null;
      };
      getInfoAsync?: (uri: string, opts?: object) => Promise<{ size?: number } | null>;
    };
    if (FS.File) {
      const file = new FS.File(photoUri);
      if (typeof file.size === 'number') return file.size;
      const info = typeof file.info === 'function' ? file.info() : null;
      if (info && typeof info.size === 'number') return info.size;
    }
    if (typeof FS.getInfoAsync === 'function') {
      const legacy = await FS.getInfoAsync(photoUri, { size: true });
      if (legacy && typeof legacy.size === 'number') return legacy.size;
    }
  } catch {
    // fall through to null below
  }
  return null;
}

/**
 * Full async photo validation: extension first, then size when readable.
 * Null photoUri is valid (optional evidence). Returns the error message or
 * null when the photo is acceptable (or its size is unknown — the server
 * re-checks with 413/415 before storing).
 */
export async function validatePhotoUriAsync(photoUri: string | null): Promise<string | null> {
  const extError = photoExtensionError(photoUri);
  if (extError || !photoUri) return extError;
  const bytes = await getPhotoBytes(photoUri);
  if (typeof bytes === 'number' && bytes > MAX_PHOTO_BYTES) {
    return 'Photo exceeds the 5 MB limit. Choose a smaller photo or remove it.';
  }
  return null;
}
