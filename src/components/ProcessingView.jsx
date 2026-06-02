import React from 'react';

export default function ProcessingView({ t, statusText, progressVal }) {
  return (
    <section className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center p-6 w-full">
      <div className="flex flex-col items-center">
        {/* daisyUI clean loader spinner */}
        <span className="loading loading-spinner loading-lg text-primary mb-6"></span>
        
        <h2 className="text-xl font-bold mb-4 font-display">{statusText}</h2>
        
        {/* daisyUI progress bar */}
        <progress 
          className="progress progress-primary w-64 h-2 mb-6" 
          value={progressVal} 
          max="100"
        ></progress>
        
        <p className="text-sm text-base-content/60 max-w-xs">{t('loading_note')}</p>
      </div>
    </section>
  );
}
