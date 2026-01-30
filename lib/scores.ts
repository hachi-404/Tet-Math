import { supabase } from './supabase';

export const saveScore = async (score: number, userId: string) => {
    if (!userId) {
        console.error('User ID is required to save score');
        return null;
    }

    // Fetch optional username/profile if needed, but for now we just save score
    // We can assume username is handled or we use email as fallback in display

    // Improvement: Check if we need to fetch username from a profiles table
    // For now, we trust the table definition which has a 'username' column.
    // We can pass it or update it later.

    const { data, error } = await supabase
        .from('scores')
        .insert([
            {
                user_id: userId,
                score: Math.floor(score),
                // created_at is default
            }
        ])
        .select();

    if (error) {
        console.error('Error saving score:', error);
        throw error;
    }

    return data;
};

export const fetchLeaderboard = async () => {
    const { data, error } = await supabase
        .from('scores')
        .select('score, username, created_at')
        .order('score', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }

    return data;
};
