import React, { useEffect, useState, useRef } from 'react';
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
    const editorRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);

    useEffect(() => {
        const loadScript = () => {
            // Check if script already exists to avoid duplication
            let script = document.getElementById("onlyoffice-api-script") as HTMLScriptElement;

            if (!script) {
                script = document.createElement('script');
                script.id = "onlyoffice-api-script";
                script.src = `/office/web-apps/apps/api/documents/api.js?v=${new Date().getTime()}`;
                script.async = true;
                script.onload = () => {
                    console.log("DEBUG Editor: OnlyOffice script loaded");
                    fetchConfigAndInit();
                };
                script.onerror = (e) => {
                    console.error("DEBUG Editor: Script load error", e);
                    setError("Gagal memuat script OnlyOffice dari server.");
                    setLoading(false);
                };
                document.body.appendChild(script);
            } else if (window.DocsAPI) {
                fetchConfigAndInit();
            } else {
                // Script exists but DocsAPI not ready, wait for it
                script.onload = () => fetchConfigAndInit();
            }
        };

        loadScript();

        return () => {
            if (editorRef.current) {
                editorRef.current.innerHTML = "";
            }
            isInitialized.current = false;
        };
    }, [id]);

    const fetchConfigAndInit = async () => {
        if (isInitialized.current) return;

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
            console.log("DEBUG Editor: Config fetched, waiting for stability...");

            // Small delay to ensure React finishes re-rendering cycle
            setTimeout(() => {
                initOnlyOffice(config);
            }, 100);

        } catch (err: any) {
            console.error("Failed to load editor config", err);
            setError("Gagal memuat konfigurasi dokumen.");
            setLoading(false);
        }
    };

    const initOnlyOffice = (config: any) => {
        let attempts = 0;
        const maxAttempts = 50;

        const checkAndStart = () => {
            if (window.DocsAPI && editorRef.current) {
                try {
                    console.log("DEBUG Editor: Initializing DocEditor");
                    new window.DocsAPI.DocEditor(editorRef.current.id, config);
                    isInitialized.current = true;
                    setLoading(false);
                    return true;
                } catch (e) {
                    console.error("DEBUG Editor: DocEditor Init Error", e);
                }
            }
            return false;
        };

        if (checkAndStart()) return;

        const interval = setInterval(() => {
            attempts++;
            if (checkAndStart()) {
                clearInterval(interval);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                setError("OnlyOffice gagal diinisialisasi (DocsAPI Timeout).");
                setLoading(false);
            }
        }, 100);
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-900 z-[1000] overflow-hidden">
            {/* Header (Always present for stability) */}
            <div className={`h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-[#f8fafd] dark:bg-slate-900 transition-opacity duration-300 ${!loading && !error ? 'opacity-100' : 'opacity-0 h-0 border-none'}`}>
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

            {/* Container for the Editor */}
            <div
                id="onlyoffice-editor-full"
                ref={editorRef}
                className={`flex-1 w-full transition-opacity duration-500 ${!loading && !error ? 'opacity-100' : 'opacity-0'}`}
            ></div>

            {/* Loading Overlay */}
            {loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 z-[1100]">
                    <img src={logo} alt="BaknusDrive" className="w-20 h-20 mb-6 animate-bounce" />
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-lg">Mempersiapkan Dokumen...</span>
                    </div>
                    <p className="mt-4 text-sm text-slate-400">Pastikan OnlyOffice Server sedang berjalan</p>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-[1200] p-6 text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <ArrowLeft size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Terjadi Kesalahan</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md text-lg">{error}</p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-all"
                        >
                            Refresh Halaman
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                        >
                            Ke Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Editor;
