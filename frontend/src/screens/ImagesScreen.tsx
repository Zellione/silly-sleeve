import React, { useState } from 'react';
import PortraitScreen from './PortraitScreen';
import ProjectImageScreen from './ProjectImageScreen';

interface ImagesScreenProps {
  projectPath: string;
}

/**
 * Images tab — merges the per-character portrait generator and the
 * project cover screen behind a segmented sub-tab bar (v2 design).
 */
export const ImagesScreen: React.FC<ImagesScreenProps> = ({ projectPath }) => {
  const [sub, setSub] = useState<'portraits' | 'cover'>('portraits');

  return (
    <>
      <div className="v2-images-subbar">
        <div className="v2-subseg">
          <button type="button"
            data-on={sub === 'portraits' ? '1' : '0'}
            onClick={() => setSub('portraits')}>
            Character portraits
          </button>
          <button type="button"
            data-on={sub === 'cover' ? '1' : '0'}
            onClick={() => setSub('cover')}>
            Project cover
          </button>
        </div>
        <span className="uplabel">
          {sub === 'portraits' ? 'per-character · comfyui or upload' : 'one per project · shown on export'}
        </span>
      </div>
      <div className="v2-images-body">
        {sub === 'portraits'
          ? <PortraitScreen projectPath={projectPath} />
          : <ProjectImageScreen projectPath={projectPath} />}
      </div>
    </>
  );
};

export default ImagesScreen;
