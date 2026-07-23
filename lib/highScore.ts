const HIGH_SCORE_STORAGE_KEY = 'tetmath:high-score:v1';
const HIGH_SCORE_STORAGE_VERSION = 1;

interface HighScoreData {
    version: typeof HIGH_SCORE_STORAGE_VERSION;
    highScore: number;
    updatedAt: string;
}

export interface HighScoreUpdate {
    highScore: number;
    isNewHighScore: boolean;
    persisted: boolean;
}

const normalizeScore = (score: number) => {
    if (!Number.isFinite(score) || score < 0) return 0;
    return Math.min(Math.floor(score), Number.MAX_SAFE_INTEGER);
};

export const getHighScore = (): number => {
    try {
        const storedValue = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
        if (!storedValue) return 0;

        const data: unknown = JSON.parse(storedValue);
        if (
            typeof data !== 'object' ||
            data === null ||
            !('version' in data) ||
            !('highScore' in data) ||
            data.version !== HIGH_SCORE_STORAGE_VERSION ||
            typeof data.highScore !== 'number'
        ) {
            return 0;
        }

        return normalizeScore(data.highScore);
    } catch (error) {
        console.error('Failed to load the local high score:', error);
        return 0;
    }
};

export const saveHighScore = (score: number): HighScoreUpdate => {
    const nextScore = normalizeScore(score);
    const currentHighScore = getHighScore();

    if (nextScore <= currentHighScore) {
        return {
            highScore: currentHighScore,
            isNewHighScore: false,
            persisted: true,
        };
    }

    const data: HighScoreData = {
        version: HIGH_SCORE_STORAGE_VERSION,
        highScore: nextScore,
        updatedAt: new Date().toISOString(),
    };

    try {
        localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(data));
        return {
            highScore: nextScore,
            isNewHighScore: true,
            persisted: true,
        };
    } catch (error) {
        console.error('Failed to save the local high score:', error);
        return {
            highScore: nextScore,
            isNewHighScore: true,
            persisted: false,
        };
    }
};
