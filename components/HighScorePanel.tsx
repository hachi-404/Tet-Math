import React from 'react';

interface HighScorePanelProps {
    highScore: number;
}

const HighScorePanelComponent: React.FC<HighScorePanelProps> = ({ highScore }) => (
    <div className="w-full max-w-sm mt-4 md:mt-8 p-4 md:p-6 bg-black/80 border border-white/20 backdrop-blur-md">
        <h3 className="text-lg md:text-xl font-bold text-white mb-3 tracking-widest text-center border-b border-white/20 pb-2">
            PERSONAL HIGH SCORE
        </h3>
        <div className="text-center font-mono text-3xl font-bold text-cyan-400 glow-text tabular-nums">
            {highScore.toString().padStart(6, '0')}
        </div>
        <div className="mt-2 text-center text-[10px] tracking-widest text-gray-500">
            SAVED ON THIS DEVICE
        </div>
    </div>
);

export const HighScorePanel = React.memo(HighScorePanelComponent);
