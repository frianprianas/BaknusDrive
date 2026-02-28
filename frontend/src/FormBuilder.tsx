import React, { useState, useRef } from 'react';
import {
    X, Plus, Trash2, GripVertical,
    Save, Eye, Send, CheckCircle2,
    ChevronDown, ToggleLeft, ToggleRight,
    ClipboardList, Sparkles, AlignLeft, Type,
    ListOrdered, CheckSquare, CircleDot
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
    initialData?: any | null;
}

// ─── Color themes ─────────────────────────────────────────────────────────────
const THEMES = [
    { name: 'Indigo', accent: '#6366f1', bar: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-400', border: 'border-indigo-500' },
    { name: 'Violet', accent: '#8b5cf6', bar: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-400', border: 'border-violet-500' },
    { name: 'Rose', accent: '#f43f5e', bar: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-400', border: 'border-rose-500' },
    { name: 'Teal', accent: '#14b8a6', bar: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal-400', border: 'border-teal-500' },
    { name: 'Amber', accent: '#f59e0b', bar: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-400', border: 'border-amber-500' },
    { name: 'Blue', accent: '#3b82f6', bar: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-400', border: 'border-blue-500' },
];

const QUESTION_TYPES = [
    { value: 'text', label: 'Jawaban Singkat', icon: Type },
    { value: 'paragraph', label: 'Paragraf', icon: AlignLeft },
    { value: 'multiple', label: 'Pilihan Ganda', icon: CircleDot },
    { value: 'checkbox', label: 'Kotak Centang', icon: CheckSquare },
    { value: 'dropdown', label: 'Dropdown', icon: ListOrdered },
];

// ─── Preview Modal ─────────────────────────────────────────────────────────────
const PreviewModal: React.FC<{
    title: string; description: string; questions: Question[];
    themeIdx: number; onClose: () => void;
}> = ({ title, description, questions, themeIdx, onClose }) => {
    const theme = THEMES[themeIdx];
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [submitted, setSubmitted] = useState(false);

    if (submitted) return (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-12 text-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: theme.accent + '20' }}>
                    <CheckCircle2 size={52} style={{ color: theme.accent }} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-3">Terima Kasih!</h2>
                <p className="text-slate-500 text-lg mb-8">Preview pengisian selesai. Data tidak tersimpan.</p>
                <button onClick={() => { setSubmitted(false); setResponses({}); }}
                    className="font-bold text-base transition-all"
                    style={{ color: theme.accent }}>
                    Isi Lagi
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Banner */}
            <div className="sticky top-0 z-20 text-white text-sm font-semibold flex items-center justify-between px-6 py-3" style={{ backgroundColor: theme.accent }}>
                <span className="flex items-center gap-2"><Eye size={16} /> Mode Preview — Data tidak akan tersimpan</span>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
            </div>

            <div className="min-h-screen px-4 py-10 bg-slate-100">
                <div className="max-w-2xl mx-auto space-y-5">
                    {/* Header */}
                    <div className="bg-white rounded-[24px] overflow-hidden shadow-sm">
                        <div className="h-3" style={{ backgroundColor: theme.accent }} />
                        <div className="p-8">
                            <h1 className="text-3xl font-black text-slate-900 mb-3">{title || 'Formulir Tanpa Judul'}</h1>
                            {description && <p className="text-slate-500 text-base">{description}</p>}
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <span className="text-xs text-red-500 font-semibold">* Wajib diisi</span>
                            </div>
                        </div>
                    </div>

                    {/* Questions */}
                    <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4 pb-16">
                        {questions.map((q) => (
                            <div key={q.id} className="bg-white rounded-[20px] p-7 shadow-sm">
                                <label className="block text-lg font-bold text-slate-800 mb-5">
                                    {q.label || <span className="text-slate-300 italic">Pertanyaan kosong</span>}
                                    {q.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                {q.type === 'text' && (
                                    <input type="text" required={q.required} placeholder="Jawaban Anda" onChange={(e) => setResponses(p => ({ ...p, [q.id]: e.target.value }))}
                                        className="w-full border-b-2 border-slate-200 focus:border-current outline-none py-2 text-base text-slate-700 bg-transparent transition-colors"
                                        style={{ '--tw-border-opacity': 1 } as any}
                                        onFocus={e => e.target.style.borderColor = theme.accent}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                )}
                                {q.type === 'paragraph' && (
                                    <textarea required={q.required} placeholder="Jawaban Anda" rows={4}
                                        onChange={(e) => setResponses(p => ({ ...p, [q.id]: e.target.value }))}
                                        className="w-full border-b-2 border-slate-200 outline-none py-2 text-base text-slate-700 bg-transparent resize-none transition-colors"
                                        onFocus={e => e.target.style.borderColor = theme.accent}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                )}
                                {(q.type === 'multiple' || q.type === 'checkbox') && (
                                    <div className="space-y-3">
                                        {q.options?.map((opt, idx) => (
                                            <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                                                <input type={q.type === 'multiple' ? 'radio' : 'checkbox'} name={q.id}
                                                    onChange={e => {
                                                        if (q.type === 'multiple') setResponses(p => ({ ...p, [q.id]: opt }));
                                                        else {
                                                            const cur = responses[q.id] || [];
                                                            setResponses(p => ({ ...p, [q.id]: e.target.checked ? [...cur, opt] : cur.filter((o: string) => o !== opt) }));
                                                        }
                                                    }}
                                                    className="w-5 h-5 cursor-pointer accent-current" style={{ accentColor: theme.accent }} />
                                                <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'dropdown' && (
                                    <select required={q.required} onChange={e => setResponses(p => ({ ...p, [q.id]: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl p-3 text-base outline-none">
                                        <option value="">Pilih Opsi</option>
                                        {q.options?.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                                    </select>
                                )}
                            </div>
                        ))}

                        <div className="bg-white rounded-[20px] p-6 shadow-sm flex items-center gap-4">
                            <button type="submit"
                                className="text-white px-8 py-3 rounded-xl font-bold text-base shadow-lg transition-all hover:opacity-90 hover:scale-105 active:scale-95 flex items-center gap-2"
                                style={{ backgroundColor: theme.accent }}>
                                <Send size={18} /> Kirim Jawaban
                            </button>
                            <button type="button" onClick={() => setResponses({})} className="text-slate-400 hover:text-red-400 font-semibold transition-colors">
                                Hapus
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ─── Main FormBuilder ───────────────────────────────────────────────────────────
const FormBuilder: React.FC<FormBuilderProps> = ({ onClose, onSave, initialData }) => {
    const parseInitialQuestions = (): Question[] => {
        if (!initialData?.questions) return [{ id: 'q1', type: 'text', label: '', required: false }];
        try {
            const q = typeof initialData.questions === 'string' ? JSON.parse(initialData.questions) : initialData.questions;
            return Array.isArray(q) && q.length > 0 ? q : [{ id: 'q1', type: 'text', label: '', required: false }];
        } catch { return [{ id: 'q1', type: 'text', label: '', required: false }]; }
    };

    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [questions, setQuestions] = useState<Question[]>(parseInitialQuestions);
    const [themeIdx, setThemeIdx] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [activeQ, setActiveQ] = useState<string | null>(questions[0]?.id ?? null);
    const [saved, setSaved] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);

    const theme = THEMES[themeIdx];

    const addQuestion = () => {
        const newId = 'q' + Math.random().toString(36).substr(2, 9);
        const newQ: Question = { id: newId, type: 'text', label: '', required: false };
        setQuestions(prev => [...prev, newQ]);
        setActiveQ(newId);
    };

    const removeQuestion = (id: string) => {
        if (questions.length <= 1) return;
        const filtered = questions.filter(q => q.id !== id);
        setQuestions(filtered);
        setActiveQ(filtered[filtered.length - 1]?.id ?? null);
    };

    const updateQuestion = (id: string, updates: Partial<Question>) =>
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

    const addOption = (qId: string) => {
        const q = questions.find(q => q.id === qId);
        if (q) {
            const opts = q.options || ['Opsi 1'];
            updateQuestion(qId, { options: [...opts, `Opsi ${opts.length + 1}`] });
        }
    };

    const updateOption = (qId: string, idx: number, val: string) => {
        const q = questions.find(q => q.id === qId);
        if (q?.options) {
            const opts = [...q.options];
            opts[idx] = val;
            updateQuestion(qId, { options: opts });
        }
    };

    const removeOption = (qId: string, idx: number) => {
        const q = questions.find(q => q.id === qId);
        if (q?.options && q.options.length > 1)
            updateQuestion(qId, { options: q.options.filter((_, i) => i !== idx) });
    };

    const handleSave = () => {
        onSave({ title: title || 'Formulir Tanpa Judul', description, questions });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const getTypeIcon = (type: string) => {
        const found = QUESTION_TYPES.find(t => t.value === type);
        const Icon = found?.icon || Type;
        return <Icon size={15} />;
    };

    return (
        <>
            {showPreview && (
                <PreviewModal title={title} description={description} questions={questions}
                    themeIdx={themeIdx} onClose={() => setShowPreview(false)} />
            )}

            <div className="fixed inset-0 z-[300] flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: '#f1f5f9' }}>

                {/* ── TOP NAV ── */}
                <header className="flex-none h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 shadow-sm z-20">
                    <button onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                        <X size={20} />
                    </button>

                    {/* Logo + Title */}
                    <div className="flex items-center gap-2 mr-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: theme.accent }}>
                            <ClipboardList size={18} />
                        </div>
                        <input
                            ref={titleRef}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Judul Formulir"
                            className="text-base font-bold text-slate-800 bg-transparent border-none outline-none w-48 md:w-64 placeholder:text-slate-300"
                        />
                    </div>

                    {/* Theme switcher */}
                    <div className="hidden md:flex items-center gap-1.5 ml-auto mr-2">
                        {THEMES.map((t, i) => (
                            <button key={i} onClick={() => setThemeIdx(i)}
                                className={`w-6 h-6 rounded-full transition-all border-2 ${i === themeIdx ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: t.accent }} title={t.name} />
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-auto md:ml-0">
                        <button onClick={() => setShowPreview(true)}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-colors">
                            <Eye size={15} /> Preview
                        </button>
                        <button onClick={handleSave}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-bold text-sm shadow transition-all hover:opacity-90 hover:scale-105 active:scale-95"
                            style={{ backgroundColor: saved ? '#10b981' : theme.accent }}>
                            {saved ? <><CheckCircle2 size={15} /> Tersimpan!</> : <><Save size={15} /> Simpan Form</>}
                        </button>
                    </div>
                </header>

                {/* ── BODY ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── LEFT: Question List Panel ── */}
                    <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-100 overflow-y-auto">
                        <div className="p-3 border-b border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Pertanyaan</p>
                            {questions.map((q, idx) => (
                                <button key={q.id} onClick={() => setActiveQ(q.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-start gap-2 transition-all group ${activeQ === q.id ? 'text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                    style={activeQ === q.id ? { backgroundColor: theme.accent } : {}}>
                                    <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold mt-0.5"
                                        style={activeQ === q.id ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-xs font-medium leading-snug truncate">
                                        {q.label || 'Tanpa Judul'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button onClick={addQuestion}
                            className="mx-3 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-current hover:text-current text-slate-400 text-sm font-semibold transition-all"
                            style={{ '--hover-color': theme.accent } as any}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent; (e.currentTarget as HTMLButtonElement).style.color = theme.accent; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ''; (e.currentTarget as HTMLButtonElement).style.color = ''; }}
                        >
                            <Plus size={16} /> Tambah Soal
                        </button>
                    </aside>

                    {/* ── CENTER: Editor ── */}
                    <main className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="max-w-2xl mx-auto space-y-4 pb-20">

                            {/* Header card */}
                            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                                <div className="h-2.5" style={{ backgroundColor: theme.accent }} />
                                <div className="p-6 md:p-8 space-y-3">
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Judul Formulir"
                                        className="w-full text-3xl md:text-4xl font-black text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-200"
                                    />
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Deskripsi formulir (opsional) — jelaskan tujuan formulir ini..."
                                        className="w-full text-base text-slate-500 bg-transparent border-none outline-none resize-none min-h-[50px] placeholder:text-slate-300"
                                    />
                                    <div className="flex items-center gap-2 pt-2">
                                        <Sparkles size={14} style={{ color: theme.accent }} />
                                        <span className="text-xs text-slate-400 font-medium">Baknus Form Builder</span>
                                    </div>
                                </div>
                            </div>

                            {/* Question cards */}
                            {questions.map((q, idx) => {
                                const isActive = activeQ === q.id;
                                return (
                                    <div key={q.id}
                                        onClick={() => setActiveQ(q.id)}
                                        className={`bg-white rounded-2xl shadow-sm border transition-all cursor-pointer overflow-hidden ${isActive ? 'border-transparent shadow-md ring-2' : 'border-slate-100 hover:border-slate-200'}`}
                                        style={isActive ? { '--tw-ring-color': theme.accent, ringColor: theme.accent, boxShadow: `0 0 0 2px ${theme.accent}` } as any : {}}>

                                        {/* Card top accent */}
                                        {isActive && <div className="h-1" style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}88)` }} />}

                                        <div className="p-6">
                                            {/* Question header row */}
                                            <div className="flex items-start gap-3 mb-5">
                                                {/* Number badge */}
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-1"
                                                    style={isActive ? { backgroundColor: theme.accent, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                                                    {idx + 1}
                                                </div>

                                                <div className="flex-1 space-y-3">
                                                    {/* Question label input */}
                                                    <input
                                                        type="text"
                                                        value={q.label}
                                                        onChange={e => updateQuestion(q.id, { label: e.target.value })}
                                                        placeholder="Ketik pertanyaan..."
                                                        className="w-full text-lg font-bold text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-300 focus:placeholder:text-slate-200"
                                                    />

                                                    {/* Type selector */}
                                                    {isActive && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {QUESTION_TYPES.map(t => {
                                                                const Icon = t.icon;
                                                                return (
                                                                    <button key={t.value}
                                                                        onClick={e => { e.stopPropagation(); updateQuestion(q.id, { type: t.value, options: ['multiple', 'dropdown', 'checkbox'].includes(t.value) ? q.options || ['Opsi 1', 'Opsi 2'] : undefined }); }}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                                                                        style={q.type === t.value ? { backgroundColor: theme.accent + '15', color: theme.accent, borderColor: theme.accent + '40' } : { backgroundColor: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
                                                                        <Icon size={12} /> {t.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Show type badge when not active */}
                                                    {!isActive && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                                                            {getTypeIcon(q.type)}
                                                            {QUESTION_TYPES.find(t => t.value === q.type)?.label}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Grip */}
                                                <GripVertical size={20} className="text-slate-300 flex-shrink-0 mt-1 cursor-grab" />
                                            </div>

                                            {/* Answer area preview */}
                                            {q.type === 'text' && (
                                                <div className="ml-10 border-b-2 border-slate-200 pb-1">
                                                    <span className="text-slate-300 text-sm">Jawaban singkat...</span>
                                                </div>
                                            )}
                                            {q.type === 'paragraph' && (
                                                <div className="ml-10 space-y-1.5">
                                                    {[100, 75, 85].map((w, i) => (
                                                        <div key={i} className="h-px bg-slate-200 rounded" style={{ width: `${w}%` }} />
                                                    ))}
                                                    <span className="text-slate-300 text-xs">Jawaban panjang...</span>
                                                </div>
                                            )}

                                            {/* Options */}
                                            {(q.type === 'multiple' || q.type === 'dropdown' || q.type === 'checkbox') && (
                                                <div className="ml-10 space-y-2 mt-2">
                                                    {q.options?.map((opt, optIdx) => (
                                                        <div key={optIdx} className="flex items-center gap-3 group/opt">
                                                            {q.type === 'multiple' && (
                                                                <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                                            )}
                                                            {q.type === 'checkbox' && (
                                                                <div className="w-4 h-4 rounded border-2 border-slate-300 flex-shrink-0" />
                                                            )}
                                                            {q.type === 'dropdown' && (
                                                                <span className="text-slate-400 text-sm font-bold w-5 text-center flex-shrink-0">{optIdx + 1}.</span>
                                                            )}
                                                            {isActive ? (
                                                                <input type="text" value={opt}
                                                                    onChange={e => updateOption(q.id, optIdx, e.target.value)}
                                                                    className="flex-1 text-sm text-slate-700 bg-transparent border-b border-transparent focus:border-slate-300 outline-none py-1 transition-colors"
                                                                    onClick={e => e.stopPropagation()} />
                                                            ) : (
                                                                <span className="flex-1 text-sm text-slate-600">{opt}</span>
                                                            )}
                                                            {isActive && (
                                                                <button onClick={e => { e.stopPropagation(); removeOption(q.id, optIdx); }}
                                                                    className="opacity-0 group-hover/opt:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5 rounded">
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {isActive && (
                                                        <button onClick={e => { e.stopPropagation(); addOption(q.id); }}
                                                            className="flex items-center gap-1.5 text-xs font-bold transition-colors mt-1"
                                                            style={{ color: theme.accent }}>
                                                            <Plus size={14} /> Tambah Opsi
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer toolbar (active only) */}
                                            {isActive && (
                                                <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-slate-100">
                                                    {/* Required toggle */}
                                                    <button onClick={e => { e.stopPropagation(); updateQuestion(q.id, { required: !q.required }); }}
                                                        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                                                        {q.required
                                                            ? <ToggleRight size={22} style={{ color: theme.accent }} />
                                                            : <ToggleLeft size={22} className="text-slate-300" />}
                                                        Wajib Diisi
                                                    </button>
                                                    <div className="w-px h-5 bg-slate-200" />
                                                    {/* Delete */}
                                                    <button onClick={e => { e.stopPropagation(); removeQuestion(q.id); }}
                                                        className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add question button */}
                            <button onClick={addQuestion}
                                className="w-full bg-white rounded-2xl border-2 border-dashed border-slate-200 p-5 flex items-center justify-center gap-3 font-bold text-slate-400 transition-all hover:bg-white hover:shadow-sm"
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent; (e.currentTarget as HTMLButtonElement).style.color = theme.accent; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ''; (e.currentTarget as HTMLButtonElement).style.color = ''; }}>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-current">
                                    <Plus size={16} />
                                </div>
                                Tambah Pertanyaan
                            </button>
                        </div>
                    </main>

                    {/* ── RIGHT: Stats panel ── */}
                    <aside className="hidden xl:flex flex-col w-52 bg-white border-l border-slate-100 p-4 gap-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ringkasan</p>

                        <div className="rounded-xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}bb)` }}>
                            <p className="text-3xl font-black">{questions.length}</p>
                            <p className="text-sm opacity-80 font-medium">Pertanyaan</p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-2xl font-black text-slate-700">{questions.filter(q => q.required).length}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">Wajib Diisi</p>
                        </div>

                        <div className="space-y-2 mt-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe</p>
                            {QUESTION_TYPES.map(t => {
                                const count = questions.filter(q => q.type === t.value).length;
                                if (!count) return null;
                                const Icon = t.icon;
                                return (
                                    <div key={t.value} className="flex items-center gap-2 text-sm text-slate-500">
                                        <Icon size={13} style={{ color: theme.accent }} />
                                        <span className="flex-1 text-xs">{t.label}</span>
                                        <span className="font-bold text-slate-700">{count}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-auto">
                            <button onClick={() => setShowPreview(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: theme.accent }}>
                                <Eye size={15} /> Preview
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
};

export default FormBuilder;
