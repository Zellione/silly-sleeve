import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUploadPanel from './ImageUploadPanel';

const baseProps = {
  aspectRatio: '3/4',
  dropText: 'Drop a portrait',
  recommendedSize: '832×1216',
  maxSize: 'up to 10 MB',
  defaultCrop: 'Center',
  defaultResize: 'Fit',
  onUseImage: vi.fn(),
};

function makeImageFile(name = 'dropped.png', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

// Dispatch a standard HTML5 drop carrying files onto the dropzone. jsdom's
// DragEvent constructor does not reliably carry a DataTransfer, so the
// dataTransfer property is attached to a bubbling Event — React's synthetic
// handler only reads e.dataTransfer.files.
function dropFile(zone: HTMLElement, file: File) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [file] },
  });
  zone.dispatchEvent(event);
}

describe('ImageUploadPanel', () => {
  it('shows a file dropped on the dropzone', async () => {
    const { container } = render(<ImageUploadPanel {...baseProps} />);
    const zone = container.querySelector('.img-dropzone') as HTMLElement;

    dropFile(zone, makeImageFile('dropped.png', 2 * 1024 * 1024));

    await waitFor(() => {
      expect(document.body.textContent).toContain('dropped.png');
    });
    expect(document.body.textContent).toContain('2.0 MB');
  });

  it('ignores a drop without files', () => {
    const { container } = render(<ImageUploadPanel {...baseProps} />);
    const zone = container.querySelector('.img-dropzone') as HTMLElement;

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [] } });
    zone.dispatchEvent(event);

    expect(document.body.textContent).toContain('None — drop or browse on the left.');
  });

  it('passes the dropped image data URL to onUseImage', async () => {
    const onUseImage = vi.fn();
    const { container } = render(<ImageUploadPanel {...baseProps} onUseImage={onUseImage} />);
    const zone = container.querySelector('.img-dropzone') as HTMLElement;

    dropFile(zone, makeImageFile('dropped.png', 1024));

    await waitFor(() => screen.getByText('Use image'));
    await userEvent.click(screen.getByText('Use image'));
    expect(onUseImage).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
    );
  });

  it('reads a file chosen through the browse input', async () => {
    const user = userEvent.setup();
    const { container } = render(<ImageUploadPanel {...baseProps} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, makeImageFile('picked.png', 512));

    await waitFor(() => {
      expect(document.body.textContent).toContain('picked.png');
    });
  });

  it('clears the selection with "Choose a different file"', async () => {
    const { container } = render(<ImageUploadPanel {...baseProps} />);
    const zone = container.querySelector('.img-dropzone') as HTMLElement;
    dropFile(zone, makeImageFile('one.png', 512));
    await waitFor(() => screen.getByText('Choose a different file'));
    await userEvent.click(screen.getByText('Choose a different file'));
    expect(document.body.textContent).toContain('None — drop or browse on the left.');
  });
});
