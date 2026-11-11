import React, { useState, useEffect } from 'react';
import { getSystemLogo } from '../../services/storage';

interface CollegeLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  lightText?: boolean;
}

export const CollegeLogo: React.FC<CollegeLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  lightText = true,
}) => {
  const [logoSrc, setLogoSrc] = useState<string>(() => getSystemLogo());

  useEffect(() => {
    const handleLogoUpdate = () => {
      setLogoSrc(getSystemLogo());
    };

    window.addEventListener('osas_storage_updated', handleLogoUpdate);
    window.addEventListener('osas_logo_updated', handleLogoUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleLogoUpdate);
      window.removeEventListener('osas_logo_updated', handleLogoUpdate);
    };
  }, []);

  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  };

  const imageSize = sizeMap[size] || 'w-9 h-9';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoSrc}
        alt="Dingalan Community College Seal"
        className={`${imageSize} object-contain shrink-0 drop-shadow-xs transition-transform hover:scale-105 rounded-md`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/dcc_logo.svg';
        }}
      />
      {showText && (
        <div className="flex flex-col text-left truncate">
          <span
            className={`text-sm font-black tracking-wider uppercase leading-tight ${
              lightText ? 'text-white' : 'text-slate-900'
            }`}
          >
            Dingalan Community College
          </span>
          <span
            className={`text-[10px] font-bold tracking-tight ${
              lightText ? 'text-blue-200' : 'text-blue-700'
            }`}
          >
            Office of Student Affairs & Services (OSAS)
          </span>
        </div>
      )}
    </div>
  );
};

