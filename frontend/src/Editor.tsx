import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import axios from 'axios';
import logo from './assets/logo.png';

const Editor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const [collaboraUrl, setCollaboraUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [canWrite, setCanWrite] = useState(true);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        // Fetch per-user WOPI token + Collabora URL from backend
        axios.get(`/api/drive/doc/open/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(resp => {
                const { url, file_name, can_write } = resp.data;
                if (!url) {
                    setError('Gagal mendapatkan URL editor dari server.');
                    return;
                }
                setCollaboraUrl(url);
                setFileName(file_name || '');
                setCanWrite(can_write !== false);
            })
            .catch(err => {
                console.error('Failed to open doc:', err);
                const msg = err.response?.data?.error || 'Gagal membuka editor. Coba lagi.';
                setError(msg);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [id, token, navigate]);

    return (
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-900 z-[1000] overflow-hidden">
            {/* Header */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-[#f8fafd] dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.close()}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                        title="Tutup Editor"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <img src={logo} alt="BaknusDrive" className="w-8 h-8 object-contain" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">BaknusDrive</span>
                    {fileName && (
                        <>
                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />
                            <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">{fileName}</span>
                        </>
                    )}
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />
                    {canWrite ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            Kolaborasi
                        </span>
                    ) : (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1" title="Anda hanya memiliki hak akses untuk melihat dokumen ini. Perubahan tidak akan disimpan.">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                            Lihat Saja
                        </span>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
                    <img src={logo} alt="BaknusDrive" className="w-20 h-20 mb-6 animate-pulse" />
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-lg">Mempersiapkan Editor Kolaborasi...</span>
                    </div>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 gap-4">
                    <AlertCircle size={48} className="text-red-400" />
                    <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            )}

            {/* Collabora iframe */}
            {!loading && collaboraUrl && (
                <iframe
                    src={collaboraUrl}
                    title="Collabora Editor"
                    className="w-full flex-1 border-none"
                    style={{ backgroundColor: '#f8f9fa' }}
                    allowFullScreen
                />
            )}
        </div>
    );
};

export default Editor;
