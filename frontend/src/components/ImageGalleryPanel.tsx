import React, { type ReactNode } from 'react';
import { TrashIcon, DownloadIcon, RerollIcon, CheckIcon } from '../icons';

interface ImageGalleryPanelProps {
  headLabel: string;
  variantCount: number;
  onClear: () => void;

  galleryContent: ReactNode;
  showMetadata: boolean;
  selectedLabel: string;

  metadataItems: { label: string; value: string }[];
  rerollLabel?: string;
  downloadLabel?: string;

  onUseImage: () => void;
  useImageLabel: string;
  useImageDisabled: boolean;
}

const ImageGalleryPanel: React.FC<ImageGalleryPanelProps> = ({
  headLabel, variantCount, onClear,
  galleryContent, showMetadata, selectedLabel,
  metadataItems, rerollLabel = 'Re-roll with these params', downloadLabel = 'Save PNG only',
  onUseImage, useImageLabel, useImageDisabled,
}) => (
    <div className="img-col">
      <div className="img-col-head">
        <b>{headLabel} · {variantCount}</b>
        <button className="btn ghost sm" onClick={onClear}><TrashIcon size={11} /></button>
      </div>
      <div className="img-col-body scroll">
        {galleryContent}
        {showMetadata && (
          <>
            <div className="img-divline" />
            <span className="uplabel">{selectedLabel}</span>
            <div className="img-kv">
              {metadataItems.map(item => (
                <React.Fragment key={item.label}>
                  <label>{item.label}</label>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{item.value}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="img-divline" />
            <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
              <RerollIcon size={11} /> {rerollLabel}
            </button>
            <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
              <DownloadIcon size={11} /> {downloadLabel}
            </button>
          </>
        )}
      </div>
      <div className="img-col-foot">
        <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }}
          onClick={onUseImage} disabled={useImageDisabled}>
          <CheckIcon size={13} /> {useImageLabel}
        </button>
      </div>
    </div>
  );

export default ImageGalleryPanel;
