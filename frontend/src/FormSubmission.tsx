import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    Send, ClipboardList, CheckCircle2,
    AlertCircle, Loader2, Home
} from 'lucide-react';

// Works on localhost (no base = same origin) and on production
const API_BASE = import.meta.env.VITE_API_URL || '';

interface Question {
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
}

interface Form {
    id: string;
    title: string;
    description: string;
    questions: Question[];
    visibility: 'internal' | 'external' | 'both';
}

const FormSubmission: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [form, setForm] = useState<Form | null>(null);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [respondentEmail, setRespondentEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;

    useEffect(() => {
        fetchForm();
    }, [id]);

    const fetchForm = async () => {
        setLoading(true);
        try {
            const resp = await axios.get(`${API_BASE}/api/forms/f/${id}`);
            const data = resp.data;

            // Backend menyimpan `questions` sebagai JSON string di database.
            // Parse ke array jika masih berupa string.
            if (typeof data.questions === 'string') {
                try {
                    data.questions = JSON.parse(data.questions);
                } catch {
                    data.questions = [];
                }
            }
            if (!Array.isArray(data.questions)) {
                data.questions = [];
            }

            setForm(data);
        } catch (err: any) {
            console.error("Failed to fetch form:", err);
            setError(err.response?.data?.error || "Gagal memuat formulir");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (questionId: string, value: any) => {
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            await axios.post(`${API_BASE}/api/forms/f/${id}/submit`, {
                response_data: responses,
                respondent_email: respondentEmail
            }, config);
            setSubmitted(true);
        } catch (err: any) {
            console.error("Submission failed:", err);
            alert("Gagal mengirim jawaban: " + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 size={48} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-500 font-medium">Memuat formulir...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Oops!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">{error}</p>
                    <button onClick={() => window.location.href = '/'} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <Home size={18} /> Kembali ke Beranda
                    </button>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-10 rounded-[40px] shadow-xl max-w-xl w-full text-center animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
                        <CheckCircle2 size={56} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-4">Terima Kasih!</h2>
                    <p className="text-xl text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
                        Jawaban Anda untuk <b>{form?.title}</b> telah berhasil dikirimkan.
                    </p>
                    <button onClick={() => setSubmitted(false)} className="text-indigo-600 hover:underline font-bold text-lg">
                        Kirim jawaban lain
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen overflow-y-auto bg-[#f0f4f9] dark:bg-slate-950 px-4 py-12 md:py-20">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border-t-[14px] border-indigo-600 p-8 md:p-10 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <ClipboardList size={80} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 leading-tight">{form?.title}</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{form?.description}</p>

                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700/50 my-6" />

                    {/* Login/Email Prompt */}
                    {form?.visibility === 'internal' && !token ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-2xl mb-6">
                            <h3 className="text-amber-800 dark:text-amber-400 font-bold mb-2 flex items-center gap-2">
                                <Lock size={18} /> Khusus Internal Sekolah
                            </h3>
                            <p className="text-amber-700 dark:text-amber-500 text-sm mb-4">
                                Formulir ini hanya dapat diisi oleh warga sekolah. Silakan login terlebih dahulu.
                            </p>
                            <button
                                onClick={() => window.location.href = `/login?redirect=/f/${id}`}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all"
                            >
                                Login Sekarang
                            </button>
                        </div>
                    ) : (form?.visibility === 'external' || (form?.visibility === 'both' && !token)) && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-2xl mb-6">
                            <label className="block text-indigo-900 dark:text-indigo-300 font-bold mb-3 flex items-center gap-2">
                                <ClipboardList size={18} /> Identitas Pengisi
                            </label>
                            <p className="text-indigo-700 dark:text-indigo-400 text-sm mb-4">
                                Masukkan alamat email Anda untuk melanjutkan pengisian formulir.
                            </p>
                            <input
                                type="email"
                                required
                                value={respondentEmail}
                                onChange={(e) => setRespondentEmail(e.target.value)}
                                placeholder="Alamat email Anda"
                                className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-800 px-4 py-3 rounded-xl focus:border-indigo-600 outline-none transition-all dark:text-white"
                            />
                        </div>
                    )}

                    {token && (
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                                {user?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.name}</p>
                                <p className="text-xs text-slate-500">{user?.email}</p>
                            </div>
                            <div className="ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                                LOGGED IN
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-red-500 font-semibold">* Menunjukkan pertanyaan yang wajib diisi</p>
                </div>

                {/* Form Content - Hide if internal but not logged in */}
                {form?.visibility === 'internal' && !token ? null : (
                    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                        {form?.questions.map((q) => (
                            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700/50">
                                <label className="block text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex gap-1">
                                    {q.label}
                                    {q.required && <span className="text-red-500">*</span>}
                                </label>

                                {q.type === 'text' && (
                                    <input
                                        type="text"
                                        required={q.required}
                                        placeholder="Jawaban Anda"
                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-700 focus:border-indigo-600 outline-none p-3 text-lg transition-all dark:text-white"
                                    />
                                )}

                                {q.type === 'paragraph' && (
                                    <textarea
                                        required={q.required}
                                        placeholder="Jawaban Anda"
                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-700 focus:border-indigo-600 outline-none p-3 text-lg transition-all resize-none min-h-[120px] dark:text-white"
                                    />
                                )}

                                {(q.type === 'multiple' || q.type === 'checkbox') && (
                                    <div className="space-y-4">
                                        {q.options?.map((opt, idx) => (
                                            <label key={idx} className="flex items-center gap-4 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type={q.type === 'multiple' ? 'radio' : 'checkbox'}
                                                        name={q.id}
                                                        required={q.required && !responses[q.id]}
                                                        onChange={(e) => {
                                                            if (q.type === 'multiple') {
                                                                handleInputChange(q.id, opt);
                                                            } else {
                                                                const current = responses[q.id] || [];
                                                                if (e.target.checked) {
                                                                    handleInputChange(q.id, [...current, opt]);
                                                                } else {
                                                                    handleInputChange(q.id, current.filter((o: string) => o !== opt));
                                                                }
                                                            }
                                                        }}
                                                        className="w-6 h-6 appearance-none border-2 border-slate-300 dark:border-slate-600 rounded-full checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </div>
                                                </div>
                                                <span className="text-lg text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {q.type === 'dropdown' && (
                                    <select
                                        required={q.required}
                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all dark:text-white"
                                    >
                                        <option value="">Pilih Opsi</option>
                                        {q.options?.map((opt, idx) => (
                                            <option key={idx} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}

                        <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-10 py-4 rounded-2xl font-bold text-xl shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-3 hover:scale-105 active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                                Kirim Jawaban
                            </button>
                            <button
                                type="button"
                                onClick={() => setResponses({})}
                                className="text-slate-500 hover:text-red-500 font-bold text-lg transition-colors"
                            >
                                Hapus Formulir
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FormSubmission;
