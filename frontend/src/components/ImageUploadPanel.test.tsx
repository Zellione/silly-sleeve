import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUploadPanel from './ImageUploadPanel';

const mockReadImageFile = vi.fn();
vi.mock('../../wailsjs/go/main/App', () => ({
  ReadImageFile: (path: string) => mockReadImageFile(path),
}));

vi.mock('../../wailsjs/runtime/runtime', () => ({
  OnFileDrop: vi.fn(),
  OnFileDropOff: vi.fn(),
}));

import { OnFileDrop, OnFileDropOff } from '../../wailsjs/runtime/runtime';

const baseProps = {
  aspectRatio: '3/4',
  dropText: 'Drop a portrait',
  recommendedSize: '832×1216',
  maxSize: 'up to 10 MB',
  defaultCrop: 'Center',
  defaultResize: 'Fit',
  onUseImage: vi.fn(),
};

describe('ImageUploadPanel native file drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadImageFile.mockResolvedValue({
      name: 'dropped.png', size: 2 * 1024 * 1024, dataUrl: 'data:image/png;base64,AAAA',
    });
  });

  it('marks the dropzone as a Wails drop target', () => {
    const { container } = render(<ImageUploadPanel {...baseProps} />);
    const zone = container.querySelector('.img-dropzone') as HTMLElement;
    expect(zone.style.getPropertyValue('--wails-drop-target')).toBe('drop');
  });

  it('registers a native file-drop handler and unregisters on unmount', () => {
    const { unmount } = render(<ImageUploadPanel {...baseProps} />);
    expect(OnFileDrop).toHaveBeenCalledWith(expect.any(Function), true);
    unmount();
    expect(OnFileDropOff).toHaveBeenCalled();
  });

  it('reads a dropped file path and shows the file', async () => {
    render(<ImageUploadPanel {...baseProps} />);
    const dropCallback = (OnFileDrop as unknown as Mock).mock.calls[0][0];

    dropCallback(0, 0, ['/home/user/pics/dropped.png']);

    await waitFor(() => {
      expect(mockReadImageFile).toHaveBeenCalledWith('/home/user/pics/dropped.png');
      expect(document.body.textContent).toContain('dropped.png');
      expect(document.body.textContent).toContain('2.0 MB');
    });
  });

  it('ignores an empty drop', () => {
    render(<ImageUploadPanel {...baseProps} />);
    const dropCallback = (OnFileDrop as unknown as Mock).mock.calls[0][0];
    dropCallback(0, 0, []);
    expect(mockReadImageFile).not.toHaveBeenCalled();
  });

  it('passes the dropped image data URL to onUseImage', async () => {
    const onUseImage = vi.fn();
    render(<ImageUploadPanel {...baseProps} onUseImage={onUseImage} />);
    const dropCallback = (OnFileDrop as unknown as Mock).mock.calls[0][0];
    dropCallback(0, 0, ['/home/user/pics/dropped.png']);
    await waitFor(() => screen.getByText('Use image'));
    await userEvent.click(screen.getByText('Use image'));
    expect(onUseImage).toHaveBeenCalledWith('data:image/png;base64,AAAA');
  });
});
