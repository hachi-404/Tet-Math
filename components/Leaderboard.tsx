import React, { useEffect, useState } from 'react';
import { fetchLeaderboard, LeaderboardEntry } from '../lib/scores';

const LeaderboardComponent: React.FC = () => {
    const [scores, setScores] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadScores = async () => {
            const data = await fetchLeaderboard();
            if (data) {
                setScores(data);
            }
            setLoading(false);
        };

        loadScores();
    }, []);

    if (loading) {
        return <div className="text-white text-center animate-pulse tracking-widest">CALCULATING RANKINGS...</div>;
    }

    return (
        <div className="w-full max-w-sm mt-4 md:mt-8 p-4 md:p-6 bg-black/80 border border-white/20 backdrop-blur-md">
            <h3 className="text-lg md:text-xl font-bold text-white mb-4 tracking-widest text-center border-b border-white/20 pb-2">TOP SIGNALS</h3>

            <div className="space-y-2">
                {scores.length === 0 ? (
                    <div className="text-gray-500 text-center text-sm">NO DATA DETECTED</div>
                ) : (
                    scores.map((entry, index) => {
                        const name = entry.profiles?.username || entry.username || `USER-${index + 100}`;
                        return (
                            <div key={index} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold w-6 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-emerald-400' : index === 2 ? 'text-fuchsia-400' : 'text-gray-500'}`}>
                                        #{index + 1}
                                    </span>
                                    <span className="text-gray-300 truncate max-w-[120px] uppercase">
                                        {name}
                                    </span>
                                </div>
                                <div className="font-mono font-bold text-white">
                                    {entry.score.toLocaleString()}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export const Leaderboard = React.memo(LeaderboardComponent);
