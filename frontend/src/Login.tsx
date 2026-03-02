import React, { useState } from 'react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import axios from 'axios';
import logo from './assets/logo.png';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const resp = await axios.post('/api/login', {
                email,
                password,
            });

            if (resp.data.token) {
                localStorage.setItem('token', resp.data.token);
                localStorage.setItem('user', JSON.stringify(resp.data.user));
                window.location.href = '/'; // Trigger route reload
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="w-full h-full flex items-center justify-center p-4 bg-cover bg-center relative bg-[url('/bg_mobile.png')] md:bg-[url('/bg_image.png')]"
        >
            <div className="absolute inset-0 bg-slate-900/60 z-0 backdrop-blur-[2px]"></div>

            <div className="w-full max-w-md glass rounded-3xl p-8 relative z-10 overflow-hidden group border border-white/20 shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-baknus-400 via-white to-baknus-600"></div>

                <div className="flex flex-col items-center mb-8">
                    <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl mb-4 transform group-hover:scale-110 transition-transform duration-500 border border-white/30 p-2">
                        <img src={logo} alt="BaknusDrive Logo" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 tracking-tight">BaknusDrive</h1>
                    <p className="text-slate-500 mt-2 text-center text-sm">Gunakan akun email Mailcow sekolah Anda untuk login.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 ml-1">Username / Email</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Mail size={18} />
                            </div>
                            <input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-baknus-500/20 focus:border-baknus-500 transition-all text-slate-800 placeholder:text-slate-400"
                                placeholder="misal: rian"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-baknus-500/20 focus:border-baknus-500 transition-all text-slate-800 placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-baknus-500 to-baknus-600 hover:from-baknus-600 hover:to-baknus-700 text-white rounded-xl font-medium shadow-md shadow-baknus-500/20 flex items-center justify-center transform active:scale-95 transition-all outline-none focus:ring-4 focus:ring-baknus-500/20"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Masuk ke Drive'}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-slate-400">
                    Powered by Mailcow & Baknus666
                </p>
            </div>
        </div>
    );
}
