import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';

export default function UploadView({ t, onUpload, onSelectPreset }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <section className="flex-1 flex flex-col items-center justify-center py-12 px-6 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 font-display">
          {t('hero_title')}
        </h1>
        <p className="text-base text-base-content/70 max-w-xl mx-auto">
          {t('hero_subtitle')}
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div className="w-full mb-8">
        <div 
          className={`border-2 border-dashed rounded-2xl bg-base-200/50 p-12 text-center cursor-pointer hover:border-primary hover:bg-base-200 transition-all duration-300 ${
            dragActive ? 'border-primary bg-base-200' : 'border-base-300'
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input 
            type="file" 
            id="fileInput" 
            accept="image/*" 
            className="hidden" 
            onChange={handleChange}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-base-300/50 border border-base-300 transition-colors duration-300 group-hover:bg-primary-transparent">
              <UploadCloud className="w-8 h-8 text-base-content/60" />
            </div>
            <h3 className="text-xl font-bold">{t('drag_drop_text')}</h3>
            <p className="text-sm text-base-content/60">{t('or_browse')}</p>
            <span className="text-xs text-base-content/40 font-mono">{t('file_formats')}</span>
          </div>
        </div>
      </div>

      {/* Preset Section */}
      <div className="w-full">
        <h4 className="text-center text-sm font-semibold text-base-content/60 mb-4 tracking-wider uppercase">
          {t('try_presets')}
        </h4>
        
        <div className="grid grid-cols-3 gap-6 w-full">
          <div 
            className="group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer border border-base-300 shadow-sm hover:border-primary hover:-translate-y-1 transition-all duration-300"
            onClick={() => onSelectPreset("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=85")}
          >
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80" alt="Portrait" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute bottom-3 left-3 bg-base-300/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-semibold border border-base-200">
              {t('preset_portrait')}
            </span>
          </div>
          
          <div 
            className="group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer border border-base-300 shadow-sm hover:border-primary hover:-translate-y-1 transition-all duration-300"
            onClick={() => onSelectPreset("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=85")}
          >
            <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80" alt="Sneaker" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute bottom-3 left-3 bg-base-300/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-semibold border border-base-200">
              {t('preset_product')}
            </span>
          </div>
          
          <div 
            className="group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer border border-base-300 shadow-sm hover:border-primary hover:-translate-y-1 transition-all duration-300"
            onClick={() => onSelectPreset("https://images.unsplash.com/photo-1526512340740-9217d0159da9?w=600&auto=format&fit=crop&q=85")}
          >
            <img src="https://images.unsplash.com/photo-1526512340740-9217d0159da9?w=300&auto=format&fit=crop&q=80" alt="Nature" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute bottom-3 left-3 bg-base-300/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-semibold border border-base-200">
              {t('preset_nature')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
