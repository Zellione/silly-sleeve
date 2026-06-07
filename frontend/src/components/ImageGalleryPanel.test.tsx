import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageGalleryPanel from './ImageGalleryPanel';

describe('ImageGalleryPanel', () => {
  const baseProps = {
    headLabel: 'Generated',
    variantCount: 2,
    onClear: vi.fn(),
    galleryContent: <div data-testid="gallery-content">gallery here</div>,
    showMetadata: true,
    selectedLabel: 'Selected · #1',
    metadataItems: [
      { label: 'Seed', value: '42' },
      { label: 'Steps', value: '28' },
    ],
    onUseImage: vi.fn(),
    useImageLabel: 'Use as portrait',
    useImageDisabled: false,
  };

  it('renders head label with variant count', () => {
    render(<ImageGalleryPanel {...baseProps} />);
    expect(screen.getByText('Generated · 2')).toBeInTheDocument();
  });

  it('renders gallery content', () => {
    render(<ImageGalleryPanel {...baseProps} />);
    expect(screen.getByTestId('gallery-content')).toBeInTheDocument();
  });

  it('shows metadata when showMetadata is true', () => {
    render(<ImageGalleryPanel {...baseProps} />);
    expect(screen.getByText('Selected · #1')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('hides metadata when showMetadata is false', () => {
    render(<ImageGalleryPanel {...baseProps} showMetadata={false} />);
    expect(screen.queryByText('Selected · #1')).not.toBeInTheDocument();
    expect(screen.queryByText('Re-roll with these params')).not.toBeInTheDocument();
  });

  it('calls onClear when clicking clear button', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<ImageGalleryPanel {...baseProps} onClear={onClear} />);
    const clearBtn = screen.getByText('Generated · 2').parentElement?.querySelector('button');
    expect(clearBtn).toBeTruthy();
    await user.click(clearBtn!);
    expect(onClear).toHaveBeenCalled();
  });

  it('calls onUseImage when clicking use image button', async () => {
    const user = userEvent.setup();
    const onUseImage = vi.fn();
    render(<ImageGalleryPanel {...baseProps} onUseImage={onUseImage} />);
    await user.click(screen.getByText('Use as portrait'));
    expect(onUseImage).toHaveBeenCalled();
  });

  it('disables use image button when useImageDisabled is true', () => {
    render(<ImageGalleryPanel {...baseProps} useImageDisabled={true} />);
    const btn = screen.getByText('Use as portrait').closest('button');
    expect(btn).toBeDisabled();
  });

  it('renders use image label', () => {
    render(<ImageGalleryPanel {...baseProps} useImageLabel="Use as project image" />);
    expect(screen.getByText('Use as project image')).toBeInTheDocument();
  });

  it('renders custom reroll label', () => {
    render(<ImageGalleryPanel {...baseProps} rerollLabel="Re-roll variants" />);
    expect(screen.getByText('Re-roll variants')).toBeInTheDocument();
  });

  it('renders custom download label', () => {
    render(<ImageGalleryPanel {...baseProps} downloadLabel="Save PNG" />);
    expect(screen.getByText('Save PNG')).toBeInTheDocument();
  });

  it('renders default reroll and download labels', () => {
    render(<ImageGalleryPanel {...baseProps} />);
    expect(screen.getByText('Re-roll with these params')).toBeInTheDocument();
    expect(screen.getByText('Save PNG only')).toBeInTheDocument();
  });
});
