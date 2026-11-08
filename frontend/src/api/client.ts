/**
 * HTTP client for the local Silly Sleeve backend server.
 *
 * The server exposes the app's methods as a JSON RPC bridge
 * (POST /api/{Method} with a positional JSON-array body — the same call
 * shape the old Wails bindings used), an SSE stream for backend→UI events,
 * and upload/download helpers for the file flows browsers do natively.
 */

/** Error thrown for any failed RPC call or file operation. Carries the
 * server's error message (Wails-bound promises rejected with the same text). */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Call one backend method with positional arguments. Resolves to the
 * return value (null for void methods) or rejects with the server's error
 * message — the semantics every existing call site was built on. */
export async function call<T>(method: string, args: unknown[] = []): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (e) {
    // Network failure: the local server is not running.
    throw new ApiError(`cannot reach the Silly Sleeve server (${String(e)})`, 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body; handled below */
  }

  if (!res.ok) {
    const msg =
      body !== null && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `${method} failed (HTTP ${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

/** Result of a successful upload. `path` is the server-side location
 * backend methods that take a path can read. */
export interface UploadResult {
  path: string;
  name: string;
}

/** Upload a browser File (from a file dialog or drag-and-drop) to the
 * server's managed uploads directory. Returns the server-side path. */
export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch('/api/upload', { method: 'POST', body: form });
  } catch (e) {
    throw new ApiError(`cannot reach the Silly Sleeve server (${String(e)})`, 0);
  }
  if (!res.ok) {
    let msg = `upload failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body.error) msg = String(body.error);
    } catch {
      /* keep default */
    }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as UploadResult;
}

/** URL that downloads a server-side file (exports, bundles) through the
 * browser's normal download mechanism. */
export function downloadURL(path: string): string {
  return `/api/download?path=${encodeURIComponent(path)}`;
}
