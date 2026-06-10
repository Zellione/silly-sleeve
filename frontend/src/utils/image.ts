function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function arrayBufferToDataURL(buffer: number[] | Uint8Array | string): string {
  let bytes: Uint8Array;

  if (typeof buffer === 'string') {
    try {
      const binary = atob(buffer);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } catch {
      bytes = new Uint8Array(0);
    }
  } else if (Array.isArray(buffer)) {
    bytes = new Uint8Array(buffer);
  } else if (buffer && typeof buffer.length === 'number') {
    bytes = new Uint8Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      bytes[i] = buffer[i];
    }
  } else {
    bytes = new Uint8Array(0);
  }

  if (bytes.length === 0) {
    return '';
  }

  let mimeType = 'image/png';
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    mimeType = 'image/jpeg';
  } else if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    mimeType = 'image/webp';
  }

  const base64 = bytesToBase64(bytes);
  return `data:${mimeType};base64,${base64}`;
}
