import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import logo from './assets/logo.png';

const Editor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const formRef = useRef<HTMLFormElement>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        // We auto-submit the form to the Collabora iframe
        if (formRef.current) {
            formRef.current.submit();
        }

        // Hide loading after a few seconds assuming it loads
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, [id, token, navigate]);

    // Construct the WOPISrc for internal docker routing
    const wopiSrc = encodeURIComponent(`http://backend:8080/wopi/files/${id}`);

    // Using relative URL so it goes through Vite proxy and works over HTTPS
    const collaboraUrl = `/browser/dist/cool.html?WOPISrc=${wopiSrc}`;

    return (
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-900 z-[1000] overflow-hidden">
            {/* Header */}
            <div className={`h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-[#f8fafd] dark:bg-slate-900`}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.close()}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
                        title="Tutup Editor"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <img src={logo} alt="BaknusDrive" className="w-8 h-8 object-contain" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">BaknusDoc (Collabora Editor)</span>
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live & Stabil</span>
                </div>
            </div>

            {/* Hidden Form for WOPI POST */}
            <form
                ref={formRef}
                action={collaboraUrl}
                method="POST"
                target="collabora-iframe"
                style={{ display: 'none' }}
            >
                {/* Send token as access_token for WOPI validation if needed */}
                <input type="text" name="access_token" value={token || ''} readOnly />
                <input type="text" name="access_token_ttl" value="0" readOnly />
            </form>

            {/* Collabora iframe target */}
            <iframe
                name="collabora-iframe"
                title="Collabora Editor"
                className="w-full flex-1 border-none"
                style={{ backgroundColor: '#f8f9fa' }}
                allowFullScreen
            />

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 top-14 flex flex-col items-center justify-center bg-white dark:bg-slate-900 z-[1100]">
                    <img src={logo} alt="BaknusDrive" className="w-20 h-20 mb-6 animate-pulse" />
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-lg">Mempersiapkan Collabora Online...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Editor;
