import { describe, it, expect, vi, afterEach } from 'vitest';
import { call, uploadFile, downloadURL, ApiError } from './client';

// Minimal Response stand-in: the client only reads ok, status and json().
const response = (
  init: { ok?: boolean; status?: number; body?: unknown; jsonFails?: boolean },
) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => {
    if (init.jsonFails) throw new Error('not json');
    return init.body ?? null;
  },
});

describe('ApiError', () => {
  it('carries the message and status', () => {
    const e = new ApiError('boom', 400);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ApiError');
    expect(e.message).toBe('boom');
    expect(e.status).toBe(400);
  });
});

describe('call', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the positional args and resolves with the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ body: { id: 7 } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(call('CountTokens', ['abc'])).resolves.toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/CountTokens');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '["abc"]',
    });
  });

  it('resolves null for void methods (non-JSON body)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ jsonFails: true })));
    await expect(call('ClearCrawl')).resolves.toBeNull();
  });

  it('rejects with the server error message and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, status: 400, body: { error: 'no such character' } })),
    );
    await expect(call('GetCharacters')).rejects.toMatchObject({
      message: 'no such character',
      status: 400,
    });
    await expect(call('GetCharacters')).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects with a default message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, status: 500, jsonFails: true })),
    );
    await expect(call('SaveSettings')).rejects.toMatchObject({
      message: 'SaveSettings failed (HTTP 500)',
      status: 500,
    });
  });

  it('wraps network failures as "cannot reach the server"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(call('GetSettings')).rejects.toMatchObject({
      status: 0,
    });
    await expect(call('GetSettings')).rejects.toMatchObject({
      message: expect.stringContaining('cannot reach the Silly Sleeve server'),
    });
  });
});

describe('uploadFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the file as multipart and resolves with the server path', async () => {
    const file = new File([new Uint8Array(8)], 'a.png', { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue(response({ body: { path: '/uploads/a.png', name: 'a.png' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadFile(file)).resolves.toEqual({ path: '/uploads/a.png', name: 'a.png' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/upload');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
  });

  it('rejects with the server error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, status: 413, body: { error: 'file too large' } })),
    );
    await expect(uploadFile(new File([], 'big.png'))).rejects.toMatchObject({
      message: 'file too large',
      status: 413,
    });
  });

  it('falls back to a default message when the failure body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ ok: false, status: 500, jsonFails: true })),
    );
    await expect(uploadFile(new File([], 'x.png'))).rejects.toMatchObject({
      message: 'upload failed (HTTP 500)',
      status: 500,
    });
  });

  it('wraps network failures as "cannot reach the server"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(uploadFile(new File([], 'x.png'))).rejects.toMatchObject({ status: 0 });
  });
});

describe('downloadURL', () => {
  it('builds an encoded download URL', () => {
    expect(downloadURL('/home/u/exports/a b.png')).toBe(
      '/api/download?path=%2Fhome%2Fu%2Fexports%2Fa%20b.png',
    );
  });
});
