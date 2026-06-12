import { describe, it, expect } from 'vitest';
import { arrayBufferToDataURL, dataURLToBytes } from './image';

function toBase64(bytes: number[]): string {
  return btoa(String.fromCodePoint(...bytes));
}

describe('arrayBufferToDataURL', () => {
  it('returns an empty string for empty input', () => {
    expect(arrayBufferToDataURL([])).toBe('');
    expect(arrayBufferToDataURL(new Uint8Array(0))).toBe('');
    expect(arrayBufferToDataURL('')).toBe('');
  });

  it('creates a data URL with image/png for PNG data', () => {
    const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const result = arrayBufferToDataURL(pngHeader);
    expect(result).toBe(`data:image/png;base64,${toBase64(pngHeader)}`);
  });

  it('creates a data URL with image/jpeg for JPEG data', () => {
    const jpegHeader = [0xFF, 0xD8, 0xFF, 0xE0];
    const result = arrayBufferToDataURL(jpegHeader);
    expect(result).toBe(`data:image/jpeg;base64,${toBase64(jpegHeader)}`);
  });

  it('creates a data URL with image/webp for WEBP data', () => {
    const webpHeader = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
    const result = arrayBufferToDataURL(webpHeader);
    expect(result).toBe(`data:image/webp;base64,${toBase64(webpHeader)}`);
  });

  it('defaults to image/png for unknown formats', () => {
    const unknownData = [0x00, 0x01, 0x02, 0x03, 0x04];
    const result = arrayBufferToDataURL(unknownData);
    expect(result).toBe(`data:image/png;base64,${toBase64(unknownData)}`);
  });

  it('accepts a number array and converts to Uint8Array', () => {
    const data = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const result = arrayBufferToDataURL(data);
    expect(result).toBe(`data:image/png;base64,${toBase64(data)}`);
  });

  it('accepts a Uint8Array directly', () => {
    const data = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const result = arrayBufferToDataURL(data);
    expect(result).toBe(`data:image/jpeg;base64,${toBase64([0xFF, 0xD8, 0xFF, 0xE0])}`);
  });

  it('handles array-like objects (cross-context TypedArrays)', () => {
    const crossCtx = { 0: 0xFF, 1: 0xD8, 2: 0xFF, 3: 0xE0, length: 4 };
    const result = arrayBufferToDataURL(crossCtx as unknown as Uint8Array);
    expect(result).toBe(`data:image/jpeg;base64,${toBase64([0xFF, 0xD8, 0xFF, 0xE0])}`);
  });

  it('creates PNG data URL for array-like objects with PNG header', () => {
    const pngLike = { 0: 0x89, 1: 0x50, 2: 0x4E, 3: 0x47, 4: 0x0D, 5: 0x0A, 6: 0x1A, 7: 0x0A, length: 8 };
    const result = arrayBufferToDataURL(pngLike as unknown as Uint8Array);
    expect(result).toBe(`data:image/png;base64,${toBase64([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])}`);
  });

  it('handles WEBP array-like objects', () => {
    const webpLike = { 0: 0x52, 1: 0x49, 2: 0x46, 3: 0x46, 4: 0x00, 5: 0x00, 6: 0x00, 7: 0x00, 8: 0x57, 9: 0x45, 10: 0x42, 11: 0x50, length: 12 };
    const result = arrayBufferToDataURL(webpLike as unknown as Uint8Array);
    expect(result).toBe(`data:image/webp;base64,${toBase64([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])}`);
  });

  it('returns empty string for non-array-like input', () => {
    expect(arrayBufferToDataURL(undefined as unknown as Uint8Array)).toBe('');
    expect(arrayBufferToDataURL(null as unknown as Uint8Array)).toBe('');
  });

  it('returns empty string for array-like object with zero length', () => {
    const empty = { length: 0 };
    expect(arrayBufferToDataURL(empty as unknown as Uint8Array)).toBe('');
  });

  it('handles base64 string input (Wails v2 []byte serialization)', () => {
    const pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const b64 = toBase64(pngBytes);
    expect(arrayBufferToDataURL(b64)).toBe(`data:image/png;base64,${b64}`);
  });

  it('detects JPEG from base64 string', () => {
    const jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0];
    const b64 = toBase64(jpegBytes);
    expect(arrayBufferToDataURL(b64)).toBe(`data:image/jpeg;base64,${b64}`);
  });

  it('detects WEBP from base64 string', () => {
    const webpBytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
    const b64 = toBase64(webpBytes);
    expect(arrayBufferToDataURL(b64)).toBe(`data:image/webp;base64,${b64}`);
  });

  it('returns empty string for invalid base64', () => {
    expect(arrayBufferToDataURL('!!!not-valid!!!')).toBe('');
  });
});

describe('dataURLToBytes', () => {
  it('returns an empty array for empty input', () => {
    expect(dataURLToBytes('')).toEqual([]);
  });

  it('decodes a data URL into its raw bytes', () => {
    const pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const dataUrl = `data:image/png;base64,${toBase64(pngBytes)}`;
    expect(dataURLToBytes(dataUrl)).toEqual(pngBytes);
  });

  it('decodes a bare base64 string without a data URL prefix', () => {
    const jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0];
    expect(dataURLToBytes(toBase64(jpegBytes))).toEqual(jpegBytes);
  });

  it('round-trips with arrayBufferToDataURL', () => {
    const original = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x42, 0x99];
    expect(dataURLToBytes(arrayBufferToDataURL(original))).toEqual(original);
  });

  it('returns an empty array for invalid base64', () => {
    expect(dataURLToBytes('data:image/png;base64,!!!bad!!!')).toEqual([]);
  });
});
