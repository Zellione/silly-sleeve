import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const Icon: React.FC<IconProps & { d?: string; children?: React.ReactNode; fill?: boolean }> = ({ d, size = 18, className = '', children, fill, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round"
       className={className} {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

export const DashboardIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></Icon>;
export const GlobeIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></Icon>;
export const PenIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></Icon>;
export const BookIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4V4z"/><path d="M20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8V4z"/></Icon>;
export const ImageIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M3.5 17l4.5-4.5 4 4 3.5-3 5 5"/></Icon>;
export const EyeIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></Icon>;
export const CogIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.64 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"/></Icon>;
export const PlusIcon: React.FC<IconProps> = (p) => <Icon d="M12 5v14M5 12h14" {...p} />;
export const RerollIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M3 12a9 9 0 1115.5 6.2"/><path d="M19 14v5h-5"/></Icon>;
export const SearchIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/></Icon>;
export const CheckIcon: React.FC<IconProps> = (p) => <Icon d="M4 12.5L9.5 18 20 6" {...p} />;
export const XIcon: React.FC<IconProps> = (p) => <Icon d="M6 6l12 12M18 6L6 18" {...p} />;
export const ArrowIcon: React.FC<IconProps> = (p) => <Icon d="M5 12h14M13 6l6 6-6 6" {...p} />;
export const FolderIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></Icon>;
export const SaveIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M5 4h11l4 4v11a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M7 4v5h9V4M7 14h10"/></Icon>;
export const TrashIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></Icon>;
export const DownloadIcon: React.FC<IconProps> = (p) => <Icon d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" {...p} />;
export const UploadIcon: React.FC<IconProps> = (p) => <Icon d="M12 20V8m0 0l-5 5m5-5l5 5M4 4h16" {...p} />;
export const LinkIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66L11 7"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66L13 17"/></Icon>;
export const SunIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4"/></Icon>;
export const MoonIcon: React.FC<IconProps> = (p) => <Icon d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z" {...p} />;
export const SparksIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></Icon>;
export const MoreIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/></Icon>;
export const KeyIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 3l-5 5m0 0l-2.5 2.5m2.5-2.5l-2.5 2.5m2.5-2.5l-2.5 2.5"/></Icon>;
export const DownIcon: React.FC<IconProps> = (p) => <Icon d="M6 9l6 6 6-6" {...p} />;
export const BoltIcon: React.FC<IconProps> = (p) => <Icon d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" {...p} />;
export const CopyIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect x="9" y="9" width="11" height="11" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></Icon>;
