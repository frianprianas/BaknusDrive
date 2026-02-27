import React, { useState } from 'react';
import {
    X, Plus, Trash2, GripVertical,
    Type, AlignLeft, ChevronDown, Save,
    Settings, Eye, Layout, Send, ClipboardList
} from 'lucide-react';

interface Question {
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
}

interface FormBuilderProps {
    onClose: () => void;
    onSave: (formData: any) => void;
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
const PreviewModal: React.FC<{ title: string; description: string; questions: Question[]; onClose: () => void }> = ({ title, description, questions, onClose }) => {
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [submitted, setSubmitted] = useState(false);

    const handleInputChange = (qId: string, value: any) =>
        setResponses(prev => ({ ...prev, [qId]: value }));

    if (submitted) {
        return (
            <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl max-w-xl w-full p-12 text-center animate-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-4">Terima Kasih!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg mb-8">Preview pengisian formulir selesai.</p>
                    <button onClick={() => { setSubmitted(false); setResponses({}); }} className="text-indigo-600 hover:underline font-bold text-lg">
                        Isi Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm overflow-y-auto">
            {/* Top Bar */}
            <div className="sticky top-0 bg-amber-400 dark:bg-amber-500 text-amber-900 text-sm font-bold flex items-center justify-between px-6 py-2.5 shadow z-10">
                <span>👁 Mode Preview — Formulir ini hanya pratinjau, tidak ada data yang disimpan.</span>
                <button onClick={onClose} className="text-amber-900 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-500 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Form Content */}
            <div className="bg-[#f0f4f9] min-h-screen px-4 py-12 md:py-16">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border-t-[14px] border-indigo-600 p-8 md:p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 text-slate-400">
                            <ClipboardList size={80} />
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-3 leading-tight">{title || 'Formulir Tanpa Judul'}</h1>
                        {description && <p className="text-lg text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{description}</p>}
                        <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-6" />
                        <p className="text-sm text-red-500 font-semibold">* Menunjukkan pertanyaan yang wajib diisi</p>
                    </div>

                    {/* Questions */}
                    <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6 pb-10">
                        {questions.map((q) => (
                            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700/50">
                                <label className="block text-xl font-bold text-slate-800 dark:text-slate-100 mb-5 flex gap-1 flex-wrap">
                                    {q.label || <span className="text-slate-400 italic">Pertanyaan (kosong)</span>}
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
                                        {(q.options || []).map((opt, idx) => (
                                            <label key={idx} className="flex items-center gap-4 cursor-pointer group">
                                                <input
                                                    type={q.type === 'multiple' ? 'radio' : 'checkbox'}
                                                    name={q.id}
                                                    onChange={(e) => {
                                                        if (q.type === 'multiple') handleInputChange(q.id, opt);
                                                        else {
                                                            const cur = responses[q.id] || [];
                                                            handleInputChange(q.id, e.target.checked ? [...cur, opt] : cur.filter((o: string) => o !== opt));
                                                        }
                                                    }}
                                                    className="w-5 h-5 accent-indigo-600 cursor-pointer"
                                                />
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
                                        {(q.options || []).map((opt, idx) => (
                                            <option key={idx} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}

                        {questions.length === 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 shadow-sm border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 font-medium">
                                Belum ada pertanyaan. Tambahkan pertanyaan di editor.
                            </div>
                        )}

                        <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm">
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold text-xl shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-3 hover:scale-105 active:scale-95"
                            >
                                <Send size={22} /> Kirim Jawaban
                            </button>
                            <button
                                type="button"
                                onClick={() => setResponses({})}
                                className="text-slate-500 hover:text-red-500 font-semibold text-base transition-colors"
                            >
                                Hapus Jawaban
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ─── Main FormBuilder ─────────────────────────────────────────────────────────
const FormBuilder: React.FC<FormBuilderProps> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('Formulir Tanpa Judul');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        { id: '1', type: 'text', label: 'Pertanyaan Tanpa Judul', required: false }
    ]);
    const [showPreview, setShowPreview] = useState(false);

    const addQuestion = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        setQuestions([...questions, { id: newId, type: 'text', label: '', required: false }]);
    };

    const removeQuestion = (id: string) => {
        if (questions.length > 1) setQuestions(questions.filter(q => q.id !== id));
    };

    const updateQuestion = (id: string, updates: Partial<Question>) =>
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));

    const addOption = (qId: string) => {
        const q = questions.find(q => q.id === qId);
        if (q) {
            const options = q.options || ['Opsi 1'];
            updateQuestion(qId, { options: [...options, `Opsi ${options.length + 1}`] });
        }
    };

    const updateOption = (qId: string, optIdx: number, val: string) => {
        const q = questions.find(q => q.id === qId);
        if (q && q.options) {
            const newOpts = [...q.options];
            newOpts[optIdx] = val;
            updateQuestion(qId, { options: newOpts });
        }
    };

    const removeOption = (qId: string, optIdx: number) => {
        const q = questions.find(q => q.id === qId);
        if (q && q.options && q.options.length > 1)
            updateQuestion(qId, { options: q.options.filter((_, i) => i !== optIdx) });
    };

    const handleSave = () => onSave({ title, description, questions });

    return (
        <>
            {showPreview && (
                <PreviewModal
                    title={title}
                    description={description}
                    questions={questions}
                    onClose={() => setShowPreview(false)}
                />
            )}

            <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[300] flex flex-col pt-16">
                {/* Header */}
                <header className="fixed top-0 inset-x-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                            <X size={24} className="text-slate-500" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                <Layout size={20} />
                            </div>
                            <span className="font-bold text-lg dark:text-white">Baknus Form Builder</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPreview(true)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-semibold transition-all border border-indigo-200 dark:border-indigo-800"
                        >
                            <Eye size={18} /> Preview
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <Save size={18} /> Simpan Form
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 md:p-12">
                    <div className="max-w-3xl mx-auto space-y-6 pb-20">
                        {/* Title & Description */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl border-t-[12px] border-indigo-600 p-8 shadow-sm space-y-4">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Judul Formulir"
                                className="w-full text-4xl font-extrabold text-slate-800 dark:text-white bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Deskripsi formulir (opsional)"
                                className="w-full text-lg text-slate-500 dark:text-slate-400 bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[60px]"
                            />
                        </div>

                        {/* Questions List */}
                        {questions.map((q) => (
                            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group relative">
                                <div className="absolute left-1/2 -top-3 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                                    <GripVertical size={20} className="text-slate-300 rotate-90" />
                                </div>

                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                value={q.label}
                                                onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                                                placeholder="Pertanyaan"
                                                className="flex-1 text-xl font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            />
                                            <select
                                                value={q.type}
                                                onChange={(e) => updateQuestion(q.id, {
                                                    type: e.target.value,
                                                    options: ['multiple', 'dropdown', 'checkbox'].includes(e.target.value)
                                                        ? q.options || ['Opsi 1']
                                                        : undefined
                                                })}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-2xl text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="text">Jawaban Singkat</option>
                                                <option value="paragraph">Paragraf</option>
                                                <option value="multiple">Pilihan Ganda</option>
                                                <option value="dropdown">Dropdown</option>
                                                <option value="checkbox">Checkbox</option>
                                            </select>
                                        </div>

                                        {/* Options for Choice Types */}
                                        {(q.type === 'multiple' || q.type === 'dropdown' || q.type === 'checkbox') && (
                                            <div className="space-y-3 pl-4">
                                                {q.options?.map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-3">
                                                        {q.type === 'multiple' && <div className="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0" />}
                                                        {q.type === 'checkbox' && <div className="w-5 h-5 border-2 border-slate-300 rounded flex-shrink-0" />}
                                                        {q.type === 'dropdown' && <span className="text-slate-400 font-bold w-5 text-center flex-shrink-0">{optIdx + 1}.</span>}
                                                        <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                                                            className="flex-1 bg-transparent border-b border-transparent focus:border-slate-200 dark:focus:border-slate-700 outline-none py-1 text-slate-700 dark:text-slate-300"
                                                        />
                                                        <button onClick={() => removeOption(q.id, optIdx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addOption(q.id)}
                                                    className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline flex items-center gap-2 mt-2"
                                                >
                                                    <Plus size={16} /> Tambah Opsi
                                                </button>
                                            </div>
                                        )}

                                        {q.type === 'text' && (
                                            <div className="pl-4">
                                                <div className="w-full h-px bg-slate-200 dark:bg-slate-700 mb-1" />
                                                <span className="text-xs text-slate-400">Teks jawaban singkat</span>
                                            </div>
                                        )}
                                        {q.type === 'paragraph' && (
                                            <div className="pl-4">
                                                <div className="w-full h-px bg-slate-200 dark:bg-slate-700 mb-1" />
                                                <div className="w-3/4 h-px bg-slate-200 dark:bg-slate-700 mb-1" />
                                                <span className="text-xs text-slate-400">Teks jawaban panjang</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-700/50 flex justify-end items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-500 tracking-tight">Wajib Diisi</span>
                                        <button
                                            onClick={() => updateQuestion(q.id, { required: !q.required })}
                                            className={`w-12 h-6 rounded-full relative transition-colors ${q.required ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${q.required ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                                    <button onClick={() => removeQuestion(q.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-center pt-8">
                            <button
                                onClick={addQuestion}
                                className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 text-slate-400 p-6 rounded-[32px] transition-all flex flex-col items-center gap-3 min-w-[200px]"
                            >
                                <Plus size={32} />
                                <span className="font-bold">Tambah Pertanyaan</span>
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default FormBuilder;
