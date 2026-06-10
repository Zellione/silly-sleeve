import React, { useState, useRef, useEffect, useId } from 'react';
import { UploadIcon, ImageIcon, CheckIcon, FolderIcon, DownloadIcon } from '../icons';

export interface UploadFileInfo {
  name: string;
  size: string;
  dims: string;
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = url;
  });
}

interface ImageUploadPanelProps {
  aspectRatio: string;
  dropText: string;
  recommendedSize: string;
  maxSize: string;
  defaultCrop: string;
  defaultResize: string;
  onUseImage: () => void;
}

const ImageUploadPanel: React.FC<ImageUploadPanelProps> = ({
  aspectRatio,
  dropText,
  recommendedSize,
  maxSize,
  defaultCrop,
  defaultResize,
  onUseImage,
}) => {
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<UploadFileInfo | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const uid = useId();

  const processFile = (file: File) => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadFile({ name: file.name, size: `${sizeMB} MB`, dims: '…×…' });
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImageData(url);
      loadImageDimensions(url).then(({ width, height }) => {
        setUploadFile(prev => prev ? { ...prev, dims: `${width}×${height}` } : null);
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    /* v8 ignore start */
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    /* v8 ignore stop */
  };

  useEffect(() => {
    const suppressDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('dragover', suppressDefaults);
    document.addEventListener('drop', suppressDefaults);
    return () => {
      document.removeEventListener('dragover', suppressDefaults);
      document.removeEventListener('drop', suppressDefaults);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageData?.startsWith('blob:')) {
        URL.revokeObjectURL(imageData);
      }
    };
  }, [imageData]);

  const handleDragEnter = () => {
    dragCounterRef.current += 1;
    setDragging(true);
  };

  const handleDragLeave = () => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="img-upload-grid">
      <button
        type="button"
        className={`img-dropzone${dragging ? ' dragging' : ''}`}
        style={{ aspectRatio }}
        onDragEnter={/* v8 ignore next */ handleDragEnter}
        onDragOver={e => { e.preventDefault(); }}
        onDragLeave={/* v8 ignore next */ handleDragLeave}
        onDrop={/* v8 ignore next */ handleDrop}
        onClick={() => fileInputRef.current?.click()}
        /* v8 ignore next */
        onKeyDown={e => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        {uploadFile ? (
          <div className="img-upload-preview" style={{ aspectRatio }}>
            {imageData ? (
              <img src={imageData} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span>{uploadFile.dims}</span>
            )}
          </div>
        ) : (
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <UploadIcon size={32} style={{ color: 'var(--ink-3)' }} />
            <div className="serif-i" style={{ fontSize: 28 }}>{dropText}</div>
            <div className="helpr">{recommendedSize}<br />{maxSize}</div>
            <span className="btn ghost" aria-hidden="true"><FolderIcon size={14} /> Browse files</span>
          </div>
        )}
      </button>
      <div className="col" style={{ gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <span className="uplabel">Selected file</span>
          {uploadFile ? (
            <div className="col" style={{ gap: 8, marginTop: 8 }}>
              <div className="row" style={{ gap: 10 }}>
                <ImageIcon size={20} />
                <div className="col" style={{ gap: 2 }}>
                  <b style={{ fontSize: 13 }}>{uploadFile.name}</b>
                  <span className="helpr">{uploadFile.dims} · {uploadFile.size}</span>
                </div>
              </div>
              <div className="img-divline" />
              <div className="img-kv">
                <label htmlFor={`${uid}-crop`}>Crop</label>
                <select id={`${uid}-crop`} style={{ width: 'auto' }}><option>{defaultCrop}</option><option>None</option></select>
                <label htmlFor={`${uid}-resize`}>Resize</label>
                <select id={`${uid}-resize`} style={{ width: 'auto' }}><option>{defaultResize}</option><option>Original</option></select>
              </div>
              <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={onUseImage}>
                <CheckIcon size={13} /> Use image
              </button>
              <button className="btn ghost sm" onClick={() => { setUploadFile(null); setImageData(null); }}>
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="helpr" style={{ marginTop: 6 }}>None — drop or browse on the left.</div>
          )}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <span className="uplabel">Or paste a URL</span>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <input className="field" placeholder="https://…" />
            <button className="btn ghost"><DownloadIcon size={13} /></button>
          </div>
          <p className="helpr" style={{ marginTop: 8 }}>We'll fetch the image and store a local copy in your project.</p>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadPanel;
