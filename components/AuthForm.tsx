import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { updateProfile } from '../lib/profile';

type AuthMode = 'guest' | 'email-login' | 'email-register';

export const AuthForm = React.memo(() => {
    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<AuthMode>('guest');
    const [message, setMessage] = useState('');

    const handleGuestPlay = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        const trimmedName = displayName.trim();

        if (trimmedName.length > 0 && trimmedName.length < 3) {
            setMessage('Display name must be at least 3 characters.');
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) throw error;

            if (trimmedName.length >= 3 && data.user) {
                try {
                    await updateProfile(data.user.id, trimmedName);
                } catch (profileError: any) {
                    // Username unique constraint violation — non-fatal
                    setMessage('Display name already in use. You can change it in settings.');
                }
            }
        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (mode === 'email-login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Registration successful! Check your email to confirm.');
            }
        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setMessage('');
        setDisplayName('');
        setEmail('');
        setPassword('');
    };

    if (mode === 'guest') {
        return (
            <div className="w-full max-w-sm p-6 bg-black/80 border border-white/20 backdrop-blur-md">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">QUICK PLAY</h2>
                <form onSubmit={handleGuestPlay} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-emerald-400 mb-1 tracking-widest">
                            DISPLAY NAME (OPTIONAL)
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-black/50 border border-white/30 text-white px-3 py-2 focus:border-emerald-400 focus:outline-none transition-colors"
                            placeholder="Enter Display Name"
                            maxLength={15}
                            autoCapitalize="none"
                            autoCorrect="off"
                        />
                    </div>

                    {message && (
                        <div className="text-sm text-yellow-400 font-bold border border-yellow-500/30 p-2 bg-yellow-500/10">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 mt-4 bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'INITIALIZING...' : 'START'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => switchMode('email-login')}
                        className="text-xs text-gray-400 hover:text-white underline tracking-widest"
                    >
                        USE EMAIL INSTEAD
                    </button>
                </div>
            </div>
        );
    }

    // Email login / register mode
    return (
        <div className="w-full max-w-sm p-6 bg-black/80 border border-white/20 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
                {mode === 'email-login' ? 'EMAIL LOGIN' : 'REGISTER'}
            </h2>
            <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-emerald-400 mb-1 tracking-widest">EMAIL</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/50 border border-white/30 text-white px-3 py-2 focus:border-emerald-400 focus:outline-none transition-colors"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-emerald-400 mb-1 tracking-widest">PASSWORD</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/50 border border-white/30 text-white px-3 py-2 focus:border-emerald-400 focus:outline-none transition-colors"
                        required
                    />
                </div>

                {message && (
                    <div className="text-sm text-yellow-400 font-bold border border-yellow-500/30 p-2 bg-yellow-500/10">
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-4 bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                    {loading ? 'PROCESSING...' : (mode === 'email-login' ? 'ENTER GRID' : 'INITIALIZE ID')}
                </button>
            </form>

            <div className="mt-4 text-center space-y-2">
                <button
                    onClick={() => switchMode('guest')}
                    className="text-xs text-gray-400 hover:text-white underline tracking-widest block mx-auto"
                >
                    ← QUICK PLAY
                </button>
                <button
                    onClick={() => switchMode(mode === 'email-login' ? 'email-register' : 'email-login')}
                    className="text-xs text-gray-400 hover:text-white underline tracking-widest block mx-auto"
                >
                    {mode === 'email-login' ? 'NO ACCOUNT? REGISTER' : 'ALREADY REGISTERED? LOGIN'}
                </button>
            </div>
        </div>
    );
});
