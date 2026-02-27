import React, { useState } from 'react';
import {
    X, Plus, Trash2, GripVertical, CheckCircle2,
    Type, List, AlignLeft, ChevronDown, Save,
    ChevronUp, Settings, Eye, Layout
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

const FormBuilder: React.FC<FormBuilderProps> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('Formulir Tanpa Judul');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        { id: '1', type: 'text', label: 'Pertanyaan Tanpa Judul', required: false }
    ]);

    const addQuestion = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        setQuestions([...questions, { id: newId, type: 'text', label: '', required: false }]);
    };

    const removeQuestion = (id: string) => {
        if (questions.length > 1) {
            setQuestions(questions.filter(q => q.id !== id));
        }
    };

    const updateQuestion = (id: string, updates: Partial<Question>) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    };

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
        if (q && q.options && q.options.length > 1) {
            const newOpts = q.options.filter((_, i) => i !== optIdx);
            updateQuestion(qId, { options: newOpts });
        }
    };

    const handleSave = () => {
        onSave({
            title,
            description,
            questions
        });
    };

    return (
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
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-all">
                        <Eye size={18} /> Preview
                    </button>
                    <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 rounded-xl">
                        <Settings size={20} />
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
                    {/* Title & Description Section */}
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
                    {questions.map((q, idx) => (
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
                                            onChange={(e) => updateQuestion(q.id, { type: e.target.value, options: (e.target.value === 'multiple' || e.target.value === 'dropdown' || e.target.value === 'checkbox') ? q.options || ['Opsi 1'] : undefined })}
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
                                                    {q.type === 'multiple' && <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />}
                                                    {q.type === 'checkbox' && <div className="w-5 h-5 border-2 border-slate-300 rounded" />}
                                                    {q.type === 'dropdown' && <span className="text-slate-400 font-bold w-5 text-center">{optIdx + 1}.</span>}

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
                                            <div className="w-full h-px bg-slate-200 dark:bg-slate-700 mb-1" />
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
    );
};

export default FormBuilder;
