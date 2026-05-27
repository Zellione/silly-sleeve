import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DashboardIcon, GlobeIcon, PenIcon, BookIcon, ImageIcon, EyeIcon,
  CogIcon, PlusIcon, RerollIcon, SearchIcon, CheckIcon, XIcon,
  ArrowIcon, FolderIcon, SaveIcon, TrashIcon, DownloadIcon,
  UploadIcon, LinkIcon, SunIcon, MoonIcon, SparksIcon, MoreIcon,
  KeyIcon, DownIcon, BoltIcon, CopyIcon,
} from './icons';

const icons = [
  { name: 'DashboardIcon', component: DashboardIcon },
  { name: 'GlobeIcon', component: GlobeIcon },
  { name: 'PenIcon', component: PenIcon },
  { name: 'BookIcon', component: BookIcon },
  { name: 'ImageIcon', component: ImageIcon },
  { name: 'EyeIcon', component: EyeIcon },
  { name: 'CogIcon', component: CogIcon },
  { name: 'PlusIcon', component: PlusIcon },
  { name: 'RerollIcon', component: RerollIcon },
  { name: 'SearchIcon', component: SearchIcon },
  { name: 'CheckIcon', component: CheckIcon },
  { name: 'XIcon', component: XIcon },
  { name: 'ArrowIcon', component: ArrowIcon },
  { name: 'FolderIcon', component: FolderIcon },
  { name: 'SaveIcon', component: SaveIcon },
  { name: 'TrashIcon', component: TrashIcon },
  { name: 'DownloadIcon', component: DownloadIcon },
  { name: 'UploadIcon', component: UploadIcon },
  { name: 'LinkIcon', component: LinkIcon },
  { name: 'SunIcon', component: SunIcon },
  { name: 'MoonIcon', component: MoonIcon },
  { name: 'SparksIcon', component: SparksIcon },
  { name: 'MoreIcon', component: MoreIcon },
  { name: 'KeyIcon', component: KeyIcon },
  { name: 'DownIcon', component: DownIcon },
  { name: 'BoltIcon', component: BoltIcon },
  { name: 'CopyIcon', component: CopyIcon },
];

describe('icons', () => {
  describe.each(icons)('$name', ({ component: Icon }) => {
    it('renders an svg with viewBox 0 0 24 24', () => {
      const { container } = render(<Icon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('accepts size prop', () => {
      const { container } = render(<Icon size={32} />);
      const svg = container.querySelector('svg');
      expect(Number(svg!.getAttribute('width'))).toBe(32);
      expect(Number(svg!.getAttribute('height'))).toBe(32);
    });

    it('accepts className prop', () => {
      const { container } = render(<Icon className="test-class" />);
      const svg = container.querySelector('svg');
      expect(svg!.classList.contains('test-class')).toBe(true);
    });

    it('accepts style prop', () => {
      const { container } = render(<Icon style={{ color: 'red' }} />);
      const svg = container.querySelector('svg');
      expect(svg!.style.color).toBe('red');
    });

    it('renders with default size 18', () => {
      const { container } = render(<Icon />);
      const svg = container.querySelector('svg');
      expect(Number(svg!.getAttribute('width'))).toBe(18);
      expect(Number(svg!.getAttribute('height'))).toBe(18);
    });
  });
});
