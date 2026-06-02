import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

  it('debounces save on change mode', async () => {
    vi.useFakeTimers();
    mockGetSettings.mockResolvedValue({ endpoints: [], autoSaveMode: 'onChange', autoSaveInterval: 30 });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave({ projectPath: '/test.slv', onSave }));

    await vi.runAllTimersAsync();

    result.current.handleChange();
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2500);
    expect(onSave).toHaveBeenCalledWith('/test.slv');
    vi.useRealTimers();
  });
});
