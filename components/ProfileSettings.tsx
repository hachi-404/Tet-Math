import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, updateProfile } from '../lib/profile';

export const ProfileSettings: React.FC = () => {
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user) {
            getProfile(user.id).then((data) => {
                if (data && data.username) {
                    setUsername(data.username);
                }
                setLoading(false);
            });
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        setMessage('');

        try {
            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }
            await updateProfile(user.id, username);
            setMessage('PROFILE UPDATED');
        } catch (error: any) {
            setMessage(error.message || 'UPDATE FAILED');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-gray-500 animate-pulse">LOADING PROFILE...</div>;

    return (
        <div className="w-full max-w-xs mx-auto p-4 border border-white/20 bg-black/80 backdrop-blur-sm">
            <h3 className="text-white font-bold tracking-widest mb-4 text-center">IDENTITY CONFIG</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div>
                    <label className="text-xs text-gray-500 mb-1 block tracking-wider">CODENAME</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-black border border-gray-600 text-white px-3 py-2 text-center focus:border-white focus:outline-none transition-colors font-mono"
                        placeholder="ENTER NAME"
                        maxLength={15}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className={`px-4 py-2 border border-white text-white font-bold hover:bg-white hover:text-black transition-colors uppercase tracking-widest ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {saving ? 'PROCESSING...' : 'UPDATE'}
                </button>

                {message && (
                    <div className={`text-xs text-center tracking-widest font-bold ${message.includes('FAILED') || message.includes('must be') ? 'text-red-500' : 'text-emerald-400'}`}>
                        {message}
                    </div>
                )}
            </form>
        </div>
    );
};
