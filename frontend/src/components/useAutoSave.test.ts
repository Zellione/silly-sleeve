import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

const mockGetSettings = vi.fn();
const mockSaveProjectBundle = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSettings: () => mockGetSettings(),
  SaveProjectBundle: () => mockSaveProjectBundle(),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'off', autoSaveInterval: 30 });
    mockSaveProjectBundle.mockResolvedValue(undefined);
  });

  it('returns handleChange and handleBlur', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave({ projectPath: '', onSave }));
    expect(result.current.handleChange).toBeDefined();
    expect(result.current.handleBlur).toBeDefined();
  });

  it('does not save when auto-save is off', () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save when projectPath is empty', () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave({ projectPath: '', onSave }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save on change when mode is off', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));
    result.current.handleChange();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save on blur when mode is off', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));
    result.current.handleBlur();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on blur when settings load with onBlur mode', async () => {
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'onBlur', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalled();
    });

    result.current.handleBlur();
    expect(onSave).toHaveBeenCalledWith('/test.slv');
  });

  it('warns on blur when projectPath is empty', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'onBlur', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ projectPath: '', onSave }));

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalled();
    });

    result.current.handleBlur();
    expect(onSave).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
    warnSpy.mockRestore();
  });

  it('warns on change debounce when projectPath is empty', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'onChange', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ projectPath: '', onSave }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.handleChange();
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('warns on timed interval when projectPath is empty', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'timed', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave({ projectPath: '', onSave }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      vi.advanceTimersByTime(31000);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('debounces save on change mode', async () => {
    vi.useFakeTimers();
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'onChange', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.handleChange();
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onSave).toHaveBeenCalledWith('/test.slv');
    vi.useRealTimers();
  });
});
