import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthForm: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [message, setMessage] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isLogin) {
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

    return (
        <div className="w-full max-w-sm p-6 bg-black/80 border border-white/20 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">{isLogin ? 'LOGIN' : 'REGISTER'}</h2>
            <form onSubmit={handleAuth} className="space-y-4">
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
                    {loading ? 'PROCESSING...' : (isLogin ? 'ENTER GRID' : 'INITIALIZE ID')}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-xs text-gray-400 hover:text-white underline tracking-widest"
                >
                    {isLogin ? 'NO ACCOUNT? REGISTER' : 'ALREADY REGISTERED? LOGIN'}
                </button>
            </div>
        </div>
    );
};
