import { supabase } from './supabase';

export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

    if (error) {
        // Suppress "No rows found" error as it might happen for new users before trigger or legacy
        if (error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
        }
        return null;
    }
    return data;
};

export const updateProfile = async (userId: string, username: string) => {
    // Upsert allows creating if not exists (though trigger handles creation usually)
    const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, username, updated_at: new Date().toISOString() })
        .select()
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
    return data;
};
