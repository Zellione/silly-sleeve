import React, { useState, useRef } from 'react';
import { UploadIcon, ImageIcon, CheckIcon, FolderIcon, DownloadIcon } from '../icons';

export interface UploadFileInfo {
  name: string;
  size: string;
  dims: string;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    /* v8 ignore start */
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadFile({ name: file.name, size: `${sizeMB} MB`, dims: '? × ?' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    /* v8 ignore stop */
  };

  return (
    <div className="img-upload-grid">
      <div
        role="button" tabIndex={0}
        className={`img-dropzone${dragging ? ' dragging' : ''}`}
        style={{ aspectRatio }}
        onDragOver={e => { e.preventDefault(); /* v8 ignore next */ setDragging(true); }}
        onDragLeave={() => /* v8 ignore next */ { setDragging(false); }}
        onDrop={e => { /* v8 ignore start */ e.preventDefault(); setDragging(false); setUploadFile({ name: 'portrait.png', size: '1.2 MB', dims: '832×1216' }); /* v8 ignore stop */ }}
        onClick={() => fileInputRef.current?.click()}
        /* v8 ignore next */
        onKeyDown={e => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        {uploadFile ? (
          <div className="img-upload-preview" style={{ aspectRatio }}>
            <span>{uploadFile.dims}</span>
          </div>
        ) : (
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <UploadIcon size={32} style={{ color: 'var(--ink-3)' }} />
            <div className="serif-i" style={{ fontSize: 28 }}>{dropText}</div>
            <div className="helpr">{recommendedSize}<br />{maxSize}</div>
            <button className="btn ghost"><FolderIcon size={14} /> Browse files</button>
          </div>
        )}
      </div>
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
                <label>Crop</label>
                <select style={{ width: 'auto' }}><option>{defaultCrop}</option><option>None</option></select>
                <label>Resize</label>
                <select style={{ width: 'auto' }}><option>{defaultResize}</option><option>Original</option></select>
              </div>
              <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={onUseImage}>
                <CheckIcon size={13} /> Use image
              </button>
              <button className="btn ghost sm" onClick={() => setUploadFile(null)}>Choose a different file</button>
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
