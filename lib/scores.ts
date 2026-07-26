import { supabase } from './supabase';

export const saveBestScore = async (score: number) => {
    const normalizedScore = Math.floor(score);

    if (!Number.isFinite(normalizedScore) || normalizedScore < 0 || normalizedScore > 1_000_000) {
        throw new Error('Score is outside the allowed range');
    }

    const { data, error } = await supabase.rpc('submit_high_score', {
        p_score: normalizedScore,
    });

    if (error) {
        console.error('Error saving best score:', error);
        throw error;
    }

    return data;
};

// Define a type for the joined response
export interface LeaderboardEntry {
    score: number;
    created_at: string;
    // We join on user_id to profiles, so we get an object (or array) back depending on query
    // Supabase JS often returns joined data as nested objects
    profiles: {
        username: string | null;
    } | null;
    // Legacy username column fallback
    username?: string | null;
}

export const fetchLeaderboard = async () => {
    // 1. Fetch scores
    const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('score, created_at, username, user_id')
        .order('score', { ascending: false })
        .limit(3);

    if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        return [];
    }

    if (!scoresData || scoresData.length === 0) return [];

    // 2. Extract unique user IDs
    const userIds = Array.from(new Set(scoresData.map(s => s.user_id)));

    // 3. Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue with scores only if profiles fail
    }

    // 4. Create a map of userId -> username
    const profileMap: Record<string, string> = {};
    if (profilesData) {
        profilesData.forEach(p => {
            if (p.username) profileMap[p.id] = p.username;
        });
    }

    // 5. Merge data
    const leaderboard: LeaderboardEntry[] = scoresData.map(s => ({
        score: s.score,
        created_at: s.created_at,
        username: s.username, // Legacy
        profiles: {
            username: profileMap[s.user_id] || null
        }
    }));

    return leaderboard;
};

export const fetchUserBestScore = async (userId: string) => {
    const { data, error } = await supabase
        .from('scores')
        .select('score, created_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user best score:', error);
        return null;
    }

    return data;
};
