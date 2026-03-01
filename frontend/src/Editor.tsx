import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ArrowLeft } from 'lucide-react';
import logo from './assets/logo.png';

declare global {
    interface Window {
        DocsAPI: any;
    }
}

const Editor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load OnlyOffice script if not present
        if (!window.DocsAPI) {
            const scriptExists = document.getElementById("onlyoffice-api-script");
            if (!scriptExists) {
                const script = document.createElement('script');
                script.id = "onlyoffice-api-script";
                script.src = `${window.location.protocol}//${window.location.hostname}/office/web-apps/apps/api/documents/api.js`;
                script.onload = () => {
                    initEditor(true);
                };
                script.onerror = () => {
                    setError("Failed to load OnlyOffice API script.");
                    setLoading(false);
                };
                document.body.appendChild(script);
            } else {
                initEditor();
            }
        } else {
            initEditor();
        }

        return () => {
            // Clean up editor instance if necessary
            // OnlyOffice usually handles this but we might want to ensure the div is cleared
            const container = document.getElementById("onlyoffice-editor-full");
            if (container) container.innerHTML = "";
        };
    }, [id]);

    const initEditor = async (isRetry = false) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const resp = await axios.get(`/api/drive/doc/config/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const config = resp.data;
            console.log("DEBUG Editor: Fetched OnlyOffice Config:", config);

            if (window.DocsAPI) {
                new window.DocsAPI.DocEditor("onlyoffice-editor-full", config);
                setLoading(false);
            } else {
                setError("OnlyOffice DocsAPI not available.");
                setLoading(false);
            }
        } catch (err: any) {
            console.error("Failed to load editor config", err);
            setError("Gagal memuat editor dokumen. Pastikan file tersedia dan Anda memiliki akses.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-900 z-[1000]">
            {/* Header / Toolbar Area */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 z-50">
                    <img src={logo} alt="BaknusDrive" className="w-16 h-16 mb-4 animate-pulse" />
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Loader2 className="animate-spin" size={20} />
                        <span>Mempersiapkan Dokumen...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-50 p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                        <ArrowLeft size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Error</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                        Kembali ke Dashboard
                    </button>
                </div>
            )}

            {/* Title Bar (Simulate Google Drive) */}
            {!loading && !error && (
                <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-[#f8fafd] dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.close()}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                            title="Tutup Editor"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <img src={logo} alt="BaknusDrive" className="w-8 h-8 object-contain" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">BaknusDoc Editor</span>
                        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-medium italic">Pembaruan disimpan otomatis</span>
                    </div>
                </div>
            )}

            <div id="onlyoffice-editor-full" className="flex-1 w-full h-full relative"></div>
        </div>
    );
};

export default Editor;
