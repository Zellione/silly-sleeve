// Mirrors `defaultNegativePrompt` in image_prompts.go — the fallback inserted
// whenever auto-fill can't produce a negative prompt of its own, so a generation
// is never queued with an empty negative field.
export const DEFAULT_NEGATIVE_PROMPT =
  'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, blurry, deformed';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  return 'image/png';
}

function decodeBuffer(buffer: number[] | Uint8Array | string): Uint8Array {
  if (typeof buffer === 'string') {
    try {
      const binary = atob(buffer);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.codePointAt(i)!;
      }
      return bytes;
    } catch {
      return new Uint8Array(0);
    }
  }
  if (Array.isArray(buffer)) {
    return new Uint8Array(buffer);
  }
  if (buffer && typeof buffer.length === 'number') {
    const bytes = new Uint8Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      bytes[i] = buffer[i];
    }
    return bytes;
  }
  return new Uint8Array(0);
}

export function arrayBufferToDataURL(buffer: number[] | Uint8Array | string): string {
  const bytes = decodeBuffer(buffer);
  if (bytes.length === 0) return '';
  const base64 = bytesToBase64(bytes);
  return `data:${detectMimeType(bytes)};base64,${base64}`;
}

// Inverse of arrayBufferToDataURL: decodes a `data:<mime>;base64,<payload>` URL
// (or a bare base64 string) into a plain number[] suitable for passing to the
// Wails `[]byte` bindings (SavePortrait / SaveProjectImage).
export function dataURLToBytes(dataUrl: string): number[] {
  if (!dataUrl) return [];
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Array.from(decodeBuffer(base64));
}
