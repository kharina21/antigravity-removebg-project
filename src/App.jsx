import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown, Sun, Moon } from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';

import { translations } from './utils/translations';
import UploadView from './components/UploadView';
import ProcessingView from './components/ProcessingView';
import EditorWorkspace from './components/EditorWorkspace';

export default function App() {
  const [lang, setLang] = useState(localStorage.getItem('aura_cut_lang') || 'vi');
  const [theme, setTheme] = useState(localStorage.getItem('aura_cut_theme') || 'night'); // 'night' (slate dark) or 'light'
  
  // Navigation: 'UPLOAD', 'PROCESSING', 'EDITOR'
  const [view, setView] = useState('UPLOAD');

  // Processing state
  const [statusText, setStatusText] = useState('');
  const [progressVal, setProgressVal] = useState(0);

  // Loaded images
  const [originalImage, setOriginalImage] = useState(null);
  const [cutoutImage, setCutoutImage] = useState(null);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aura_cut_theme', theme);
  }, [theme]);

  // Translation helper
  const t = (key) => {
    return translations[lang]?.[key] || key;
  };

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('aura_cut_lang', newLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'night' ? 'light' : 'night');
  };

  const loadImageFromBlob = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image decode error'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(blob);
    });
  };

  const runAiBackgroundRemoval = async (imageBlob) => {
    try {
      setStatusText(t('loading_init'));
      setProgressVal(10);
      setView('PROCESSING');

      // Load original image first
      const origImg = await loadImageFromBlob(imageBlob);
      setOriginalImage(origImg);

      // AI Config pointing to unpkg CDN chunks for fast download in all regions
      const config = {
        debug: true,
        publicPath: "https://unpkg.com/@imgly/background-removal-data@1.4.5/dist/",
        progress: (stage, progressValue) => {
          let text = t('loading_processing');
          let pct = Math.round(progressValue * 100);

          if (stage.includes('fetch')) {
            text = t('loading_downloading');
            pct = Math.round(progressValue * 50); // Fetch is first 50%
          } else if (stage.includes('model')) {
            text = t('loading_processing');
            pct = 50 + Math.round(progressValue * 40); // Model is next 40%
          } else if (stage.includes('post')) {
            text = t('loading_finalizing');
            pct = 90 + Math.round(progressValue * 10); // Finalizing is last 10%
          }
          setStatusText(text);
          setProgressVal(pct);
        }
      };

      // Remove background
      const resultBlob = await removeBackground(imageBlob, config);

      // Load background-removed image
      const cutImg = await loadImageFromBlob(resultBlob);
      setCutoutImage(cutImg);

      setView('EDITOR');
    } catch (err) {
      console.error(err);
      alert(t('err_process'));
      setView('UPLOAD');
    }
  };

  const handleUpload = (file) => {
    if (!file.type.startsWith('image/')) {
      alert(t('err_load'));
      return;
    }
    runAiBackgroundRemoval(file);
  };

  const handleSelectPreset = async (url) => {
    try {
      setStatusText(t('loading_init'));
      setProgressVal(10);
      setView('PROCESSING');

      const response = await fetch(url);
      const blob = await response.blob();
      await runAiBackgroundRemoval(blob);
    } catch (err) {
      console.error(err);
      alert(t('err_load'));
      setView('UPLOAD');
    }
  };

  const handleBackToUpload = () => {
    if (window.confirm(t('btn_back') + '?')) {
      setView('UPLOAD');
      setOriginalImage(null);
      setCutoutImage(null);
    }
  };

  const currentLangLabel = () => {
    if (lang === 'vi') return 'Tiếng Việt';
    if (lang === 'en') return 'English';
    if (lang === 'ja') return '日本語';
    return 'Tiếng Việt';
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-100 text-base-content font-body">
      {/* Header */}
      <header className="navbar bg-base-200 border-b border-base-300 px-6 z-50 sticky top-0">
        <div className="flex-1 gap-2">
          <span className="text-xl">✨</span>
          <span className="font-display text-lg font-extrabold tracking-wider">
            AURA <span className="text-primary">CUT</span>
          </span>
        </div>
        <div className="flex-none gap-4">
          {/* Theme Toggle */}
          <button className="btn btn-ghost btn-circle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'night' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language Selector Dropdown */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-sm border border-base-300 gap-2 normal-case">
              <Globe className="w-4 h-4" />
              <span>{currentLangLabel()}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-200 border border-base-300 rounded-box w-36 mt-2 z-50">
              <li><button className={lang === 'vi' ? 'active' : ''} onClick={() => handleLanguageChange('vi')}>Tiếng Việt</button></li>
              <li><button className={lang === 'en' ? 'active' : ''} onClick={() => handleLanguageChange('en')}>English</button></li>
              <li><button className={lang === 'ja' ? 'active' : ''} onClick={() => handleLanguageChange('ja')}>日本語</button></li>
            </ul>
          </div>
        </div>
      </header>

      {/* Main View Port */}
      <main className="flex-1 flex flex-col">
        {view === 'UPLOAD' && (
          <UploadView 
            t={t} 
            onUpload={handleUpload} 
            onSelectPreset={handleSelectPreset} 
          />
        )}
        
        {view === 'PROCESSING' && (
          <ProcessingView 
            t={t} 
            statusText={statusText} 
            progressVal={progressVal} 
          />
        )}

        {view === 'EDITOR' && (
          <EditorWorkspace 
            t={t} 
            initialOriginalImage={originalImage} 
            initialCutoutImage={cutoutImage} 
            onBack={handleBackToUpload} 
          />
        )}
      </main>
    </div>
  );
}
