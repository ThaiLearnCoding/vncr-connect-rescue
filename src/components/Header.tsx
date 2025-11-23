import React from 'react';
import { LifeBuoy, ArrowLeft } from 'lucide-react';
import { AppMode } from '../types';

interface HeaderProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, setMode }) => {
  return (
    <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setMode('landing')}>
          <LifeBuoy className="text-red-500 w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight">VNCR <span className="text-red-500">Connect-Rescue</span></h1>
        </div>
        
        {mode !== 'landing' && (
          <button 
            onClick={() => setMode('landing')}
            className="flex items-center text-sm text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Đổi Chế độ
          </button>
        )}
      </div>
    </header>
  );
};