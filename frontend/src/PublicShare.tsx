import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    Lock, Download, AlertCircle, Folder, File as FileIcon, Image as ImageIcon,
    FileText, FileSpreadsheet, Presentation, FileAudio, FileVideo, FileArchive, FileCode
} from 'lucide-react';
import logo from './assets/logo.png';

const getFileIconData = (fileName: string) => {
    const name = (fileName || '').toLowerCase();

    // 1. Archive files (.zip, .rar, .7z, .tar, .gz, etc.)
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.bz2') || name.endsWith('.xz')) {
        return {
            icon: <FileArchive size={32} />,
            bgClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        };
    }

    // 2. Audio files (.mp3, .wav, .ogg, .flac, .aac, .m4a, etc.)
    if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.flac') || name.endsWith('.aac') || name.endsWith('.m4a')) {
        return {
            icon: <FileAudio size={32} />,
            bgClass: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-500 dark:text-cyan-400'
        };
    }

    // 3. Video files (.mp4, .mkv, .avi, .mov, .webm, etc.)
    if (name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi') || name.endsWith('.mov') || name.endsWith('.webm') || name.endsWith('.wmv') || name.endsWith('.flv')) {
        return {
            icon: <FileVideo size={32} />,
            bgClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
        };
    }

    // 4. Code / Source files
    if (
        name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts') || name.endsWith('.tsx') ||
        name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.json') || name.endsWith('.py') ||
        name.endsWith('.go') || name.endsWith('.java') || name.endsWith('.cpp') || name.endsWith('.c') ||
        name.endsWith('.php') || name.endsWith('.sh') || name.endsWith('.yaml') || name.endsWith('.yml') ||
        name.endsWith('.xml') || name.endsWith('.sql') || name.endsWith('.md')
    ) {
        return {
            icon: <FileCode size={32} />,
            bgClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
        };
    }

    // 5. PDF
    if (name.endsWith('.pdf')) {
        return {
            icon: <FileText size={32} />,
            bgClass: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        };
    }

    // 6. Excel / Spreadsheets
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
        return {
            icon: <FileSpreadsheet size={32} />,
            bgClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
        };
    }

    // 7. Powerpoint / Presentation
    if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
        return {
            icon: <Presentation size={32} />,
            bgClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
        };
    }

    // 8. Images (.gif, .jpg, .jpeg, .png, .webp, .svg, etc.)
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp') || name.endsWith('.svg') || name.endsWith('.ico')) {
        return {
            icon: <ImageIcon size={32} />,
            bgClass: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
        };
    }

    // 9. Word / Text document or general file fallback
    const isDoc = name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.txt') || name.endsWith('.rtf') || name.endsWith('.log');
    return {
        icon: isDoc ? <FileText size={32} /> : <FileIcon size={32} />,
        bgClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    };
};

export default function PublicShare() {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [status, setStatus] = useState<'loading' | 'password' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [password, setPassword] = useState('');
    const [metadata, setMetadata] = useState<any>(null);

    const checkLink = async (pwd?: string) => {
        try {
            setStatus('loading');
            const url = pwd
                ? `/api/public/${type}/${id}/metadata?pwd=${encodeURIComponent(pwd)}`
                : `/api/public/${type}/${id}/metadata`;
            const res = await axios.get(url);
            setMetadata(res.data);
            setStatus('ready');
        } catch (err: any) {
            if (err.response?.status === 401) {
                setStatus('password');
            } else if (err.response?.status === 403) {
                setStatus('error');
                setErrorMsg(err.response.data.error || 'Link has expired');
            } else if (err.response?.status === 404) {
                setStatus('error');
                setErrorMsg('File/Folder not found or no longer public.');
            } else {
                setStatus('error');
                setErrorMsg('An error occurred while accessing the public link.');
            }
        }
    };

    useEffect(() => {
        checkLink();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, id]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        checkLink(password);
    };

    const handleDownload = () => {
        const url = password
            ? `/api/public/${type}/${id}/download?pwd=${encodeURIComponent(password)}`
            : `/api/public/${type}/${id}/download`;
        window.location.href = url;
    };

    return (
        <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-slate-100 dark:border-slate-700 my-auto">

                {/* Logo Section */}
                <div className="flex justify-center mb-8">
                    <img src={logo} alt="BaknusDrive Logo" className="h-14" />
                </div>

                {status === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p>Memeriksa ketersediaan...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-6">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Tautan Tidak Tersedia</h2>
                        <p className="text-slate-500 dark:text-slate-400">{errorMsg}</p>
                    </div>
                )}

                {status === 'password' && (
                    <div className="py-2 animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                                <Lock className="text-yellow-600 dark:text-yellow-400" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">File Terlindungi</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Pemilik file mengatur kata sandi demi keamanan.</p>
                        </div>
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="mb-6">
                                <input
                                    type="password"
                                    placeholder="Masukkan kata sandi..."
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!password}
                                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Akses File
                            </button>
                        </form>
                    </div>
                )}

                {status === 'ready' && metadata && (
                    <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between mb-8 shadow-inner">
                            <div className="flex items-center gap-4 overflow-hidden">
                                {(() => {
                                    const fileIconData = metadata.type === 'folder' ? null : getFileIconData(metadata.name);
                                    return (
                                        <div className={`p-4 rounded-xl ${metadata.type === 'folder' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : fileIconData?.bgClass}`}>
                                            {metadata.type === 'folder' ? <Folder size={32} /> : fileIconData?.icon}
                                        </div>
                                    );
                                })()}
                                <div className="truncate">
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white truncate pr-4" title={metadata.name}>{metadata.name}</h2>
                                    <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                        <span>Oleh <span className="font-semibold text-slate-600 dark:text-slate-300">{metadata.owner}</span></span>
                                        {metadata.type === 'file' && (
                                            <>
                                                <span>•</span>
                                                <span>{(metadata.size / 1024 / 1024).toFixed(1)} MB</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98] hover:shadow-xl hover:shadow-blue-600/40"
                        >
                            <Download size={24} /> Unduh {metadata.type === 'folder' ? 'Folder (.zip)' : 'Sekarang'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
