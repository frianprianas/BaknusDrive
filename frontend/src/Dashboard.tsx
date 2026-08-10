import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import logo from './assets/logo.png';
import FormBuilder from './FormBuilder';
import {
    Search, Menu, X, Filter, LayoutGrid, Clock, Users, Database,
    Settings, LogOut, ChevronRight, Bell,
    Grid, List, AlertCircle, HardDrive, MonitorSmartphone,
    Star, Trash2, Folder as FolderIcon, File as FileIcon, Image as ImageIcon, FileText, FileSpreadsheet, Presentation,
    FileAudio, FileVideo, FileArchive, FileCode,
    Cloud, Plus, Download, FolderPlus, Upload, FileUp, Check,
    Edit2, Copy, Trash, RotateCcw, Share2, Sun, Moon, Eye, Shield, Lock, Unlock,
    HelpCircle, Grip, UserX, Loader2, ExternalLink, ClipboardList, Pencil, Link, Brain, Sparkles
} from 'lucide-react';

const isImageFile = (f: any) => f?.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(f?.name || '');
const isPdfFile = (f: any) => f?.mime_type === 'application/pdf' || /\.(pdf)$/i.test(f?.name || '');
const isVideoFile = (f: any) => f?.mime_type?.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(f?.name || '');
const isTextFile = (f: any) => f?.mime_type?.startsWith('text/') || /\.(txt|csv|md|json|log|xml|js|ts|jsx|tsx|css|html|go)$/i.test(f?.name || '');
const isDocFile = (f: any) => /\.(docx|xlsx|pptx|doc|xls|ppt)$/i.test(f?.name || '');

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [folders, setFolders] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    // const [devices, setDevices] = useState<any[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [myForms, setMyForms] = useState<any[]>([]);
    const [showFormBuilder, setShowFormBuilder] = useState(false);
    const [editingForm, setEditingForm] = useState<any | null>(null);
    const [responsesModal, setResponsesModal] = useState<{ visible: boolean, form: any }>({ visible: false, form: null });
    const [formResponses, setFormResponses] = useState<any[]>([]);
    const [loadingResponses, setLoadingResponses] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [currentView, setCurrentView] = useState('drive');
    const [breadcrumb, setBreadcrumb] = useState<{ id: number | string | null, name: string }[]>([{ id: null, name: 'My Drive' }]);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, item: any, type: 'file' | 'folder' | 'background' | null }>({ visible: false, x: 0, y: 0, item: null, type: null });
    const [clipboard, setClipboard] = useState<{ item: any, type: 'file' | 'folder', action: 'copy' | 'cut' } | null>(null);

    const [shareModal, setShareModal] = useState<{ visible: boolean, item: any, type: 'file' | 'folder' | null }>({ visible: false, item: null, type: null });
    const [accessDetailsModal, setAccessDetailsModal] = useState<{ visible: boolean, folder: any, shares: any[], loading: boolean }>({
        visible: false,
        folder: null,
        shares: [],
        loading: false
    });
    const [isBlindDrop, setIsBlindDrop] = useState(false);
    const [canEdit, setCanEdit] = useState(true);
    const [canDownload, setCanDownload] = useState(true);
    const [aiModal, setAiModal] = useState<{ visible: boolean, folder: any, analysis: string, loading: boolean, error: string }>({
        visible: false,
        folder: null,
        analysis: '',
        loading: false,
        error: ''
    });
    const [publicLinkModal, setPublicLinkModal] = useState<{ visible: boolean, item: any, type: 'file' | 'folder' | null, password: string, expiration: string }>({ visible: false, item: null, type: null, password: '', expiration: '' });
    const [renameModal, setRenameModal] = useState<{ visible: boolean, item: any, type: 'file' | 'folder' | null }>({ visible: false, item: null, type: null });
    const [tempRenameName, setTempRenameName] = useState("");
    const [deleteModal, setDeleteModal] = useState<{ visible: boolean, item: any, type: 'file' | 'folder' | null }>({ visible: false, item: null, type: null });
    const [usersList, setUsersList] = useState<any[]>([]); // also used for admin users view
    const [searchUser, setSearchUser] = useState("");
    const [roleFilter, setRoleFilter] = useState("Semua");
    const [storageInfo, setStorageInfo] = useState<{ used: number, quota: number } | null>(null);
    const [selectedItems, setSelectedItems] = useState<{ id: number, type: 'file' | 'folder', item: any }[]>([]);
    const [adminTargetUser, setAdminTargetUser] = useState<string | null>(null);
    const [quotaModal, setQuotaModal] = useState<{ visible: boolean, user: any }>({ visible: false, user: null });
    const [tempQuotaGB, setTempQuotaGB] = useState<string>("");
    const [tempClass, setTempClass] = useState<string>("");
    const [userActivityModal, setUserActivityModal] = useState<{ visible: boolean, user: any, activities: any[], loading: boolean }>({
        visible: false,
        user: null,
        activities: [],
        loading: false,
    });
    const [activitySearchQuery, setActivitySearchQuery] = useState('');
    const [activityCurrentPage, setActivityCurrentPage] = useState(1);
    const activityItemsPerPage = 8;
    const [searchClass, setSearchClass] = useState("");
    const [adminCurrentPage, setAdminCurrentPage] = useState(1);
    const adminItemsPerPage = 20;
    const [itemShares, setItemShares] = useState<any[]>([]);
    const [mySharesList, setMySharesList] = useState<any[]>([]);
    const [specialCandidates, setSpecialCandidates] = useState<any[]>([]);
    const [specialAllowed, setSpecialAllowed] = useState<any[]>([]);

    const [uploadProgress, setUploadProgress] = useState<{ active: boolean, percent: number, fileName: string }>({ active: false, percent: 0, fileName: "" });
    const [downloading, setDownloading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [formStatusFilter, setFormStatusFilter] = useState("Semua");
    const [newDocModal, setNewDocModal] = useState<{ visible: boolean, type: string, name: string }>({ visible: false, type: '', name: '' });
    const [isDraggingOverBase, setIsDraggingOverBase] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        }

        const handleGlobalClick = (e: MouseEvent) => {
            if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));

            // Clear selection if clicking outside valid item area 
            // We rely on stopPropagation on item clicks
            const target = e.target as HTMLElement;
            if (!target.closest('.selectable-item') && !target.closest('.bulk-action-bar')) {
                setSelectedItems([]);
            }
        };
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        if (debouncedSearchQuery.trim() !== '') {
            if (currentView !== 'search') setCurrentView('search');
            setCurrentFolderId(null);
            setBreadcrumb([{ id: null, name: `Search results for "${debouncedSearchQuery}"` }]);
        } else if (currentView === 'search') {
            setCurrentView('drive');
            setCurrentFolderId(null);
            setBreadcrumb([{ id: null, name: 'My Drive' }]);
        }
    }, [debouncedSearchQuery]);

    useEffect(() => {
        fetchUserProfile();
        fetchDriveData();
        fetchUsers();
        fetchNotifications();
    }, [currentFolderId, currentView, selectedDevice, debouncedSearchQuery]);

    // Fast polling for forms to give a "real-time" feel for response counts
    useEffect(() => {
        let interval: any;
        if (currentView === 'forms' && !responsesModal.visible && !showFormBuilder) {
            interval = setInterval(() => {
                const token = localStorage.getItem('token');
                if (token) {
                    axios.get('/api/forms', {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(resp => {
                        setMyForms(resp.data || []);
                    }).catch(err => console.error("Real-time poll failed:", err));
                }
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentView, responsesModal.visible, showFormBuilder]);


    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const resp = await axios.get('/api/me', { headers: { Authorization: `Bearer ${token}` } });
            if (resp.data) {
                setUser(resp.data);
                localStorage.setItem('user', JSON.stringify(resp.data));
            }
        } catch (error) {
            console.error("Failed to fetch user profile", error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const resp = await axios.get('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(resp.data || []);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    };

    const markNotificationRead = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const markAllNotificationsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/notifications/read-all', {}, { headers: { Authorization: `Bearer ${token}` } });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setShowNotifications(false);
        } catch (error) {
            console.error("Failed to mark all as read", error);
        }
    };

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
        if (!isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } });
            setUsersList(resp.data.users || []);
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    const fetchStorageQuota = async () => {
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get('/api/drive/quota', { headers: { Authorization: `Bearer ${token}` } });
            setStorageInfo(resp.data);
        } catch (error) {
            console.error("Failed to fetch storage quota", error);
        }
    };

    // const fetchDevices = async () => {
    //     try {
    //         const token = localStorage.getItem('token');
    //         const resp = await axios.get('/api/drive/devices', { headers: { Authorization: `Bearer ${token}` } });
    //         // setDevices(resp.data || []);
    //     } catch (error) {
    //         console.error("Failed to fetch devices", error);
    //     }
    // };

    const fetchDriveData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (currentView === 'forms') {
                const resp = await axios.get('/api/forms', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMyForms(resp.data || []);
                setBreadcrumb([{ id: null, name: 'Baknus Form' }]);
            } else if (currentView === 'starred') {
                const resp = await axios.get('/api/drive/starred', { headers: { Authorization: `Bearer ${token}` } });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            } else if (currentView === 'recent') {
                const resp = await axios.get('/api/drive/recent', { headers: { Authorization: `Bearer ${token}` } });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            } else if (currentView === 'search') {
                const resp = await axios.get('/api/drive/search', {
                    params: { q: debouncedSearchQuery },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            } else if (currentView === 'trash') {
                const resp = await axios.get('/api/drive/trash', { headers: { Authorization: `Bearer ${token}` } });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            } else if (currentView === 'computers') {
                if (currentFolderId) {
                    const resp = await axios.get('/api/drive', {
                        params: { parent_id: currentFolderId },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setFolders(resp.data.folders || []);
                    setFiles(resp.data.files || []);
                } else if (selectedDevice) {
                    const resp = await axios.get('/api/drive', {
                        params: { device_id: selectedDevice.id },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setFolders(resp.data.folders || []);
                    setFiles(resp.data.files || []);
                } else {
                    // await fetchDevices();
                    setFolders([]);
                    setFiles([]);
                }
            } else if (currentView === 'shared') {
                if (currentFolderId) {
                    const resp = await axios.get('/api/drive', {
                        params: { parent_id: currentFolderId },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setFolders(resp.data.folders || []);
                    setFiles(resp.data.files || []);
                } else {
                    const resp = await axios.get('/api/drive/shared-with-me', { headers: { Authorization: `Bearer ${token}` } });
                    setFolders(resp.data.folders || []);
                    setFiles(resp.data.files || []);
                }
            } else if (currentView === 'my-shares') {
                const resp = await axios.get('/api/drive/my-shares', { headers: { Authorization: `Bearer ${token}` } });
                setMySharesList(resp.data.shares || []);
                setFolders([]);
                setFiles([]);
            } else if (currentView === 'admin') {
                const resp = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
                console.log("Admin Users List:", resp.data.users);
                setUsersList(resp.data.users || []);
                try {
                    const specialResp = await axios.get('/api/admin/special-share-users', { headers: { Authorization: `Bearer ${token}` } });
                    setSpecialAllowed(specialResp.data.allowed || []);
                    setSpecialCandidates(specialResp.data.candidates || []);
                } catch (err) {
                    console.error("Gagal mengambil data Guru/TU spesial:", err);
                }
                setFolders([]);
                setFiles([]);
            } else if (currentView === 'admin-drive') {
                const resp = await axios.get('/api/admin/drive', {
                    params: { user_id: adminTargetUser, parent_id: currentFolderId },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            } else {
                const resp = await axios.get('/api/drive', {
                    params: { parent_id: currentFolderId },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFolders(resp.data.folders || []);
                setFiles(resp.data.files || []);
            }
        } catch (error) {
            console.error("Failed to fetch drive data", error);
        } finally {
            setLoading(false);
            fetchStorageQuota();
        }
    };

    const handleSaveForm = async (formData: any) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/forms', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowFormBuilder(false);
            fetchDriveData();
            alert("Formulir berhasil disimpan!");
        } catch (error: any) {
            console.error("Failed to save form:", error);
            alert("Gagal menyimpan formulir: " + (error.response?.data?.error || error.message));
        }
    };

    const openResponsesModal = async (form: any) => {
        setResponsesModal({ visible: true, form });
        setFormResponses([]);
        setLoadingResponses(true);
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get(`/api/forms/${form.id}/responses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const responses = (resp.data || []).map((r: any) => {
                let parsed = {};
                try { parsed = JSON.parse(r.response_data); } catch { }
                return { ...r, parsed };
            });
            setFormResponses(responses);
        } catch (err) {
            console.error('Failed to load responses', err);
        } finally {
            setLoadingResponses(false);
        }
    };

    const exportResponsesToDrive = async () => {
        if (!responsesModal.form) return;
        setExporting(true);
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.post(
                `/api/forms/${responsesModal.form.id}/responses/export`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(`✅ ${resp.data.message}`);
        } catch (err: any) {
            alert(`❌ Gagal ekspor: ${err.response?.data?.error || err.message}`);
        } finally {
            setExporting(false);
        }
    };

    const handleEditForm = (form: any) => {
        setEditingForm(form);
        setShowFormBuilder(true);
    };

    const handleUpdateForm = async (formData: any) => {
        if (!editingForm) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/forms/${editingForm.id}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowFormBuilder(false);
            setEditingForm(null);
            fetchDriveData();
            alert('Formulir berhasil diperbarui!');
        } catch (error: any) {
            console.error('Failed to update form:', error);
            alert('Gagal memperbarui formulir: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteForm = async (form: any) => {
        if (!confirm(`Yakin ingin menghapus formulir "${form.title}"?\nSemua respon juga akan dihapus.`)) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/forms/${form.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            alert('Formulir berhasil dihapus!');
        } catch (error: any) {
            alert('Gagal menghapus formulir: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleCreateFolder = async () => {
        setShowNewMenu(false);
        const name = prompt("Enter folder name:");
        if (!name) return;

        const payload: any = { name };
        if (currentFolderId) {
            payload.parent_id = currentFolderId;
        } else if (currentView === 'computers' && selectedDevice) {
            payload.device_id = selectedDevice.id;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/drive/folder', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            alert("Failed to create folder");
        }
    };

    // const toggleStar = async (item: any, type: 'file' | 'folder') => {
    //     // Star logic not fully implemented in backend models yet, keeping UI state
    //     item.is_starred = !item.is_starred;
    //     setFiles([...files]);
    //     setFolders([...folders]);
    // };

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    const uploadChunk = async (chunk: Blob, chunkIndex: number, uploadId: string, token: string) => {
        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('upload_id', uploadId);
        formData.append('chunk_index', chunkIndex.toString());
        await axios.post('/api/drive/upload-chunk', formData, {
            headers: { Authorization: `Bearer ${token}` }
        });
    };

    const handleFilesUpload = async (files: FileList | File[], targetFolderOverride?: number | null) => {
        if (!files || files.length === 0) return;
        setShowNewMenu(false);
        const token = localStorage.getItem('token');
        if (!token) return;

        const folderIdToUse = targetFolderOverride !== undefined ? targetFolderOverride : currentFolderId;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Detect potential folders or empty files
            if (file.size === 0) {
                alert(`Gagal mengupload "${file.name}": Browser tidak mendukung upload folder secara langsung. Silakan kompres folder Anda menjadi format ZIP/RAR terlebih dahulu.`);
                continue;
            }

            const uploadId = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9);
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            try {
                setUploadProgress({ active: true, percent: 0, fileName: file.name });

                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    const start = chunkIndex * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    await uploadChunk(chunk, chunkIndex, uploadId, token);

                    const percentCompleted = Math.round(((chunkIndex + 1) / totalChunks) * 100);
                    setUploadProgress(prev => ({ ...prev, percent: percentCompleted }));
                }

                await axios.post('/api/drive/upload-complete', {
                    upload_id: uploadId,
                    file_name: file.name,
                    total_chunks: totalChunks,
                    total_size: file.size,
                    folder_id: folderIdToUse || null,
                    device_id: currentView === 'computers' && selectedDevice ? selectedDevice.id : null
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Animation for completion
                setUploadProgress(prev => ({ ...prev, percent: 100 }));
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (error: any) {
                if (error.response?.data?.error) {
                    alert(`Upload Gagal (${file.name}): ` + error.response.data.error);
                } else {
                    alert(`Failed to upload file: ${file.name}`);
                }
            }
        }

        setUploadProgress({ active: false, percent: 0, fileName: "" });
        fetchDriveData();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFilesUpload(e.target.files);
        }
    };

    const handleDownloadFile = async (id: number, name: string) => {
        try {
            setDownloading(true);
            const token = localStorage.getItem('token');
            const resp = await axios.get(`/api/drive/file/${id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', name);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Failed to download file", error);
            alert("Failed to download file");
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadFolder = async (id: number, name: string) => {
        try {
            setDownloading(true);
            const token = localStorage.getItem('token');
            const resp = await axios.get(`/api/drive/folder/${id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${name}.zip`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Failed to download folder", error);
            alert("Failed to download folder");
        } finally {
            setDownloading(false);
        }
    };

    const handleDeleteFile = (f: any) => {
        setDeleteModal({ visible: true, item: f, type: 'file' });
        if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
    };

    const handleDeleteFolder = (f: any) => {
        setDeleteModal({ visible: true, item: f, type: 'folder' });
        if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
    };

    const submitDelete = async () => {
        if (!deleteModal.item || !deleteModal.type) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/drive/${deleteModal.type}/${deleteModal.item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            setDeleteModal({ visible: false, item: null, type: null });
        } catch (error) {
            console.error("Failed to delete", error);
            alert("Failed to delete item");
        }
    };

    const handleClipboardCut = (item: any, type: 'file' | 'folder') => {
        setClipboard({ item, type, action: 'cut' });
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleClipboardCopy = (item: any, type: 'file' | 'folder') => {
        setClipboard({ item, type, action: 'copy' });
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleClipboardPaste = async () => {
        if (!clipboard) return;
        try {
            const token = localStorage.getItem('token');
            const data = { target_folder_id: currentFolderId };

            if (clipboard.action === 'copy') {
                if (clipboard.type === 'file') {
                    await axios.post(`/api/drive/file/${clipboard.item.id}/copy`, data, { headers: { Authorization: `Bearer ${token}` } });
                } else {
                    await axios.post(`/api/drive/folder/${clipboard.item.id}/copy`, data, { headers: { Authorization: `Bearer ${token}` } });
                }
            } else if (clipboard.action === 'cut') {
                if (clipboard.type === 'file') {
                    await axios.put(`/api/drive/file/${clipboard.item.id}/move`, data, { headers: { Authorization: `Bearer ${token}` } });
                } else {
                    await axios.put(`/api/drive/folder/${clipboard.item.id}/move`, data, { headers: { Authorization: `Bearer ${token}` } });
                }
                setClipboard(null); // Clear clipboard after successful cut & paste
            }
            fetchDriveData();
            setContextMenu({ ...contextMenu, visible: false });
        } catch (error: any) {
            console.error("Paste failed", error);
            if (error.response?.data?.error) {
                alert("Gagal melakukan paste: " + error.response.data.error);
            } else {
                alert("Failed to paste item.");
            }
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: any, type: 'file' | 'folder') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            item,
            type
        });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        if (currentView !== 'drive') return;
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            item: null,
            type: 'background'
        });
    };

    const toggleSelection = (item: any, type: 'file' | 'folder') => {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.id === item.id && i.type === type);
            if (exists) return prev.filter(i => !(i.id === item.id && i.type === type));
            return [...prev, { id: item.id, type, item }];
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.length === (folders.length + files.length) && (folders.length + files.length) > 0) {
            setSelectedItems([]);
        } else {
            const allItems: any[] = [
                ...folders.map(f => ({ id: f.id, type: 'folder', item: f })),
                ...files.map(f => ({ id: f.id, type: 'file', item: f }))
            ];
            setSelectedItems(allItems);
        }
    };

    const isSelected = (id: number, type: 'file' | 'folder') => selectedItems.some(i => i.id === id && i.type === type);

    const handleBulkDelete = async () => {
        if (!selectedItems.length) return;
        if (window.confirm(`Are you sure you want to delete ${selectedItems.length} selected items?`)) {
            setLoading(true);
            const token = localStorage.getItem('token');
            const promises = selectedItems.map(item => {
                const endpoint = item.type === 'file' ? `/api/drive/file/${item.id}` : `/api/drive/folder/${item.id}`;
                return axios.delete(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            });
            try {
                await Promise.allSettled(promises);
                setSelectedItems([]);
                fetchDriveData();
            } catch (err) {
                console.error("Bulk delete failed", err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRestoreItem = async (itemOverride?: any, typeOverride?: 'file' | 'folder') => {
        const item = itemOverride || contextMenu.item;
        const type = typeOverride || contextMenu.type;
        if (!item || !type) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/drive/trash/${type}/${item.id}/restore`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            console.error("Failed to restore", error);
            alert("Failed to restore");
        }
    };

    // Drag and Drop (Move) Logic
    const handleMoveItem = async (draggedId: string, draggedType: 'file' | 'folder', targetFolderId: number | null) => {
        try {
            const token = localStorage.getItem('token');
            const data = { target_folder_id: targetFolderId };

            if (draggedType === 'file') {
                await axios.put(`/api/drive/file/${draggedId}/move`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                if (parseInt(draggedId) === targetFolderId) return;
                await axios.put(`/api/drive/folder/${draggedId}/move`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            fetchDriveData();
        } catch (error) {
            console.error("Failed to move item", error);
            alert("Failed to move item. Ensure you have the necessary permissions.");
        }
    };

    const handleDragStartItem = (e: React.DragEvent, id: number, type: 'file' | 'folder') => {
        if (currentView !== 'my-drive' && currentView !== 'computer') return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('application/json', JSON.stringify({ id, type }));
        // Add visual feedback (need requestAnimationFrame so drag image reflects original state before opacity is set)
        if (e.target instanceof HTMLElement) {
            const target = e.target;
            requestAnimationFrame(() => {
                target.classList.add('opacity-40', 'scale-95', 'z-50');
            });
        }
    };

    const handleDragEndItem = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) {
            e.target.classList.remove('opacity-40', 'scale-95', 'z-50');
        }
    };

    const handleBaseDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingOverBase(true);
        }
    };

    const handleBaseDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleBaseDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const related = e.relatedTarget as Node | null;
        if (e.currentTarget.contains(related)) return;
        setIsDraggingOverBase(false);
    };

    const handleBaseDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverBase(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesUpload(e.dataTransfer.files);
        }
    };

    const handleDropOnFolder = (e: React.DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/40', 'ring-2', 'ring-[#007b83]');

        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesUpload(e.dataTransfer.files, targetFolderId);
                }
                return;
            }
            const data = JSON.parse(dataStr);
            if (data && data.id && data.type) {
                if (data.type === 'folder' && parseInt(data.id) === targetFolderId) return;
                // Avoid dropping to its direct parent if it's already there
                const isAlreadyInTarget = breadcrumb.length > 0
                    ? breadcrumb[breadcrumb.length - 1].id === targetFolderId
                    : targetFolderId === null;
                if (!isAlreadyInTarget) {
                    handleMoveItem(data.id.toString(), data.type, targetFolderId);
                }
            }
        } catch (err) {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesUpload(e.dataTransfer.files, targetFolderId);
            }
        }
    };

    const handleDragOverFolder = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnterFolder = (e: React.DragEvent) => {
        e.preventDefault();
        // Highlight if dragging an item or external files
        if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('Files')) {
            e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-900/40', 'ring-2', 'ring-[#007b83]');
        }
    };

    const handleDragLeaveFolder = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/40', 'ring-2', 'ring-[#007b83]');
    };

    // Opens a Collabora Online editor tab for a given file.
    // The Editor page (/editor/:id) will fetch the WOPI token and Collabora URL itself.
    const openDocEditor = (file: any) => {
        window.open(`/editor/${file.id}`, '_blank');
    };

    const handlePreview = async (f: any) => {
        if (isDocFile(f)) {
            openDocEditor(f);
            return;
        }

        setPreviewFile(f);
        setPreviewUrl(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/drive/file/${f.id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob',
            });
            let blobMimeType = res.data.type;
            if (isImageFile(f) && blobMimeType === 'application/octet-stream') blobMimeType = 'image/jpeg';
            else if (isPdfFile(f) && blobMimeType === 'application/octet-stream') blobMimeType = 'application/pdf';
            else if (isVideoFile(f) && blobMimeType === 'application/octet-stream') blobMimeType = 'video/mp4';
            else if (isTextFile(f)) blobMimeType = 'text/plain'; // Force text/plain to render easily in iframe

            const blob = new Blob([res.data], { type: blobMimeType });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (error) {
            console.error("Failed to load preview", error);
            alert("Failed to load preview.");
            setPreviewFile(null);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const folderParam = params.get('folder');
        const fileParam = params.get('file');

        if (folderParam) {
            const folderId = parseInt(folderParam);
            if (!isNaN(folderId)) {
                setCurrentFolderId(folderId);
                setCurrentView('drive');
            }
        } else if (fileParam) {
            const fileId = parseInt(fileParam);
            if (!isNaN(fileId)) {
                const token = localStorage.getItem('token');
                if (token) {
                    axios.get(`/api/drive/file/${fileId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(resp => {
                        const file = resp.data;
                        if (file) {
                            if (isDocFile(file)) {
                                openDocEditor(file);
                            } else {
                                handlePreview(file);
                            }
                        }
                    }).catch(err => {
                        console.error("Gagal memuat file dari link share", err);
                    });
                }
            }
        }
    }, []);

    const handleCreateDoc = (type: string) => {
        setShowNewMenu(false);
        const defaultName = type === 'docx' ? 'Dokumen Baru' : type === 'xlsx' ? 'Spreadsheet Baru' : 'Presentasi Baru';
        setNewDocModal({ visible: true, type, name: defaultName });
    };

    const handleConfirmCreateDoc = async () => {
        const { type, name } = newDocModal;
        if (!name.trim()) return;
        setNewDocModal(prev => ({ ...prev, visible: false }));

        const newTab = window.open('about:blank', '_blank');
        try {
            const token = localStorage.getItem('token');
            // 1. Create the file
            const createResp = await axios.post('/api/drive/doc/create', {
                name: name.trim(),
                type,
                folder_id: currentFolderId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            const newFileId = createResp.data?.id;
            if (!newFileId) { if (newTab) newTab.close(); return; }

            // 2. Open editor page — Editor.tsx will fetch Collabora URL itself
            if (newTab) {
                newTab.location.href = `/editor/${newFileId}`;
            }
        } catch (error) {
            console.error("Failed to create document", error);
            if (newTab) newTab.close();
            alert("Gagal membuat dokumen");
        }
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewFile(null);
    };

    const handleEmptyTrash = async () => {
        if (!confirm("Are you sure you want to permanently delete all items in trash?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete('/api/drive/trash/empty', {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            console.error("Failed to empty trash", error);
            alert("Failed to empty trash");
        }
    };

    const renderTextWithBold = (txt: string) => {
        if (!txt) return "";
        const parts = txt.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-bold text-slate-905 dark:text-white">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const renderMarkdown = (text: string) => {
        if (!text) return null;
        
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let inTable = false;
        let tableRows: string[][] = [];
        
        const flushTable = (key: number) => {
            if (tableRows.length === 0) return null;
            const cleanRows = tableRows.filter(row => !row.every(cell => cell.trim().startsWith('---') || cell.trim() === ''));
            if (cleanRows.length === 0) {
                tableRows = [];
                inTable = false;
                return null;
            }
            
            const headers = cleanRows[0];
            const body = cleanRows.slice(1);
            
            tableRows = [];
            inTable = false;
            
            return (
                <div key={`table-${key}`} className="my-4 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm bg-white dark:bg-slate-900/40">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                         <thead>
                             <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                 {headers.map((h, i) => (
                                     <th key={i} className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{h.trim()}</th>
                                 ))}
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {body.map((row, ri) => (
                                 <tr key={ri} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                     {row.map((cell, ci) => (
                                         <td key={ci} className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{renderTextWithBold(cell)}</td>
                                     ))}
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                </div>
            );
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('|')) {
                inTable = true;
                const cells = line.split('|').slice(1, -1);
                tableRows.push(cells);
            } else {
                if (inTable) {
                    const tableObj = flushTable(i);
                    if (tableObj) elements.push(tableObj);
                }
                
                if (line.trim().startsWith('#')) {
                    const level = line.match(/^#+/)?.[0].length || 1;
                    const cleanText = line.replace(/^#+\s*/, '');
                    if (level === 1) elements.push(<h1 key={i} className="text-xl font-extrabold text-slate-900 dark:text-white mt-5 mb-2">{renderTextWithBold(cleanText)}</h1>);
                    else if (level === 2) elements.push(<h2 key={i} className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2">{renderTextWithBold(cleanText)}</h2>);
                    else elements.push(<h3 key={i} className="text-base font-semibold text-slate-900 dark:text-white mt-3 mb-1">{renderTextWithBold(cleanText)}</h3>);
                } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                    const cleanText = line.replace(/^[-*]\s+/, '');
                    elements.push(
                        <li key={i} className="ml-5 list-disc text-slate-700 dark:text-slate-300 my-1.5 leading-relaxed">
                            {renderTextWithBold(cleanText)}
                        </li>
                    );
                } else if (line.trim() === '') {
                    elements.push(<div key={i} className="h-2.5"></div>);
                } else {
                    elements.push(<p key={i} className="my-1.5 leading-relaxed text-slate-700 dark:text-slate-300">{renderTextWithBold(line)}</p>);
                }
            }
        }
        
        if (inTable) {
            const tableObj = flushTable(lines.length);
            if (tableObj) elements.push(tableObj);
        }
        
        return elements;
    };

    const [savingAnalysis, setSavingAnalysis] = useState(false);

    const handleSaveAnalysis = async () => {
        if (!aiModal.folder || !aiModal.analysis) return;
        setSavingAnalysis(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/drive/folder/${aiModal.folder.id}/save-ai-analysis`, {
                analysis: aiModal.analysis
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Hasil analisis berhasil disimpan sebagai file Markdown (.md) di dalam folder ini!");
            fetchDriveData();
            setAiModal(prev => ({ ...prev, visible: false }));
        } catch (error) {
            console.error("Gagal menyimpan analisis:", error);
            alert("Gagal menyimpan hasil analisis ke Drive.");
        } finally {
            setSavingAnalysis(false);
        }
    };

    const handleAnalyzeFolder = async (folder: any) => {
        setContextMenu({ ...contextMenu, visible: false });
        setAiModal({
            visible: true,
            folder,
            analysis: '',
            loading: true,
            error: ''
        });

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`/api/drive/folder/${folder.id}/analyze-ai`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAiModal(prev => ({
                ...prev,
                loading: false,
                analysis: response.data.analysis || 'Gagal menghasilkan analisis.'
            }));
        } catch (err: any) {
            setAiModal(prev => ({
                ...prev,
                loading: false,
                error: err.response?.data?.error || 'Terjadi kesalahan saat memanggil server BaknusAI. Pastikan server Ollama aktif.'
            }));
        }
    };

    const handleRenameMenu = () => {
        if (!contextMenu.item || !contextMenu.type) return;
        setTempRenameName(contextMenu.item.name);
        setRenameModal({ visible: true, item: contextMenu.item, type: contextMenu.type as 'file' | 'folder' });
        setContextMenu({ ...contextMenu, visible: false });
    };

    const submitRename = async () => {
        if (!renameModal.item || !renameModal.type || !tempRenameName.trim()) return;
        if (tempRenameName === renameModal.item.name) {
            setRenameModal({ visible: false, item: null, type: null });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const endpoint = `/api/drive/${renameModal.type}/${renameModal.item.id}/rename`;
            await axios.put(endpoint, { name: tempRenameName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            setRenameModal({ visible: false, item: null, type: null });
        } catch (error) {
            console.error("Failed to rename", error);
            alert("Failed to rename");
        }
    };

    const handleShareMenu = () => {
        if (!contextMenu.item || !contextMenu.type) return;
        const item = contextMenu.item;
        const type = contextMenu.type as 'file' | 'folder';
        setShareModal({ visible: true, item, type });
        setIsBlindDrop(false);
        setCanEdit(true);
        setCanDownload(true);
        setContextMenu({ ...contextMenu, visible: false });
        // Load existing shares for this item
        fetchItemShares(item.id, type);
    };

    const handleShowAccessDetails = async () => {
        if (!contextMenu.item) return;
        const folder = contextMenu.item;
        setAccessDetailsModal({
            visible: true,
            folder: folder,
            shares: [],
            loading: true
        });
        setContextMenu({ ...contextMenu, visible: false });

        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get(`/api/drive/shares`, {
                params: { id: folder.id, type: 'folder' },
                headers: { Authorization: `Bearer ${token}` }
            });
            setAccessDetailsModal(prev => ({
                ...prev,
                shares: resp.data.shares || [],
                loading: false
            }));
        } catch (error) {
            console.error("Gagal mengambil data share folder", error);
            setAccessDetailsModal(prev => ({
                ...prev,
                shares: [],
                loading: false
            }));
        }
    };

    const fetchItemShares = async (itemId: number, itemType: string) => {
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get(`/api/drive/shares`, {
                params: { id: itemId, type: itemType },
                headers: { Authorization: `Bearer ${token}` }
            });
            setItemShares(resp.data.shares || []);
        } catch {
            setItemShares([]);
        }
    };

    const handleUnshare = async (shareId: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/drive/share/${shareId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Refresh the shares list
            if (shareModal.item && shareModal.type) {
                fetchItemShares(shareModal.item.id, shareModal.type);
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Gagal menghapus share');
        }
    };

    const submitShare = async (target: string) => {
        if (!shareModal.item || !shareModal.type) return;
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.post(`/api/drive/share`, {
                id: shareModal.item.id,
                type: shareModal.type,
                shared_with: target,
                is_blind_drop: isBlindDrop,
                can_edit: canEdit,
                can_download: canDownload
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resp.data.message !== 'Already shared') {
                // Refresh shares list after successful share
                fetchItemShares(shareModal.item.id, shareModal.type);
            } else {
                alert('Sudah dibagikan sebelumnya.');
            }
        } catch (error: any) {
            console.error("Failed to share", error);
            alert(error.response?.data?.error || "Failed to share item");
        }
    };

    const handleToggleStar = async () => {
        if (!contextMenu.item || !contextMenu.type) return;
        try {
            const token = localStorage.getItem('token');
            const endpoint = `/api/drive/${contextMenu.type}/${contextMenu.item.id}/star`;
            await axios.put(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            setContextMenu({ ...contextMenu, visible: false });
        } catch (error) {
            console.error("Failed to toggle star", error);
            alert("Failed to update starred status");
        }
    };

    const handleTogglePublic = async () => {
        if (!contextMenu.item || !contextMenu.type) return;

        if (!contextMenu.item.is_public) {
            setPublicLinkModal({
                visible: true,
                item: contextMenu.item,
                type: contextMenu.type as 'file' | 'folder',
                password: '',
                expiration: ''
            });
            setContextMenu({ ...contextMenu, visible: false });
        } else {
            // It is public, so turn it off
            try {
                const token = localStorage.getItem('token');
                const endpoint = `/api/drive/${contextMenu.type}/${contextMenu.item.id}/public`;
                await axios.put(endpoint, {
                    is_public: false
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                alert("Public link access has been turned off.");
                fetchDriveData();
                setContextMenu({ ...contextMenu, visible: false });
            } catch (error) {
                console.error("Failed to toggle public status", error);
                alert("Failed to update public status");
            }
        }
    };

    const handleConfirmPublicLink = async () => {
        if (!publicLinkModal.item || !publicLinkModal.type) return;
        try {
            const token = localStorage.getItem('token');
            const endpoint = `/api/drive/${publicLinkModal.type}/${publicLinkModal.item.id}/public`;
            await axios.put(endpoint, {
                is_public: true,
                public_password: publicLinkModal.password || null,
                public_expiration: publicLinkModal.expiration ? new Date(publicLinkModal.expiration).toISOString() : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const link = `${window.location.origin}/public/${publicLinkModal.type}/${publicLinkModal.item.id}`;
            navigator.clipboard.writeText(link);
            alert("Link status changed to Public. The download link has been copied to your clipboard!");

            fetchDriveData();
            setPublicLinkModal({ ...publicLinkModal, visible: false });
        } catch (error) {
            console.error("Failed to turn on public link", error);
            alert("Failed to update public status");
        }
    };

    const navigateToFolder = (id: number, name: string) => {
        setCurrentFolderId(id);
        setBreadcrumb([...breadcrumb, { id, name }]);
    };
    // const navigateToDevice = (device: any) => {
    //     setSelectedDevice(device);
    //     setCurrentFolderId(null);
    //     setBreadcrumb([{ id: null, name: 'Computers' }, { id: 'device', name: device.name }]);
    // };

    const navigateToBreadcrumb = (index: number) => {
        if (index === breadcrumb.length - 1) return;
        const target = breadcrumb[index];

        if (target.name === 'Computers' && target.id === null) {
            setSelectedDevice(null);
            setCurrentFolderId(null);
        } else if (target.id === 'device') {
            setCurrentFolderId(null);
        } else {
            setCurrentFolderId(target.id as number | null);
        }

        setBreadcrumb(breadcrumb.slice(0, index + 1));
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const navItems = [
        { id: 'home', icon: LayoutGrid, label: 'Home' },
        { id: 'drive', icon: HardDrive, label: 'My Drive' },
        { id: 'computers', icon: MonitorSmartphone, label: 'Computers' },
        { id: 'shared', icon: Users, label: 'Shared with me' },
        { id: 'recent', icon: Clock, label: 'Recent' },
        { id: 'starred', icon: Star, label: 'Starred' },
        { id: 'forms', icon: ClipboardList, label: 'Baknus Form' },
        { id: 'my-shares', icon: Share2, label: 'Dibagikan Saya' },
        { id: 'trash', icon: Trash2, label: 'Trash' },
        ...((user?.role?.toLowerCase() === 'admin') ? [{ id: 'admin', icon: Shield, label: 'Admin Panel' }] : [])
    ];

    const handleAdminUpdateUser = async (email: string, newQuota?: number, is_active?: boolean, newClass?: string) => {
        try {
            const token = localStorage.getItem('token');
            const data: any = {};
            if (newQuota !== undefined) data.quota = newQuota;
            if (is_active !== undefined) data.is_active = is_active;
            if (newClass !== undefined) data.class = newClass;

            await axios.put(`/api/admin/user/${email}`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message;
            alert(`Gagal update user: ${msg}\nPastikan anda menggunakan akun Admin dengan benar.`);
        }
    };

    const getFileIcon = (fileName: string, mimeType: string, size = 22, className?: string) => {
        const name = (fileName || '').toLowerCase();
        const mime = (mimeType || '').toLowerCase();

        // 1. Archive files (.zip, .rar, .7z, .tar, .gz, etc.)
        if (
            name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || 
            name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.bz2') || 
            name.endsWith('.xz') || mime === 'application/zip' || 
            mime === 'application/x-rar-compressed' || mime === 'application/x-7z-compressed' || 
            mime === 'application/x-tar'
        ) {
            return <FileArchive size={size} className={className || "text-amber-600"} />;
        }

        // 2. Audio files (.mp3, .wav, .ogg, .flac, .aac, .m4a, etc.)
        if (
            name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || 
            name.endsWith('.flac') || name.endsWith('.aac') || name.endsWith('.m4a') || 
            mime.startsWith('audio/')
        ) {
            return <FileAudio size={size} className={className || "text-cyan-500"} />;
        }

        // 3. Video files (.mp4, .mkv, .avi, .mov, .webm, etc.)
        if (
            name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi') || 
            name.endsWith('.mov') || name.endsWith('.webm') || name.endsWith('.wmv') || 
            name.endsWith('.flv') || mime.startsWith('video/')
        ) {
            return <FileVideo size={size} className={className || "text-purple-500"} />;
        }

        // 4. Code / Source files
        if (
            name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts') || name.endsWith('.tsx') ||
            name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.json') || name.endsWith('.py') ||
            name.endsWith('.go') || name.endsWith('.java') || name.endsWith('.cpp') || name.endsWith('.c') ||
            name.endsWith('.php') || name.endsWith('.sh') || name.endsWith('.yaml') || name.endsWith('.yml') ||
            name.endsWith('.xml') || name.endsWith('.sql') || name.endsWith('.md')
        ) {
            return <FileCode size={size} className={className || "text-indigo-500"} />;
        }

        // 5. Word / Text documents
        if (name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.txt') || name.endsWith('.rtf') || name.endsWith('.log')) {
            return <FileText size={size} className={className || "text-blue-600"} />;
        }

        // 6. Excel / Spreadsheets
        if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
            return <FileSpreadsheet size={size} className={className || "text-green-600"} />;
        }

        // 7. Powerpoint / Presentation
        if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
            return <Presentation size={size} className={className || "text-orange-500"} />;
        }

        // 8. PDF
        if (name.endsWith('.pdf') || mime === 'application/pdf') {
            return <FileText size={size} className={className || "text-red-500"} />;
        }

        // 9. Images
        if (
            name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || 
            name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp') || 
            name.endsWith('.svg') || name.endsWith('.ico') || mime.startsWith('image/')
        ) {
            return <ImageIcon size={size} className={className || "text-pink-500"} />;
        }

        // Default fallback
        return <FileIcon size={size} className={className || "text-slate-500"} />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDateID = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const shareLink = shareModal.item ? (shareModal.type === 'folder' ? window.location.origin + '/?folder=' + shareModal.item.id : (isDocFile(shareModal.item) ? window.location.origin + '/editor/' + shareModal.item.id : window.location.origin + '/?file=' + shareModal.item.id)) : '';

    return (
        <div className="flex h-screen w-full bg-[#f8fafd] dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans overflow-hidden transition-colors">
            {/* Mobile Sidebar Overlay */}
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-[#f8fafd] dark:bg-slate-900 w-[256px] transform transition-transform duration-300 ease-in-out ${showSidebar ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 md:flex flex-col pt-3 pb-4 border-r border-slate-200 dark:border-slate-800 md:border-none shadow-2xl md:shadow-none`}>
                <div className="flex items-center justify-between px-6 mb-6 gap-2 mt-2 md:mt-0">
                    <div className="flex items-center gap-2">
                        <img src={logo} alt="BaknusDrive logo" className="w-14 h-14 object-contain" />
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 mb-1 tracking-tight">BaknusDrive</span>
                    </div>
                    <button className="md:hidden p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setShowSidebar(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 mb-4 relative">
                    <button
                        onClick={() => setShowNewMenu(!showNewMenu)}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-2 border border-slate-200 dark:border-slate-700 rounded-[1.25rem] px-5 py-4 text-[17px] font-semibold tracking-wide w-36 dark:text-slate-200"
                    >
                        <Plus size={28} /> New
                    </button>

                    {/* New Menu Dropdown */}
                    {showNewMenu && (
                        <div className="absolute left-6 top-16 mt-2 w-72 bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-2xl py-3 z-[60]">
                            <button onClick={handleCreateFolder} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-base font-medium text-slate-800 dark:text-slate-200">
                                <FolderPlus size={22} className="text-slate-600 dark:text-slate-400" /> New folder
                            </button>
                            <button onClick={() => { setShowNewMenu(false); setShowFormBuilder(true); }} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-base font-medium text-slate-800 dark:text-slate-200">
                                <ClipboardList size={22} className="text-indigo-600 dark:text-indigo-400" /> New Baknus Form
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>
                            <button onClick={() => handleCreateDoc('docx')} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-base font-medium text-slate-800 dark:text-slate-200">
                                <FileText size={22} className="text-blue-600 dark:text-blue-400" /> Baknus Write (Doc)
                            </button>
                            <button onClick={() => handleCreateDoc('xlsx')} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-base font-medium text-slate-800 dark:text-slate-200">
                                <FileSpreadsheet size={22} className="text-green-600 dark:text-green-400" /> Baknus Calc (Sheet)
                            </button>
                            <button onClick={() => handleCreateDoc('pptx')} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-base font-medium text-slate-800 dark:text-slate-200">
                                <Presentation size={22} className="text-orange-600 dark:text-orange-400" /> Baknus Impress (Slide)
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col px-6 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200">
                                <div className="flex items-center gap-4 text-base font-medium">
                                    <Upload size={22} className="text-slate-600 dark:text-slate-400" /> File upload
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-9 mt-0.5">Maks 1 GB per file</span>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto pr-4 mt-2">
                    {navItems.map((item, idx) => {
                        const isActive = currentView === item.id || (currentView === 'drive' && item.id === 'drive');
                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    setCurrentView(item.id);
                                    if (item.id === 'drive') {
                                        setCurrentFolderId(null);
                                        setBreadcrumb([{ id: null, name: 'My Drive' }]);
                                    } else if (item.id === 'computers') {
                                        setCurrentFolderId(null);
                                        setSelectedDevice(null);
                                        setBreadcrumb([{ id: null, name: 'Computers' }]);
                                    } else if (item.id === 'trash') {
                                        setBreadcrumb([{ id: null, name: 'Trash' }]);
                                    } else if (item.id === 'shared') {
                                        setBreadcrumb([{ id: null, name: 'Shared with me' }]);
                                    } else if (item.id === 'forms') {
                                        setBreadcrumb([{ id: null, name: 'Baknus Form' }]);
                                    }
                                }}
                                className={`w-full flex items-center gap-4 px-6 py-2 rounded-r-full text-[14px] transition-colors ${isActive
                                    ? 'bg-[#c2e7ff] dark:bg-slate-800 text-[#001d35] dark:text-blue-400 font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                                    }`}
                            >
                                <item.icon size={20} className={isActive ? 'text-[#001d35] dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="px-6 mt-auto pb-4 pt-4">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 mb-2">
                        <Cloud size={20} />
                        <span className="text-sm font-medium">Storage</span>
                    </div>
                    {storageInfo && (
                        <>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-2 overflow-hidden">
                                <div className="bg-[#1a73e8] dark:bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.quota) * 100)}%` }}></div>
                            </div>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400">
                                {formatSize(storageInfo.used)} of {formatSize(storageInfo.quota)} used
                            </p>
                        </>
                    )}
                    <button className="mt-3 px-4 py-2 text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-center">
                        Get more storage
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-800 m-0 md:m-3 rounded-none md:rounded-[24px] overflow-hidden shadow-sm border-0 md:border border-slate-200 dark:border-slate-700 transition-colors">
                {/* Topbar */}
                <header className="h-[64px] flex items-center justify-between px-2 md:px-4 mt-2 border-b border-slate-100 dark:border-slate-700 md:border-none">
                    <button className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full mx-1" onClick={() => setShowSidebar(true)}>
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 max-w-[720px] ml-1 md:ml-4">
                        <div className="bg-[#edf2fc] dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm focus-within:bg-white dark:focus-within:bg-slate-700 focus-within:shadow-md transition-all rounded-full flex items-center px-2 py-3">
                            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 ml-1">
                                <Search size={22} className="text-slate-600 dark:text-slate-400" />
                            </button>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={currentView === 'forms' ? "Cari formulir digital..." : "Search in Drive"}
                                className="bg-transparent border-none outline-none w-full px-3 text-[16px] text-slate-700 dark:text-slate-200 placeholder:text-slate-600 dark:placeholder:text-slate-400"
                            />
                            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 mr-1">
                                <Filter size={20} className="text-slate-600 dark:text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 ml-2 md:ml-4">
                        <button onClick={toggleDarkMode} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full relative"
                            >
                                <Bell size={24} />
                                {notifications.filter(n => !n.isRead).length > 0 && (
                                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-800">
                                        {notifications.filter(n => !n.isRead).length}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-[320px] md:w-[380px] bg-white dark:bg-slate-800 shadow-xl rounded-[20px] p-2 z-50 border border-slate-100 dark:border-slate-700 flex flex-col max-h-[400px]">
                                    <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notifikasi</h3>
                                        {notifications.some(n => !n.isRead) && (
                                            <button onClick={markAllNotificationsRead} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">Tandai semua dibaca</button>
                                        )}
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1">
                                        {notifications.length === 0 ? (
                                            <div className="py-8 text-center text-slate-500 dark:text-slate-400">Belum ada notifikasi.</div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => !n.isRead && markNotificationRead(n.id)}
                                                    className={`p-3 rounded-xl cursor-pointer transition-colors ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`font-semibold text-[14px] ${!n.isRead ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>{n.title}</span>
                                                        <span className="text-[11px] text-slate-400 whitespace-nowrap ml-2">{new Date(n.createdAt).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                    <p className={`text-[13px] leading-relaxed ${!n.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{n.message}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowHelpModal(true)}
                            className="hidden md:block p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                        >
                            <HelpCircle size={24} />
                        </button>
                        <button
                            onClick={() => {
                                fetchUserProfile();
                                setShowSettingsModal(true);
                            }}
                            className="hidden md:block p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                        >
                            <Settings size={24} />
                        </button>
                        <button className="hidden md:block p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full mr-2"><Grip size={24} /></button>

                        <div className="relative border-4 border-[#f8fafd] dark:border-slate-900 rounded-full">
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="w-[36px] h-[36px] bg-[#1a73e8] text-white rounded-full flex items-center justify-center font-medium shadow-sm ring-2 ring-white hover:ring-slate-200 transition-all text-sm overflow-hidden"
                            >
                                {user?.email ? (
                                    <img
                                        src={`https://baknusmail.smkbn666.sch.id/api/public/avatar/${user.email}`}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).parentElement!.innerText = user?.full_name?.charAt(0)?.toUpperCase() || 'B';
                                        }}
                                    />
                                ) : (
                                    user?.full_name?.charAt(0)?.toUpperCase() || 'B'
                                )}
                            </button>

                            {showProfileMenu && (
                                <div className="absolute right-0 top-12 w-[350px] bg-[#e9eef6] dark:bg-slate-800 shadow-xl rounded-[24px] p-2 z-50 border border-white/20">
                                    <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 flex flex-col items-center">
                                        <h3 className="text-sm font-medium mb-4 text-slate-500 dark:text-slate-400">{user?.email || 'user@baktinusantara666.sch.id'}</h3>
                                        <div className="w-20 h-20 bg-[#1a73e8] text-white rounded-full flex items-center justify-center text-3xl font-bold mb-3 shadow-lg overflow-hidden border-2 border-slate-100 dark:border-slate-700">
                                            {user?.email ? (
                                                <img
                                                    src={`https://baknusmail.smkbn666.sch.id/api/public/avatar/${user.email}`}
                                                    alt="Avatar"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).parentElement!.innerText = user?.full_name?.charAt(0)?.toUpperCase() || 'B';
                                                    }}
                                                />
                                            ) : (
                                                user?.full_name?.charAt(0)?.toUpperCase() || 'B'
                                            )}
                                        </div>
                                        <span className="text-[22px] font-semibold text-slate-800 dark:text-white tracking-tight">Hai, {user?.full_name?.split(' ')[0] || 'Tamu'}!</span>

                                        <div className="flex flex-col items-center gap-2 mt-3">
                                            <span className="text-[14px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded-full text-slate-700 dark:text-slate-300 font-medium">
                                                Status: {user?.role || 'Siswa'}
                                            </span>
                                            {user?.whatsapp && (
                                                <a
                                                    href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 font-medium"
                                                >
                                                    WhatsApp: {user.whatsapp}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2 flex gap-2">
                                        <button onClick={handleLogout} className="w-full py-3.5 bg-white hover:bg-slate-50 text-[#1f1f1f] rounded-[16px] flex items-center gap-2 justify-center text-sm font-medium transition-colors">
                                            <LogOut size={18} className="text-slate-500" /> Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Subheader / Breadcrumbs */}
                <div className="px-5 py-2 flex items-center justify-between">
                    <div className="flex items-center text-sm md:text-[15px] text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                        {breadcrumb.map((crumb: any, idx: number) => (
                            <React.Fragment key={idx}>
                                <button
                                    onClick={() => navigateToBreadcrumb(idx)}
                                    className="hover:text-indigo-600 hover:underline transition-all"
                                >
                                    {crumb.name === 'My Drive' ? 'Beranda' : crumb.name}
                                </button>
                                {idx < breadcrumb.length - 1 && <ChevronRight size={16} className="mx-1.5 opacity-50" />}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                        {(folders.length + files.length) > 0 && (
                            <button onClick={handleSelectAll} className="text-sm font-medium px-4 py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors mr-1">
                                {selectedItems.length === (folders.length + files.length) ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        {currentView === 'trash' && (
                            <button onClick={handleEmptyTrash} className="text-sm font-medium px-4 py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors mr-2">
                                Empty Trash
                            </button>
                        )}
                        <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} className="bg-[#c2e7ff] dark:bg-slate-700 text-[#001d35] dark:text-blue-400 p-2 rounded-full transition-colors hover:bg-blue-200 dark:hover:bg-slate-600">
                            {viewMode === 'list' ? <Grid size={20} /> : <List size={20} />}
                        </button>
                        <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><AlertCircle size={20} /></button>
                    </div>
                </div>

                {!(currentView === 'computers' && !selectedDevice && !currentFolderId) && (
                    <div className="px-5 py-2 flex items-center gap-2 border-b border-white dark:border-slate-800 pb-3 h-[52px]">
                        {currentView === 'forms' ? (
                            <>
                                <button
                                    onClick={() => setFormStatusFilter("Semua")}
                                    className={`flex items-center gap-1.5 border rounded-lg px-3 py-1 text-[14px] font-medium transition-all ${formStatusFilter === 'Semua' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    Semua
                                </button>
                                <button
                                    onClick={() => setFormStatusFilter("Aktif")}
                                    className={`flex items-center gap-1.5 border rounded-lg px-3 py-1 text-[14px] font-medium transition-all ${formStatusFilter === 'Aktif' ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    Aktif
                                </button>
                                <button
                                    onClick={() => setFormStatusFilter("Draft")}
                                    className={`flex items-center gap-1.5 border rounded-lg px-3 py-1 text-[14px] font-medium transition-all ${formStatusFilter === 'Draft' ? 'bg-slate-600 border-slate-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    Draft
                                </button>
                            </>
                        ) : currentView !== 'admin' ? (
                            <>
                                <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Tipe</button>
                                <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Orang</button>
                                <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Dimodifikasi</button>
                            </>
                        ) : null}
                    </div>
                )}

                {/* File List Header */}
                {(viewMode === 'list' && currentView !== 'admin' && currentView !== 'forms' && !(currentView === 'computers' && !selectedDevice && !currentFolderId)) && (
                    <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-4 text-[13px] font-semibold text-slate-600 dark:text-slate-400 sticky top-0 bg-white dark:bg-slate-800 z-20 items-center">
                        <div className="col-span-12 md:col-span-6 flex items-center gap-4">
                            {(folders.length + files.length) > 0 && (
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all"
                                    checked={selectedItems.length === (folders.length + files.length) && selectedItems.length > 0}
                                    ref={el => { if (el) el.indeterminate = selectedItems.length > 0 && selectedItems.length < (folders.length + files.length); }}
                                    onChange={handleSelectAll}
                                />
                            )}
                            Nama
                        </div>
                        <div className="col-span-2 hidden md:flex items-center">Pemilik</div>
                        <div className="col-span-2 hidden md:block">Dimodifikasi</div>
                        <div className="col-span-2 hidden md:block">Ukuran file</div>
                    </div>
                )}

                {/* File List Content */}
                <div
                    className="flex-1 overflow-y-auto w-full relative"
                    onContextMenu={handleBackgroundContextMenu}
                    onDragEnter={handleBaseDragEnter}
                    onDragOver={handleBaseDragOver}
                    onDragLeave={handleBaseDragLeave}
                    onDrop={handleBaseDrop}
                >
                    {isDraggingOverBase && (
                        <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-[2px] border-[3px] border-dashed border-blue-400 rounded-xl m-2 flex items-center justify-center pointer-events-none transition-all">
                            <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center pointer-events-none transform scale-105">
                                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-800">
                                    <Upload size={40} className="text-blue-500 animate-bounce" />
                                </div>
                                <h3 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white mb-2">Lepaskan file di sini</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium">Lepaskan untuk mengunggah file ke folder ini secara instan</p>
                                <p className="text-blue-500 dark:text-blue-400 font-semibold text-sm mt-2">Maksimal 1 GB per upload</p>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <Loader2 size={32} className="animate-spin text-baknus-500" />
                        </div>
                    )}

                    {currentView === 'my-shares' ? (
                        <div className="p-6 max-w-5xl mx-auto">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-2xl text-green-600 dark:text-green-400">
                                    <Share2 size={26} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Dibagikan Saya</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Semua file dan folder yang Anda bagikan kepada orang lain</p>
                                </div>
                            </div>

                            {mySharesList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-400 dark:text-slate-600">
                                    <Share2 size={64} className="mb-4 opacity-30" />
                                    <p className="text-lg font-semibold">Belum ada file yang Anda bagikan</p>
                                    <p className="text-sm mt-1">Klik kanan file atau folder untuk mulai berbagi</p>
                                </div>
                            ) : (() => {
                                // Group shares by item
                                const grouped: Record<string, { itemType: string, itemName: string, itemId: any, shares: any[] }> = {};
                                mySharesList.forEach((s: any) => {
                                    const key = `${s.item_type}-${s.item_id}`;
                                    if (!grouped[key]) {
                                        grouped[key] = { itemType: s.item_type, itemName: s.item_name, itemId: s.item_id, shares: [] };
                                    }
                                    grouped[key].shares.push(s);
                                });

                                return (
                                    <div className="space-y-4">
                                        {Object.values(grouped).map((group, gi) => (
                                            <div key={gi} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                                                {/* Item header */}
                                                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                                                    <div className={`p-2.5 rounded-xl ${group.itemType === 'folder' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                                                        {group.itemType === 'folder' ? <FolderIcon size={20} /> : getFileIcon(group.itemName, '', 20)}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[15px]">{group.itemName}</span>
                                                        <span className="ml-2 text-xs text-slate-400 font-medium">{group.itemType === 'folder' ? 'Folder' : 'File'}</span>
                                                    </div>
                                                    <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                                                        {group.shares.length} penerima
                                                    </span>
                                                </div>

                                                {/* Share entries */}
                                                <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                    {group.shares.map((s: any) => {
                                                        let label = s.shared_with;
                                                        let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                                                        let icon = '👤';
                                                        if (s.shared_with?.startsWith('ROLE:')) {
                                                            label = 'Semua ' + s.shared_with.replace('ROLE:', '');
                                                            badgeColor = 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800';
                                                            icon = '👥';
                                                        } else if (s.shared_with?.startsWith('CLASS:')) {
                                                            label = 'Kelas ' + s.shared_with.replace('CLASS:', '');
                                                            badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
                                                            icon = '🏫';
                                                        }
                                                        return (
                                                            <div key={s.share_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${badgeColor}`}>
                                                                        <span>{icon}</span> {label}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">
                                                                        {formatDateID(s.created_at)}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!confirm(`Hentikan sharing ke "${label}"?`)) return;
                                                                        try {
                                                                            const token = localStorage.getItem('token');
                                                                            await axios.delete(`/api/drive/share/${s.share_id}`, { headers: { Authorization: `Bearer ${token}` } });
                                                                            setMySharesList(prev => prev.filter((x: any) => x.share_id !== s.share_id));
                                                                        } catch {
                                                                            alert('Gagal menghapus share');
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                    Hentikan
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : currentView === 'admin' ? (
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield className="text-blue-500" /> Admin Dashboard (User Management)</h2>

                            {/* Panel Guru/TU Khusus */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                                    <Sparkles className="text-blue-500 animate-pulse" size={20} /> Pengaturan Guru/TU Spesial (AI & Share Khas)
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Pilih maksimal 2 orang Guru atau TU yang diberikan izin khusus untuk membuat folder sharing berwarna biru (ikon Shield) dan menggunakan fitur Analisis Folder AI.
                                </p>
                                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                                    <div className="flex-1 min-w-[280px]">
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                            Pilih Guru / TU (Tahan Ctrl/Cmd untuk memilih 2 orang)
                                        </label>
                                        <select
                                            multiple
                                            value={specialAllowed.map(u => u.email)}
                                            onChange={async (e) => {
                                                const selectedEmails = Array.from(e.target.selectedOptions, option => option.value);
                                                if (selectedEmails.length > 2) {
                                                    alert("Maksimal hanya boleh memilih 2 orang Guru/TU!");
                                                    return;
                                                }
                                                const token = localStorage.getItem('token');
                                                try {
                                                    await axios.post('/api/admin/special-share-users', { emails: selectedEmails }, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    // Refresh lists
                                                    const specialResp = await axios.get('/api/admin/special-share-users', {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    setSpecialAllowed(specialResp.data.allowed || []);
                                                } catch (err: any) {
                                                    alert("Gagal memperbarui izin khusus: " + (err.response?.data?.error || err.message));
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                        >
                                            {specialCandidates.map(c => (
                                                <option key={c.email} value={c.email}>
                                                    {c.full_name} ({c.email} - Role: {c.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1 min-w-[280px] bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-wider">Guru/TU Terpilih Saat Ini:</span>
                                        {specialAllowed.length === 0 ? (
                                            <span className="text-sm text-slate-400 italic">Belum ada yang dipilih.</span>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {specialAllowed.map(u => (
                                                    <div key={u.email} className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-800/50">
                                                        <span className="flex items-center gap-1.5">
                                                            <Shield size={14} className="fill-blue-200 text-blue-600 dark:fill-blue-800 dark:text-blue-300" />
                                                            {u.full_name} ({u.email})
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-[10px] font-bold rounded-md uppercase">
                                                            {u.role}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Search and Filter */}
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Cari nama atau email pengguna..."
                                        value={searchUser}
                                        onChange={(e) => { setSearchUser(e.target.value); setAdminCurrentPage(1); }}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => { setRoleFilter(e.target.value); setAdminCurrentPage(1); }}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
                                >
                                    <option value="Semua">Semua Role</option>
                                    <option value="Siswa">Siswa</option>
                                    <option value="Guru">Guru</option>
                                    <option value="TU">TU</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>

                            <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-left text-[15px] whitespace-nowrap">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="px-6 py-5 font-semibold">Pengguna</th>
                                            <th className="px-6 py-5 font-semibold">Role</th>
                                            <th className="px-6 py-5 font-semibold">Kelas</th>
                                    <th className="px-6 py-5 font-semibold">Penyimpanan</th>
                                            <th className="px-6 py-5 font-semibold">Status</th>
                                            <th className="px-6 py-5 font-semibold text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(() => {
                                            const filteredUsers = usersList
                                                .filter(u => roleFilter === 'Semua' || u.role === roleFilter)
                                                .filter(u => {
                                                    const search = searchUser.toLowerCase();
                                                    return (u.full_name || '').toLowerCase().includes(search) ||
                                                        (u.email || '').toLowerCase().includes(search);
                                                });
                                            const totalPages = Math.ceil(filteredUsers.length / adminItemsPerPage) || 1;
                                            const paginatedUsers = filteredUsers.slice((adminCurrentPage - 1) * adminItemsPerPage, adminCurrentPage * adminItemsPerPage);

                                            return (
                                                <>
                                                    {paginatedUsers.map((u) => (
                                                        <tr key={u.id || u.email || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-6 py-5">
                                                                <div className="flex flex-col animate-in fade-in slide-in-from-left duration-250">
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{u.full_name || u.email}</span>
                                                                    <span className="text-[15px] text-slate-500">{u.email}</span>
                                                                    {(u.own_drive_count > 0 || u.shared_drive_count > 0) && (
                                                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                                            {u.own_drive_count > 0 && (
                                                                                <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-450 rounded-md font-semibold border border-green-200 dark:border-green-800/30">
                                                                                    Drive Sendiri: {u.own_drive_count} file ({formatSize(u.own_drive_size)})
                                                                                </span>
                                                                            )}
                                                                            {u.shared_drive_count > 0 && (
                                                                                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-md font-semibold border border-indigo-200 dark:border-indigo-800/30">
                                                                                    Shared: {u.shared_drive_count} file ({formatSize(u.shared_drive_size)})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                    {u.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-5 text-slate-700 dark:text-slate-300 text-base font-bold">
                                                                {u.class || '-'}
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2 w-48">
                                                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((u.used_space || 0) / (u.quota || 1)) * 100)}%` }}></div>
                                                                </div>
                                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{formatSize(u.used_space || 0)} / {formatSize(u.quota)}</span>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                {u.is_active ? (
                                                                    <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 font-bold text-[15px]">
                                                                        <Check size={16} /> Aktif
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-[15px]">
                                                                        <Lock size={16} /> Nonaktif
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-5 text-right flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => {
                                                                        setAdminTargetUser(u.id || u.email);
                                                                        setCurrentView('admin-drive');
                                                                        setBreadcrumb([{ id: null, name: `Drive: ${u.full_name || u.email}` }]);
                                                                        setCurrentFolderId(null);
                                                                    }}
                                                                    className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm font-bold transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 flex items-center gap-1.5"
                                                                >
                                                                    <FolderIcon size={16} /> Lihat File
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        setUserActivityModal({ visible: true, user: u, activities: [], loading: true });
                                                                        setActivitySearchQuery('');
                                                                        setActivityCurrentPage(1);
                                                                        try {
                                                                            const token = localStorage.getItem('token');
                                                                            const resp = await axios.get(`/api/admin/users/${u.id || u.email}/activity`, {
                                                                                headers: { Authorization: `Bearer ${token}` }
                                                                            });
                                                                            setUserActivityModal({ visible: true, user: u, activities: resp.data.activity || [], loading: false });
                                                                        } catch (err) {
                                                                            console.error("Gagal mengambil aktivitas user:", err);
                                                                            alert("Gagal mengambil aktivitas user");
                                                                            setUserActivityModal(prev => ({ ...prev, loading: false }));
                                                                        }
                                                                    }}
                                                                    className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 flex items-center gap-1.5"
                                                                >
                                                                    <Clock size={16} /> Aktivitas
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setQuotaModal({ visible: true, user: u });
                                                                        setTempQuotaGB((u.quota / (1024 * 1024 * 1024)).toString());
                                                                        setTempClass(u.class || "");
                                                                    }}
                                                                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 flex items-center gap-1.5"
                                                                >
                                                                    <Database size={16} /> Edit User
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAdminUpdateUser(u.id || u.email, undefined, !u.is_active)}
                                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'}`}
                                                                >
                                                                    {u.is_active ? <UserX size={16} /> : <Unlock size={16} />} {u.is_active ? 'Matikan' : 'Aktifkan'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {totalPages > 1 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-slate-500">
                                                                        Menampilkan {((adminCurrentPage - 1) * adminItemsPerPage) + 1} hingga {Math.min(adminCurrentPage * adminItemsPerPage, filteredUsers.length)} dari {filteredUsers.length} entri
                                                                    </span>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            disabled={adminCurrentPage === 1}
                                                                            onClick={() => setAdminCurrentPage(p => Math.max(1, p - 1))}
                                                                            className="px-4 py-2 bg-slate-100 disabled:opacity-50 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700 transition"
                                                                        >
                                                                            Previous
                                                                        </button>
                                                                        <button
                                                                            disabled={adminCurrentPage === totalPages}
                                                                            onClick={() => setAdminCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                            className="px-4 py-2 bg-slate-100 disabled:opacity-50 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700 transition"
                                                                        >
                                                                            Next
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : currentView === 'forms' ? (
                        <div className="p-6 max-w-7xl mx-auto">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                            <ClipboardList size={28} />
                                        </div>
                                        Baknus Form
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Buat formulir digital, kumpulkan data, dan kelola respon dengan mudah.</p>
                                </div>
                                <button
                                    onClick={() => setShowFormBuilder(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-lg"
                                >
                                    <Plus size={24} /> Buat Formulir Baru
                                </button>
                            </div>

                            {myForms.length === 0 ? (
                                <div className="bg-white dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[32px] p-20 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-8">
                                        <ClipboardList size={48} className="text-indigo-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Belum Ada Formulir</h3>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-md mb-10 text-lg leading-relaxed">
                                        Mulai kumpulkan data dengan membuat formulir pertama Anda. Anda bisa membagikannya lewat link atau embed.
                                    </p>
                                    <button
                                        onClick={() => setShowFormBuilder(true)}
                                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-2 text-lg"
                                    >
                                        Pelajari cara membuat formulir <ExternalLink size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {myForms
                                        .filter(f => {
                                            const search = searchQuery.toLowerCase();
                                            const matchesSearch = (f.title || '').toLowerCase().includes(search) || (f.description || '').toLowerCase().includes(search);
                                            const matchesStatus = formStatusFilter === "Semua" || (formStatusFilter === "Aktif" && f.is_active) || (formStatusFilter === "Draft" && !f.is_active);
                                            return matchesSearch && matchesStatus;
                                        })
                                        .map((form: any) => (
                                            <div key={form.id} className="bg-white dark:bg-slate-800 rounded-[28px] border border-slate-100 dark:border-slate-700 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full">
                                                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-500">
                                                        <FileText size={24} />
                                                    </div>
                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${form.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-slate-100 text-slate-600'}`}>
                                                        {form.is_active ? 'AKTIF' : 'DRAFT'}
                                                    </span>
                                                </div>

                                                <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-2 leading-tight group-hover:text-indigo-600 transition-colors h-14 overflow-hidden">
                                                    {form.title}
                                                </h4>

                                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-2">
                                                    {form.description || 'Tidak ada deskripsi.'}
                                                </p>

                                                <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-700/50 grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tanggapan</span>
                                                        <span className="text-2xl font-black text-slate-800 dark:text-slate-200">{form.response_count || 0}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dibuat</span>
                                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                            {formatDateID(form.created_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-6 flex gap-2">
                                                    <button
                                                        onClick={() => openResponsesModal(form)}
                                                        className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Eye size={18} /> Lihat Respon
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/f/${form.id}`;
                                                            navigator.clipboard.writeText(url);
                                                            alert("Link formulir berhasil disalin ke clipboard!");
                                                        }}
                                                        className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                                                        title="Bagikan Link"
                                                    >
                                                        <Share2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditForm(form)}
                                                        className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-colors"
                                                        title="Edit Formulir"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteForm(form)}
                                                        className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                                                        title="Hapus Formulir"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {currentView === 'computers' && !selectedDevice && !currentFolderId && (
                                <div className="p-6 max-w-5xl mx-auto">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                                            <HardDrive size={26} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Akses File Lokal (WebDAV)</h2>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Jadikan BaknusDrive seperti Flashdisk/Hardisk eksternal di komputer Anda</p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl inline-block text-blue-700 dark:text-blue-400">
                                            Informasi Koneksi WebDAV
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">URL / Server Address</p>
                                                <div className="font-mono text-sm tracking-tight text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl flex justify-between items-center group">
                                                    <span>https://baknusdrive.smkbn666.sch.id/webdav</span>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText('https://baknusdrive.smkbn666.sch.id/webdav'); alert('URL WebDAV disalin!'); }}
                                                        className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                        title="Salin URL"
                                                    ><Copy size={16} /></button>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
                                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Username & Password</p>
                                                <p className="font-medium text-slate-800 dark:text-slate-200">Gunakan Email (NIP/NIS) dan Password Baknus Anda.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-10 mt-6">
                                            {/* Panduan Windows */}
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                                                    <svg className="w-7 h-7 text-[#00a4ef]" viewBox="0 0 87.6 87.6"><path fill="currentColor" d="M0 12.4l35.6-4.8v34H0zM39.6 6.8l48-6.6v37.4H39.6zM0 45.4h35.6v34L0 74.6zM39.6 45.4h48v37.4l-48-6.6z" /></svg>
                                                    Panduan Windows
                                                </h4>
                                                <ol className="list-decimal list-inside space-y-3.5 text-slate-600 dark:text-slate-300 ml-2">
                                                    <li>Buka <strong>File Explorer</strong> (tekan <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-bold font-mono">Win + E</code>).</li>
                                                    <li>Klik kanan pada <strong>"This PC"</strong> atau <strong>"Network"</strong> di panel sebelah kiri.</li>
                                                    <li>Pilih opsi <strong>"Map network drive..."</strong>.</li>
                                                    <li>Pilih huruf Drive yang diinginkan (misalnya <strong className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">Z:</strong>).</li>
                                                    <li>Pada kolom Folder, tempelkan URL: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-sm break-all">https://baknusdrive.smkbn666.sch.id/webdav</code></li>
                                                    <li>Centang kotak <strong>"Connect using different credentials"</strong> lalu klik <strong>Finish</strong>.</li>
                                                    <li>Masukkan <strong>Email</strong> dan <strong>Password</strong> Baknus Anda saat diminta.</li>
                                                    <li><span className="font-bold text-green-600 dark:text-green-400">Selesai!</span> Anda akan melihat BaknusDrive di dalam "This PC" seperti Hardisk biasa.</li>
                                                </ol>
                                            </div>

                                            {/* Panduan macOS */}
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                                                    <svg className="w-7 h-7 text-slate-800 dark:text-slate-200" viewBox="0 0 384 512"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                                                    Panduan Mac OS (Finder)
                                                </h4>
                                                <ol className="list-decimal list-inside space-y-3.5 text-slate-600 dark:text-slate-300 ml-2">
                                                    <li>Buka aplikasi <strong>Finder</strong> di Mac Anda.</li>
                                                    <li>Pada *menu bar* di bagian atas layar, klik <strong>"Go"</strong> ➡️ pilih <strong>"Connect to Server..."</strong>.</li>
                                                    <li>Atau bisa juga dengan menekan *shortcut* <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-xs font-bold text-slate-800 dark:text-slate-200">⌘ + K</code>.</li>
                                                    <li>Masukkan Server Address: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-sm break-all">https://baknusdrive.smkbn666.sch.id/webdav</code> lalu klik <strong>Connect</strong>.</li>
                                                    <li>Pilih tipe pengguna <strong>"Registered User"</strong> jika ditanya.</li>
                                                    <li>Masukkan <strong>Email</strong> dan <strong>Password</strong> Baknus Anda.</li>
                                                    <li><span className="font-bold text-green-600 dark:text-green-400">Selesai!</span> Drive akan otomatis *mounted* (terpasang) di Desktop atau di *sidebar* Finder Anda.</li>
                                                </ol>
                                            </div>

                                            {/* Panduan Linux / GNOME */}
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                                                    <svg className="w-7 h-7 text-slate-800 dark:text-slate-200" viewBox="0 0 448 512"><path fill="currentColor" d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.7-.7-3.9-1-5.5-.1-.4.2-.8.7-.6 1.1.3 1.3 2.3 1.1 3.4 1.7zm-21.9 1.7c1.2 0 2-1.2 3-1.7 1.1-.6 3.1-.4 3.5-1.7.2-.4-.2-.9-.6-1.1-1.6-.9-3.8-.6-5.5.1-1.3.6-3.4 1.5-3.2 2.9.1 1 1.8 1.5 2.8 1.5zM420 403.8c-3.6-4-5.3-11.6-7.2-19.7-1.8-8.1-3.9-16.8-10.5-22.4-1.3-1.1-2.6-2.1-4-2.9-1.3-.8-2.7-1.5-4.1-2 9.2-27.3 5.6-54.5-3.7-79.1-11.4-30.1-31.3-56.4-46.5-74.4-17.1-21.5-33.7-41.9-33.4-72C311.1 85.4 315.7.1 234.8 0 132.4-.2 158 103.4 156.9 135.2c-1.7 45.3-26.6 66.8-49 92.5-16.5 18.2-31.4 39.5-38.3 67-6.5 25.5-2.7 54.3 7 81.6-1.5.5-3 1.2-4.3 2.1-6.6 5.6-8.7 14.3-10.5 22.4-1.9 8.1-3.6 15.7-7.2 19.7-6.8 7.4-22.9 8.6-22.9 8.6-8.1 1.6-3 15.2 6.6 15.2h41.4c34.5 11 63 21 133 21 68 0 98.5-10 133-21h41.4c9.6 0 14.7-13.6 6.6-15.2 0 0-16.1-1.2-22.9-8.6zm-207.1 19.4c-35 0-63.5-28.5-63.5-63.5s28.5-63.5 63.5-63.5 63.5 28.5 63.5 63.5-28.5 63.5-63.5 63.5zm70.6-200.7c-2.4 20-25.2 3.1-40.2-12-14.7 14.8-37.4 32.2-40.2 12-1.7-12 11.2-14.5 12.6-18.7-25-11.6-21.4-42.5-21.4-42.5 7.4-20 28.6-14.5 30.5-11.8 16 16.5 21 16.5 37.1 0 1.9-2.7 23.1-8.2 30.5 11.8 0 0 3.6 30.9-21.4 42.5 1.5 4.3 14.3 6.7 12.6 18.7zm-27.1-41.4c-9.3-5-18.9-8.2-18.9-8.2s-9.6 3.2-18.9 8.2c-4 2.1-4.6 2.4-5.3.7-2-4.8 11.4-15 24.2-15 12.6 0 25.8 10 24.2 15-.7 1.7-1.3 1.4-5.3-.7z" /></svg>
                                                    Panduan Linux (GNOME / Ubuntu)
                                                </h4>
                                                <ol className="list-decimal list-inside space-y-3.5 text-slate-600 dark:text-slate-300 ml-2">
                                                    <li>Buka aplikasi <strong>Files (Nautilus)</strong>.</li>
                                                    <li>Pada *sidebar* kiri, cari dan klik opsi <strong>"Other Locations"</strong>.</li>
                                                    <li>Di bagian bawah pada kolom <strong>"Connect to Server"</strong>, ketikkan URL berikut:</li>
                                                    <li><code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-sm break-all">davs://baknusdrive.smkbn666.sch.id/webdav</code></li>
                                                    <li>Lalu tekan <strong>Connect</strong>.</li>
                                                    <li>Masukkan <strong>Email</strong> dan <strong>Password</strong> Baknus Anda saat dialog otentikasi muncul.</li>
                                                    <li><span className="font-bold text-green-600 dark:text-green-400">Selesai!</span> File Anda kini dapat diakses layaknya folder lokal biasa.</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!loading && currentView !== 'computers' && folders.length === 0 && files.length === 0 && (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <FolderIcon size={64} className="mb-4 text-slate-300" />
                                    <p>This folder is empty</p>
                                </div>
                            )}

                            {/* Folders */}
                            {folders.length > 0 && viewMode === 'grid' && <div className="px-5 pb-2 pt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Folders</div>}
                            <div className={viewMode === 'grid' ? "px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6" : "flex flex-col"}>
                                {folders.map(f => (
                                    viewMode === 'list' ? (
                                        <div
                                            key={`folder-${f.id}`}
                                            draggable
                                            onDragStart={(e: React.DragEvent) => handleDragStartItem(e, f.id, 'folder')}
                                            onDragEnd={handleDragEndItem}
                                            onDrop={(e: React.DragEvent) => handleDropOnFolder(e, f.id)}
                                            onDragOver={handleDragOverFolder}
                                            onDragEnter={handleDragEnterFolder}
                                            onDragLeave={handleDragLeaveFolder}
                                            onClick={(e) => {
                                                if (e.ctrlKey || e.metaKey || selectedItems.length > 0) {
                                                    e.stopPropagation();
                                                    toggleSelection(f, 'folder');
                                                } else {
                                                    if (window.innerWidth < 768) setShowSidebar(false);
                                                    navigateToFolder(f.id, f.name);
                                                }
                                            }}
                                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, f, 'folder')}
                                            title={f.contributors && f.contributors.length > 0 ? `Kontributor: ${f.contributors.join(', ')}` : undefined}
                                            className={`px-5 py-3 md:py-2 grid grid-cols-12 gap-4 items-center group cursor-pointer border-b border-slate-100 dark:border-slate-800 md:border-transparent last:border-none transition-colors selectable-item ${isSelected(f.id, 'folder') ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-[#f3fbfa] dark:hover:bg-slate-700/50'}`}
                                        >
                                            <div className="col-span-10 md:col-span-6 flex items-center gap-4">
                                                <div className="relative flex-shrink-0">
                                                    {isSelected(f.id, 'folder') ? (
                                                        <div className="w-5 h-5 rounded bg-[#1a73e8] flex items-center justify-center text-white"><Check size={14} /></div>
                                                    ) : (
                                                        <>
                                                            <FolderIcon
                                                                size={22}
                                                                fill={f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? "#3b82f6" : "#5f6368"}
                                                                className={f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? "text-blue-500 dark:text-blue-400 border-none" : "text-slate-500 dark:text-slate-400 border-none"}
                                                            />
                                                            {f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? (
                                                                <div className="absolute -bottom-1 -right-1 bg-blue-100 dark:bg-blue-900 rounded-full p-[2px] shadow-sm border border-blue-200 dark:border-blue-800">
                                                                    <Shield size={10} className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400" />
                                                                </div>
                                                            ) : f.is_shared && (
                                                                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm">
                                                                    <Users size={10} className="text-slate-600 dark:text-slate-400" />
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate flex items-center gap-2">
                                                        {f.name} {f.is_starred && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                                                    </span>
                                                    {f.contributors && f.contributors.length > 0 && (
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                                            Kontributor: {f.contributors.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-span-2 hidden md:flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-[#007b83] text-white flex flex-shrink-0 items-center justify-center text-[10px] font-bold">
                                                    {(f.owner_name || user?.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[14px] text-slate-600 dark:text-slate-400 font-medium group-hover:text-slate-800 dark:group-hover:text-slate-300 truncate">
                                                    {(!f.owner_name && (f.user_id === user?.email || !f.user_id)) ? 'me' : (f.owner_name || f.user_id)}
                                                </span>
                                            </div>
                                            <div className="col-span-2 hidden md:block text-[14px] text-slate-600 dark:text-slate-400 font-medium group-hover:text-slate-800 dark:group-hover:text-slate-300">
                                                {formatDateID(f.updated_at)}
                                            </div>
                                            <div className="col-span-2 md:col-span-2 flex items-center justify-end md:justify-between text-[14px] text-slate-600 dark:text-slate-400 font-medium">
                                                <span className="hidden md:inline">—</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {currentView === 'trash' ? (
                                                        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRestoreItem(f, 'folder'); }} className="p-2 hover:bg-slate-200 rounded-full text-green-500" title="Restore folder">
                                                            <RotateCcw size={18} />
                                                        </button>
                                                    ) : currentView !== 'shared' ? (
                                                        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteFolder(f); }} className="p-2 hover:bg-slate-200 rounded-full text-red-500" title="Delete folder">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={`folder-${f.id}`}
                                            draggable
                                            onDragStart={(e: React.DragEvent) => handleDragStartItem(e, f.id, 'folder')}
                                            onDragEnd={handleDragEndItem}
                                            onDrop={(e: React.DragEvent) => handleDropOnFolder(e, f.id)}
                                            onDragOver={handleDragOverFolder}
                                            onDragEnter={handleDragEnterFolder}
                                            onDragLeave={handleDragLeaveFolder}
                                            onClick={(e) => {
                                                if (e.ctrlKey || e.metaKey || selectedItems.length > 0) {
                                                    e.stopPropagation();
                                                    toggleSelection(f, 'folder');
                                                } else {
                                                    if (window.innerWidth < 768) setShowSidebar(false);
                                                    navigateToFolder(f.id, f.name);
                                                }
                                            }}
                                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, f, 'folder')}
                                            title={f.contributors && f.contributors.length > 0 ? `Kontributor: ${f.contributors.join(', ')}` : undefined}
                                            className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer group transition-colors selectable-item ${isSelected(f.id, 'folder') ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <div className="relative flex-shrink-0">
                                                {isSelected(f.id, 'folder') ? (
                                                    <div className="w-[24px] h-[24px] rounded bg-[#1a73e8] flex items-center justify-center text-white"><Check size={16} /></div>
                                                ) : (
                                                    <>
                                                        <FolderIcon
                                                            size={24}
                                                            fill={f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? "#3b82f6" : "#5f6368"}
                                                            className={f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? "text-blue-500 dark:text-blue-400 shadow-sm border-none" : "text-slate-500 dark:text-slate-400 shadow-sm border-none"}
                                                        />
                                                        {f.is_special && (f.is_shared || user?.role?.toLowerCase() !== 'admin') ? (
                                                            <div className="absolute -bottom-1 -right-1 bg-blue-100 dark:bg-blue-900 rounded-full p-[2px] shadow-sm border border-blue-200 dark:border-blue-800">
                                                                <Shield size={10} className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400" />
                                                            </div>
                                                        ) : f.is_shared && (
                                                            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm">
                                                                <Users size={10} className="text-slate-600 dark:text-slate-400" />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-2">
                                                    {f.name} {f.is_starred && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                                                </span>
                                                {f.contributors && f.contributors.length > 0 && (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                                        Kontributor: {f.contributors.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>

                            {/* Files */}
                            {files.length > 0 && viewMode === 'grid' && <div className="px-5 pb-2 mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Files</div>}
                            <div className={viewMode === 'grid' ? "px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6" : "flex flex-col"}>
                                {files.map(f => (
                                    viewMode === 'list' ? (
                                        <div
                                            key={`file-${f.id}`}
                                            draggable
                                            onDragStart={(e: React.DragEvent) => handleDragStartItem(e, f.id, 'file')}
                                            onDragEnd={handleDragEndItem}
                                            onDoubleClick={() => handlePreview(f)}
                                            onClick={(e) => {
                                                if (e.ctrlKey || e.metaKey || selectedItems.length > 0) {
                                                    e.stopPropagation();
                                                    toggleSelection(f, 'file');
                                                }
                                            }}
                                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, f, 'file')}
                                            className={`px-5 py-3 md:py-2 grid grid-cols-12 gap-4 items-center group cursor-pointer border-b border-slate-100 dark:border-slate-800 md:border-transparent last:border-none transition-colors selectable-item ${isSelected(f.id, 'file') ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-[#f3fbfa] dark:hover:bg-slate-700/50'}`}
                                        >
                                            <div className="col-span-10 md:col-span-6 flex items-center gap-4">
                                                <div className="relative flex-shrink-0">
                                                    {isSelected(f.id, 'file') ? (
                                                        <div className="w-6 h-6 rounded bg-[#1a73e8] flex items-center justify-center text-white"><Check size={16} /></div>
                                                    ) : (
                                                        <>
                                                            {getFileIcon(f.name, f.mime_type)}
                                                            {f.is_shared && (
                                                                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm z-10">
                                                                    <Users size={10} className="text-slate-600 dark:text-slate-400" />
                                                                </div>
                                                            )}
                                                            {f.is_public && (
                                                                <div className="absolute -bottom-1 -left-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm z-10" title="Public Link Active">
                                                                    <Link size={10} className="text-green-500 dark:text-green-400" />
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate flex items-center gap-2">
                                                        {f.name} {f.is_starred && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                                                    </span>
                                                    {/* Mobile only subtitle */}
                                                    <span className="text-[12px] text-slate-400 md:hidden mt-0.5 truncate">
                                                        {formatSize(f.size)} • {formatDateID(f.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="col-span-2 hidden md:flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-[#007b83] text-white flex flex-shrink-0 items-center justify-center text-[10px] font-bold">
                                                    {(f.owner_name || user?.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[14px] text-slate-600 dark:text-slate-400 font-medium group-hover:text-slate-800 dark:group-hover:text-slate-300 truncate">
                                                    {(!f.owner_name && (f.user_id === user?.email || !f.user_id)) ? 'me' : (f.owner_name || f.user_id)}
                                                </span>
                                            </div>
                                            <div className="col-span-2 hidden md:block text-[14px] text-slate-600 dark:text-slate-400 font-medium group-hover:text-slate-800 dark:group-hover:text-slate-300">
                                                {formatDateID(f.created_at)}
                                            </div>
                                            <div className="col-span-2 md:col-span-2 flex items-center justify-end md:justify-between text-[14px] text-slate-600 dark:text-slate-400 font-medium">
                                                <span className="hidden md:inline">{formatSize(f.size)}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {currentView === 'trash' ? (
                                                        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRestoreItem(f, 'file'); }} className="p-2 hover:bg-slate-200 rounded-full text-green-500" title="Restore">
                                                            <RotateCcw size={18} />
                                                        </button>
                                                    ) : currentView === 'shared' ? (
                                                        f.can_download !== false && (
                                                            <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDownloadFile(f.id, f.name); }} className="p-2 hover:bg-slate-200 rounded-full text-blue-500" title="Download">
                                                                <Download size={18} />
                                                            </button>
                                                        )
                                                    ) : (
                                                        <>
                                                            {f.can_download !== false && (
                                                                <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDownloadFile(f.id, f.name); }} className="p-2 hover:bg-slate-200 rounded-full text-blue-500" title="Download">
                                                                    <Download size={18} />
                                                                </button>
                                                            )}
                                                            <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteFile(f); }} className="p-2 hover:bg-slate-200 rounded-full text-red-500" title="Delete">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={`file-${f.id}`}
                                            draggable
                                            onDragStart={(e: React.DragEvent) => handleDragStartItem(e, f.id, 'file')}
                                            onDragEnd={handleDragEndItem}
                                            onDoubleClick={() => handlePreview(f)}
                                            onClick={(e) => {
                                                if (e.ctrlKey || e.metaKey || selectedItems.length > 0) {
                                                    e.stopPropagation();
                                                    toggleSelection(f, 'file');
                                                }
                                            }}
                                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, f, 'file')}
                                            className={`flex flex-col border rounded-xl cursor-pointer overflow-hidden group transition-colors selectable-item ${isSelected(f.id, 'file') ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            <div className="h-32 bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center p-4 border-b border-slate-200 dark:border-slate-700 relative">
                                                {isSelected(f.id, 'file') && (
                                                    <div className="absolute top-2 left-2 w-6 h-6 rounded bg-[#1a73e8] flex items-center justify-center text-white shadow-sm z-10"><Check size={16} /></div>
                                                )}
                                                <div className="transform scale-[2]">{getFileIcon(f.name, f.mime_type)}</div>
                                            </div>
                                            <div className="p-3 flex items-center gap-3">
                                                {getFileIcon(f.name, f.mime_type)}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-2">
                                                        {f.name} {f.is_starred && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto mr-1">
                                                    {f.is_public && (
                                                        <span title="Public Link Active"><Link size={12} className="text-green-500 dark:text-green-400" /></span>
                                                    )}
                                                    {f.is_shared && (
                                                        <span title="Shared"><Users size={12} className="text-slate-500 dark:text-slate-400" /></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedItems.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-5 py-3 flex items-center gap-4 z-[90] pointer-events-auto bulk-action-bar">
                        <span className="text-sm font-medium text-white whitespace-nowrap">{selectedItems.length} selected</span>
                        <div className="w-px h-5 bg-slate-600"></div>
                        <button onClick={handleBulkDelete} className="p-2 hover:bg-slate-800 text-slate-300 hover:text-red-400 rounded-full transition-colors flex items-center justify-center group" title="Delete Selected">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={() => setSelectedItems([])} className="p-2 hover:bg-slate-800 text-slate-300 rounded-full transition-colors flex items-center justify-center" title="Batal">
                            <X size={20} />
                        </button>
                    </div>
                )}

                {/* Rename Modal */}
                {renameModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/40 z-[110] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Edit2 size={20} className="text-blue-500" /> Rename
                                </h3>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Please enter a new name for the item:</p>
                                <input
                                    type="text"
                                    value={tempRenameName}
                                    onChange={(e) => setTempRenameName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-200"
                                    autoFocus
                                />
                            </div>
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700">
                                <button className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors" onClick={() => setRenameModal({ visible: false, item: null, type: null })}>Cancel</button>
                                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50" onClick={submitRename} disabled={!tempRenameName.trim() || tempRenameName === renameModal.item?.name}>Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {deleteModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/40 z-[110] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Trash2 size={20} className="text-red-500" /> Move to Trash?
                                </h3>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 dark:text-slate-300">
                                    Are you sure you want to delete <strong>{deleteModal.item?.name}</strong>?
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                    You can restore items from the Trash later if needed.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700">
                                <button className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors" onClick={() => setDeleteModal({ visible: false, item: null, type: null })}>Cancel</button>
                                <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors" onClick={submitDelete}>Move to Trash</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Click Context Menu */}
                {contextMenu.visible && contextMenu.type !== null && (
                    <div
                        className="fixed bg-white dark:bg-slate-800 shadow-xl rounded-lg py-2 border border-slate-100 dark:border-slate-700 z-[100] min-w-[200px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {contextMenu.type === 'background' ? (
                            clipboard && clipboard.action !== null ? (
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors"
                                    onClick={handleClipboardPaste}
                                >
                                    <ClipboardList size={16} className="text-slate-500 dark:text-slate-400" />
                                    Paste
                                </button>
                            ) : (
                                <div className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500">
                                    No actions available
                                </div>
                            )
                        ) : contextMenu.item ? (
                            <>
                                {(contextMenu.type === 'file' || contextMenu.type === 'folder') && contextMenu.item?.can_download !== false && (
                                    <>
                                        <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={() => {
                                            if (contextMenu.type === 'file') {
                                                handleDownloadFile(contextMenu.item.id, contextMenu.item.name)
                                            } else {
                                                handleDownloadFolder(contextMenu.item.id, contextMenu.item.name)
                                            }
                                        }}>
                                            <Download size={16} className="text-slate-500 dark:text-slate-400" />
                                            Download
                                        </button>
                                        <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                                    </>
                                )}
                                {currentView === 'trash' ? (
                                    <button
                                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-green-600 transition-colors"
                                        onClick={() => handleRestoreItem()}
                                    >
                                        <RotateCcw size={16} className="text-green-500" />
                                        Restore
                                    </button>
                                ) : (
                                    <>
                                        {contextMenu.type === 'folder' && contextMenu.item?.is_special && (contextMenu.item?.is_shared || user?.role?.toLowerCase() !== 'admin') && (
                                            <>
                                                <button 
                                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-blue-600 dark:text-blue-400 font-semibold transition-colors animate-pulse" 
                                                    onClick={() => handleAnalyzeFolder(contextMenu.item)}
                                                >
                                                    <Brain size={16} className="text-blue-500 dark:text-blue-400" />
                                                    Analisis BaknusAI
                                                </button>
                                                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                                            </>
                                        )}
                                        {(contextMenu.item?.user_id === user?.id || contextMenu.item?.user_id === user?.email || user?.role?.toLowerCase() === 'admin') && (
                                            <>
                                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={handleShareMenu}>
                                                    <Share2 size={16} className="text-slate-500 dark:text-slate-400" />
                                                    Share
                                                 </button>
                                                 {contextMenu.type === 'folder' && (
                                                     <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={handleShowAccessDetails}>
                                                         <Users size={16} className="text-slate-500 dark:text-slate-400" />
                                                         Detail Akses & Kontributor
                                                     </button>
                                                 )}
                                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={handleToggleStar}>
                                                    <Star size={16} className={contextMenu.item.is_starred ? "text-yellow-400 fill-yellow-400" : "text-slate-500 dark:text-slate-400"} />
                                                    {contextMenu.item.is_starred ? "Remove from starred" : "Add to starred"}
                                                </button>
                                                {contextMenu.type === 'file' && (
                                                    <>
                                                        <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={handleTogglePublic}>
                                                            <Link size={16} className={contextMenu.item.is_public ? "text-green-500" : "text-slate-500 dark:text-slate-400"} />
                                                            {contextMenu.item.is_public ? "Turn off public link" : "Get public link"}
                                                        </button>
                                                        {contextMenu.item.is_public && (
                                                            <button
                                                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                                                                onClick={() => {
                                                                    const link = `${window.location.origin}/api/public/${contextMenu.type}/${contextMenu.item.id}/download`;
                                                                    navigator.clipboard.writeText(link);
                                                                    window.open('https://baknusmail.smkbn666.sch.id', '_blank');
                                                                    setContextMenu({ ...contextMenu, visible: false });
                                                                }}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                                Kirim Email (Copied)
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={handleRenameMenu}>
                                                    <Edit2 size={16} className="text-slate-500 dark:text-slate-400" />
                                                    Rename
                                                </button>
                                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={() => handleClipboardCopy(contextMenu.item, contextMenu.type as 'file' | 'folder')}>
                                                    <Copy size={16} className="text-slate-500 dark:text-slate-400" />
                                                    Copy
                                                </button>
                                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors" onClick={() => handleClipboardCut(contextMenu.item, contextMenu.type as 'file' | 'folder')}>
                                                    <ClipboardList size={16} className="text-slate-500 dark:text-slate-400" />
                                                    Cut
                                                </button>
                                                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                                                <button
                                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-red-600 transition-colors"
                                                    onClick={() => {
                                                        if (selectedItems.length > 1) {
                                                            handleBulkDelete();
                                                        } else {
                                                            contextMenu.type === 'file' ? handleDeleteFile(contextMenu.item) : handleDeleteFolder(contextMenu.item);
                                                        }
                                                        setContextMenu({ ...contextMenu, visible: false });
                                                    }}
                                                >
                                                    <Trash size={16} className="text-red-500" />
                                                    {selectedItems.length > 1 ? `Remove Selected (${selectedItems.length})` : 'Remove'}
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>
                )}

                {/* BaknusAI Modal */}
                {aiModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 transition-all duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-[650px] flex flex-col overflow-hidden max-h-[85vh] border border-slate-100 dark:border-slate-700 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white flex items-center justify-between relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md animate-pulse">
                                        <Brain className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold tracking-tight">Analisis BaknusAI</h3>
                                        <p className="text-xs text-blue-100 font-medium">Model: gemma2:9b (Ollama Lokal)</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setAiModal({ visible: false, folder: null, analysis: '', loading: false, error: '' })}
                                    className="p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all relative z-10 text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
                                {aiModal.loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-5 animate-pulse">
                                        <div className="relative flex items-center justify-center">
                                            <div className="absolute w-20 h-20 bg-blue-500/10 rounded-full animate-ping"></div>
                                            <div className="absolute w-16 h-16 bg-indigo-500/20 rounded-full animate-pulse"></div>
                                            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-slate-700 dark:text-slate-300 font-semibold text-lg flex items-center justify-center gap-2">
                                                <Sparkles className="text-indigo-500 animate-bounce" size={20} />
                                                Sedang dicek Oleh BaknusAI
                                            </p>
                                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Membaca struktur folder & kolaborator...</p>
                                        </div>
                                    </div>
                                ) : aiModal.error ? (
                                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-5 flex gap-4 items-start">
                                        <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <h4 className="font-semibold text-red-800 dark:text-red-400 text-sm">Gagal Melakukan Analisis</h4>
                                            <p className="text-red-700 dark:text-red-400/90 text-sm mt-1 leading-relaxed">{aiModal.error}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
                                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full uppercase tracking-wider">Hasil Analisis</span>
                                            <span className="text-slate-400 dark:text-slate-500 text-xs">Folder: <span className="font-semibold text-slate-700 dark:text-slate-300">{aiModal.folder?.name}</span></span>
                                        </div>
                                        <div className="text-slate-700 dark:text-slate-300 text-[14px] leading-relaxed font-medium space-y-2">
                                            {renderMarkdown(aiModal.analysis)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 px-6 py-4 flex justify-between items-center gap-3">
                                <div>
                                    {!aiModal.loading && !aiModal.error && aiModal.analysis && (
                                        <button
                                            onClick={handleSaveAnalysis}
                                            disabled={savingAnalysis}
                                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-sm font-bold rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            {savingAnalysis ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <FileText size={16} />
                                                    Simpan ke Drive
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setAiModal({ visible: false, folder: null, analysis: '', loading: false, error: '' })}
                                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-2xl transition-all shadow-sm active:scale-95"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Share Modal */}
                {shareModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200]">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-[550px] flex flex-col overflow-hidden max-h-[85vh] text-slate-800 dark:text-slate-200">
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <div>
                                    <h2 className="text-[20px] font-medium text-slate-800 dark:text-white">Share "{shareModal.item?.name}"</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Berbagi file dengan siswa, guru, atau tenaga kependidikan</p>
                                </div>
                                <button onClick={() => setShareModal({ visible: false, item: null, type: null })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 p-2 rounded-full transition-colors border border-transparent dark:border-slate-600">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                <div className="mb-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pengaturan Izin (Permissions)</div>
                                    
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Izinkan Edit (Kolaborasi)</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Penerima dapat mengedit dokumen ini secara langsung (Collabora).
                                            </div>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input 
                                                type="checkbox" 
                                                id="toggle-can-edit" 
                                                checked={canEdit} 
                                                onChange={(e) => setCanEdit(e.target.checked)} 
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-500 transition-all z-10" 
                                            />
                                            <label htmlFor="toggle-can-edit" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 dark:bg-slate-700 cursor-pointer"></label>
                                        </div>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer border-t border-slate-200 dark:border-slate-700 pt-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Izinkan Unduh (Download & Copy)</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Penerima dapat mengunduh file asli dan menyalin isi dokumen.
                                            </div>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input 
                                                type="checkbox" 
                                                id="toggle-can-download" 
                                                checked={canDownload} 
                                                onChange={(e) => setCanDownload(e.target.checked)} 
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-500 transition-all z-10" 
                                            />
                                            <label htmlFor="toggle-can-download" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 dark:bg-slate-700 cursor-pointer"></label>
                                        </div>
                                    </label>

                                    {shareModal.type === 'folder' && (
                                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mode Share: Khusus (Tugas)</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Penerima hanya bisa melihat file yang mereka upload sendiri.
                                                    </div>
                                                </div>
                                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                                    <input type="checkbox" name="toggle" id="toggle-blind-drop" checked={isBlindDrop} onChange={(e) => setIsBlindDrop(e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-500 transition-all z-10" />
                                                    <label htmlFor="toggle-blind-drop" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 dark:bg-slate-700 cursor-pointer"></label>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                    <style>{`
                                        .toggle-checkbox:checked + .toggle-label { background-color: #3b82f6; }
                                        .toggle-checkbox:checked { right: 0; border-color: #3b82f6; }
                                        .toggle-checkbox { right: 24px; transition: right 0.2s; }
                                    `}</style>
                                </div>
                                                {/* Share Link Copy Box */}
                                 <div className="mb-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                     <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Link Kolaborasi / Share Link</label>
                                     <div className="flex gap-2">
                                         <input
                                             type="text"
                                             readOnly
                                             value={shareLink}
                                             onClick={(e) => (e.target as HTMLInputElement).select()}
                                             className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-300 outline-none select-all font-mono shadow-inner"
                                         />
                                         <button
                                             onClick={() => {
                                                 navigator.clipboard.writeText(shareLink);
                                                 alert("Link berhasil disalin ke clipboard!");
                                             }}
                                             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                                         >
                                             <Copy size={14} /> Salin Link
                                         </button>
                                     </div>
                                 </div>

                                 <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5 block">Bagikan Cepat ke Tag / Role</label>
                                 <div className="mb-6 flex gap-3">
                                     <button onClick={() => submitShare('ROLE:Guru')} className="flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/20 dark:hover:bg-teal-900/30 dark:text-teal-400 font-semibold py-2.5 px-4 rounded-xl transition-all border border-teal-200 dark:border-teal-800 shadow-sm flex items-center justify-center gap-2 text-sm active:scale-95">
                                         <Users size={16} /> Semua Guru
                                     </button>
                                     <button onClick={() => submitShare('ROLE:Siswa')} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:text-blue-400 font-semibold py-2.5 px-4 rounded-xl transition-all border border-blue-200 dark:border-blue-800 shadow-sm flex items-center justify-center gap-2 text-sm active:scale-95">
                                         <Users size={16} /> Semua Siswa
                                     </button>
                                     <button onClick={() => submitShare('ROLE:TU')} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 dark:text-indigo-400 font-semibold py-2.5 px-4 rounded-xl transition-all border border-indigo-200 dark:border-indigo-850 shadow-sm flex items-center justify-center gap-2 text-sm active:scale-95">
                                         <Users size={16} /> Semua TU
                                     </button>
                                 </div>

                                 <div className="mb-6">
                                     <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5 block">Atau Bagikan ke Kelas Spesifik</label>
                                     <div className="flex gap-2">
                                         <div className="relative flex-1">
                                             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                 <Search size={18} className="text-slate-400" />
                                             </div>
                                             <select
                                                 value={searchClass}
                                                 onChange={(e) => setSearchClass(e.target.value)}
                                                 className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:bg-slate-800 transition-all text-sm appearance-none font-medium text-slate-700 dark:text-slate-200"
                                             >
                                                 <option value="" disabled>Pilih nama kelas...</option>
                                                 {Array.from(new Set(usersList.map(u => u.class).filter(c => c && c.trim() !== ''))).sort().map(c => (
                                                     <option key={String(c)} value={String(c)}>{String(c)}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <button onClick={() => {
                                             if (searchClass.trim() !== '') {
                                                 submitShare('CLASS:' + searchClass.trim());
                                                 setSearchClass('');
                                             }
                                         }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all font-semibold shrink-0 text-sm shadow-sm active:scale-95">Bagikan</button>
                                     </div>
                                 </div>

                                 <div className="mb-4 mt-6 border-t border-slate-100 dark:border-slate-700 pt-6">
                                     <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2.5 block">Atau Bagikan ke Orang Spesifik</label>
                                     <div className="relative">
                                         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                             <Search size={18} className="text-slate-400" />
                                         </div>
                                         <input
                                             type="text"
                                             placeholder="Cari nama atau email..."
                                             value={searchUser}
                                             onChange={(e) => setSearchUser(e.target.value)}
                                             className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-950/30 transition-all text-sm text-slate-800 dark:text-slate-100"
                                         />
                                     </div>
                                 </div>

                                 <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                     {usersList.filter(u => u.email.toLowerCase().includes(searchUser.toLowerCase()) || u.full_name?.toLowerCase().includes(searchUser.toLowerCase())).slice(0, 15).map(u => (
                                         <div key={u.email} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-sm hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-900 transition-all">
                                             <div className="flex items-center gap-3 overflow-hidden">
                                                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex shrink-0 items-center justify-center font-bold text-base shadow-sm">
                                                     {u.full_name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                                                 </div>
                                                 <div className="flex flex-col truncate">
                                                     <span className="font-semibold text-slate-800 dark:text-slate-100 text-[14px] truncate">{u.full_name || u.email}</span>
                                                     <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                                                         {u.email} 
                                                         <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span> 
                                                         <span className="font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">{u.role}</span>
                                                     </span>
                                                 </div>
                                             </div>
                                             <button
                                                 onClick={() => submitShare(u.email)}
                                                 className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all font-semibold shrink-0 text-xs shadow-sm active:scale-95"
                                             >
                                                 Bagikan
                                             </button>
                                         </div>
                                     ))}
                                 </div>

                                {/* Existing Shares / Unshare section */}
                                {itemShares.length > 0 && (
                                    <div className="mt-6 border-t border-slate-100 pt-6">
                                        <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                                            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                                            Sudah dibagikan ke ({itemShares.length})
                                        </label>
                                        <div className="space-y-2">
                                            {itemShares.map((s: any) => {
                                                let label = s.shared_with;
                                                let badgeColor = 'bg-slate-100 text-slate-600';
                                                let icon = '👤';
                                                if (s.shared_with?.startsWith('ROLE:')) {
                                                    label = s.shared_with.replace('ROLE:', 'Semua ');
                                                    badgeColor = 'bg-teal-50 text-teal-700';
                                                    icon = '👥';
                                                } else if (s.shared_with?.startsWith('CLASS:')) {
                                                    label = 'Kelas ' + s.shared_with.replace('CLASS:', '');
                                                    badgeColor = 'bg-indigo-50 text-indigo-700';
                                                    icon = '🏫';
                                                }
                                                return (
                                                    <div key={s.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${badgeColor} border-opacity-50`}>
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-sm font-medium flex items-center gap-2">
                                                                <span>{icon}</span> {label}
                                                            </span>
                                                            {(s.is_blind_drop || s.can_edit === false || s.can_download === false) && (
                                                                <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                                                                    {s.is_blind_drop && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">Mode Tugas</span>}
                                                                    {s.can_edit === false && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md">Read-Only</span>}
                                                                    {s.can_download === false && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md">No Download</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleUnshare(s.id)}
                                                            className="ml-4 p-1.5 rounded-lg bg-white/70 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-200 shrink-0"
                                                            title="Hentikan sharing"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* File Preview Modal */}
                {previewFile && (
                    <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col backdrop-blur-md transition-opacity">
                        <div className="flex items-center justify-between p-4 px-6 text-white border-b border-white/10 bg-black/40">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    {getFileIcon(previewFile.name, previewFile.mime_type)}
                                </div>
                                <span className="text-lg font-medium tracking-wide">{previewFile.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {previewFile.can_download !== false && (
                                    <button onClick={() => handleDownloadFile(previewFile.id, previewFile.name)} className="p-2 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2 px-4 bg-white/10 mr-2">
                                        <Download size={20} /> <span className="text-sm font-medium">Download</span>
                                    </button>
                                )}
                                <button onClick={closePreview} className="p-2 hover:bg-white/20 rounded-full transition-colors bg-white/10">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
                            {!previewUrl ? (
                                <div className="flex flex-col items-center gap-4 text-white/70">
                                    <Loader2 size={48} className="animate-spin text-blue-400" />
                                    <span className="font-medium tracking-wide">Loading preview...</span>
                                </div>
                            ) : isImageFile(previewFile) ? (
                                <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg" />
                            ) : isPdfFile(previewFile) || isTextFile(previewFile) ? (
                                <iframe src={previewUrl} className="w-full h-full border border-white/10 bg-white rounded-xl shadow-2xl"></iframe>
                            ) : isVideoFile(previewFile) ? (
                                <video src={previewUrl} controls className="max-w-full max-h-full rounded-xl shadow-2xl bg-black"></video>
                            ) : (
                                <div className="text-white flex flex-col items-center max-w-2xl text-center bg-white/5 p-12 rounded-3xl border border-white/10 backdrop-blur-lg">
                                    <div className="p-6 bg-white/10 rounded-full mb-6">
                                        {getFileIcon(previewFile.name, previewFile.mime_type, 64, "text-white/80")}
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Tidak ada preview tersedia</h3>
                                    <p className="text-white/60 mb-6 leading-relaxed">Tipe file ini ({previewFile.mime_type || 'unknown'}) tidak dapat ditampilkan secara langsung pad browser Anda.</p>

                                    {/\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/i.test(previewFile.name) && previewFile.can_download !== false && (
                                        <p className="text-white/80 mb-8 text-[14px] bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                            ℹ️ <b>Informasi:</b> Dokumen dari Microsoft Office atau aplikasi Perkantoran sejenisnya memerlukan aplikasi khusus di Desktop / HP untuk dapat dirender. Oleh karena itu, Anda harus mengunduh file ini terlebih dahulu.
                                        </p>
                                    )}

                                    {previewFile.can_download === false && (
                                        <p className="text-red-400 mb-8 text-[14px] bg-red-950/45 p-4 rounded-xl border border-red-500/30 shadow-inner">
                                            ⚠️ <b>Akses Dibatasi:</b> Pemilik file telah menonaktifkan fitur download untuk dokumen ini.
                                        </p>
                                    )}

                                    {previewFile.can_download !== false && (
                                        <button onClick={() => handleDownloadFile(previewFile.id, previewFile.name)} className="bg-blue-500 hover:bg-blue-600 px-8 py-3 rounded-full font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30">
                                            <Download size={20} /> Download File
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* User Activity Modal */}
                {userActivityModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Detail Aktivitas Upload Pengguna</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {userActivityModal.user?.full_name || userActivityModal.user?.email} ({userActivityModal.user?.email}) • Role: {userActivityModal.user?.role} {userActivityModal.user?.class ? `• Kelas: ${userActivityModal.user.class}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setUserActivityModal({ visible: false, user: null, activities: [], loading: false })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                                {userActivityModal.loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="text-indigo-500 animate-spin" size={40} />
                                        <span className="text-sm text-slate-500 font-semibold dark:text-slate-400">Memuat data aktivitas...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Stats Cards */}
                                        {(() => {
                                            const totalFiles = userActivityModal.activities.length;
                                            const totalSize = userActivityModal.activities.reduce((acc, curr) => acc + curr.size, 0);
                                            const ownFiles = userActivityModal.activities.filter(a => a.is_own_drive);
                                            const ownCount = ownFiles.length;
                                            const ownSize = ownFiles.reduce((acc, curr) => acc + curr.size, 0);
                                            const sharedFiles = userActivityModal.activities.filter(a => !a.is_own_drive);
                                            const sharedCount = sharedFiles.length;
                                            const sharedSize = sharedFiles.reduce((acc, curr) => acc + curr.size, 0);

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                                            <HardDrive size={24} />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Upload</span>
                                                            <span className="text-lg font-bold text-slate-800 dark:text-white">{totalFiles} file</span>
                                                            <span className="text-xs text-slate-500 block">{formatSize(totalSize)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                                                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
                                                            <FolderIcon size={24} />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Drive Sendiri</span>
                                                            <span className="text-lg font-bold text-slate-800 dark:text-white">{ownCount} file</span>
                                                            <span className="text-xs text-slate-500 block">{formatSize(ownSize)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                                                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                                            <Users size={24} />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Shared Folder</span>
                                                            <span className="text-lg font-bold text-slate-800 dark:text-white">{sharedCount} file</span>
                                                            <span className="text-xs text-slate-500 block">{formatSize(sharedSize)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Search Filter */}
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Cari nama file..."
                                                value={activitySearchQuery}
                                                onChange={(e) => { setActivitySearchQuery(e.target.value); setActivityCurrentPage(1); }}
                                                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* File List Table */}
                                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-750 rounded-2xl bg-white dark:bg-slate-800 flex-1">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-150 dark:border-slate-700 font-semibold">
                                                    <tr>
                                                        <th className="px-5 py-4">Nama File</th>
                                                        <th className="px-5 py-4">Ukuran</th>
                                                        <th className="px-5 py-4">Tanggal Upload</th>
                                                        <th className="px-5 py-4">Lokasi / Drive</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {(() => {
                                                        const filtered = userActivityModal.activities.filter(a =>
                                                            (a.name || '').toLowerCase().includes(activitySearchQuery.toLowerCase())
                                                        );
                                                        const totalPages = Math.ceil(filtered.length / activityItemsPerPage) || 1;
                                                        const paginated = filtered.slice(
                                                            (activityCurrentPage - 1) * activityItemsPerPage,
                                                            activityCurrentPage * activityItemsPerPage
                                                        );

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 italic dark:text-slate-500">
                                                                        Belum ada file yang diunggah atau tidak ditemukan hasil pencocokan.
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                {paginated.map((act) => {
                                                                    // Resolve file type icon
                                                                    let Icon = FileIcon;
                                                                    if (act.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(act.name)) Icon = ImageIcon;
                                                                    else if (act.mime_type === 'application/pdf' || /\.(pdf)$/i.test(act.name)) Icon = FileText;
                                                                    else if (act.mime_type?.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(act.name)) Icon = FileVideo;
                                                                    else if (act.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(act.name)) Icon = FileAudio;
                                                                    else if (/\.(docx|doc)$/i.test(act.name)) Icon = FileText;
                                                                    else if (/\.(xlsx|xls|csv)$/i.test(act.name)) Icon = FileSpreadsheet;
                                                                    else if (/\.(pptx|ppt)$/i.test(act.name)) Icon = Presentation;
                                                                    else if (/\.(zip|rar|7z|tar|gz)$/i.test(act.name)) Icon = FileArchive;

                                                                    return (
                                                                        <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                                            <td className="px-5 py-3.5 flex items-center gap-2 max-w-sm overflow-hidden text-ellipsis">
                                                                                <div className="p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-slate-500 shrink-0">
                                                                                    <Icon size={16} />
                                                                                </div>
                                                                                <span className="font-medium text-slate-750 dark:text-slate-200 truncate" title={act.name}>{act.name}</span>
                                                                            </td>
                                                                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                                                                                {formatSize(act.size)}
                                                                            </td>
                                                                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                                                                                {formatDateID(act.created_at)}
                                                                            </td>
                                                                            <td className="px-5 py-3.5">
                                                                                {act.is_own_drive ? (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="inline-flex self-start items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/55 dark:border-green-800/25">
                                                                                            Drive Sendiri
                                                                                        </span>
                                                                                        <span className="text-xs text-slate-450 dark:text-slate-500 mt-0.5 truncate max-w-[200px]" title={act.folder_name ? `Folder: /${act.folder_name}` : 'Root: /'}>
                                                                                            {act.folder_name ? `/${act.folder_name}` : '/'}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="inline-flex self-start items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/55 dark:border-indigo-800/25">
                                                                                            Shared Folder
                                                                                        </span>
                                                                                        <span className="text-xs text-slate-450 dark:text-slate-500 mt-0.5 truncate max-w-[200px]" title={`Milik: ${act.root_owner_name || act.root_owner_email} (${act.root_owner_email}) /${act.folder_name}`}>
                                                                                            Milik: {act.root_owner_name || act.root_owner_email} {act.folder_name ? `/${act.folder_name}` : ''}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}

                                                                {totalPages > 1 && (
                                                                    <tr>
                                                                        <td colSpan={4} className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs text-slate-500">
                                                                                    Halaman {activityCurrentPage} dari {totalPages}
                                                                                </span>
                                                                                <div className="flex gap-1">
                                                                                    <button
                                                                                        disabled={activityCurrentPage === 1}
                                                                                        onClick={() => setActivityCurrentPage(p => Math.max(1, p - 1))}
                                                                                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                                                                                    >
                                                                                        Sebelumnya
                                                                                    </button>
                                                                                    <button
                                                                                        disabled={activityCurrentPage === totalPages}
                                                                                        onClick={() => setActivityCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                                                                                    >
                                                                                        Berikutnya
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* Quota Modal */}
                {quotaModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Ubah Data Administrator</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{quotaModal.user?.full_name || quotaModal.user?.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setQuotaModal({ visible: false, user: null })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 ml-1">Kapasitas Penyimpanan (GB)</label>
                                <div className="relative mb-4">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0.1"
                                        value={tempQuotaGB}
                                        onChange={(e) => setTempQuotaGB(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 focus:ring-0 outline-none transition-all text-2xl font-bold text-slate-800 dark:text-white"
                                        placeholder="Contoh: 5"
                                        autoFocus
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">GB</div>
                                </div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 ml-1">Kelas Siswa / Kategori</label>
                                <input
                                    type="text"
                                    value={tempClass}
                                    onChange={(e) => setTempClass(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 focus:ring-0 outline-none transition-all text-sm font-bold text-slate-800 dark:text-white"
                                    placeholder="Contoh: X RPL 2"
                                />
                                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                    💡 <b>Tips:</b> Kapasitas yang Anda masukkan akan langsung membatasi jumlah file yang dapat diupload oleh pengguna ini. Kelas berguna untuk opsi Sharing.
                                </p>
                            </div>

                            <div className="px-8 pb-8 flex gap-3">
                                <button
                                    onClick={() => setQuotaModal({ visible: false, user: null })}
                                    className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => {
                                        const bytes = parseFloat(tempQuotaGB) * 1024 * 1024 * 1024;
                                        if (!isNaN(bytes) && bytes > 0) {
                                            handleAdminUpdateUser(quotaModal.user.id || quotaModal.user.email, Math.round(bytes), undefined, tempClass);
                                            setQuotaModal({ visible: false, user: null });
                                        } else {
                                            alert("Masukkan angka yang valid");
                                        }
                                    }}
                                    className="flex-3 bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showFormBuilder && (
                    <FormBuilder
                        onClose={() => { setShowFormBuilder(false); setEditingForm(null); }}
                        onSave={editingForm ? handleUpdateForm : handleSaveForm}
                        initialData={editingForm}
                    />
                )}

                {showSettingsModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200">
                            <div className="p-8 pb-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Pengaturan Profil</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola informasi akun Anda</p>
                                </div>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 flex flex-col items-center">
                                {/* Avatar Section */}
                                <div className="relative group mb-6">
                                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden ring-4 ring-blue-50 dark:ring-slate-700">
                                        {user?.email ? (
                                            <img
                                                src={`https://baknusmail.smkbn666.sch.id/api/public/avatar/${user.email}`}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).parentElement!.innerText = user?.full_name?.charAt(0)?.toUpperCase() || 'B';
                                                }}
                                            />
                                        ) : (
                                            user?.full_name?.charAt(0)?.toUpperCase() || 'B'
                                        )}
                                    </div>
                                </div>

                                {/* Info Card */}
                                <div className="w-full space-y-4">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Nama Lengkap</label>
                                        <p className="text-slate-700 dark:text-slate-200 font-medium">{user?.full_name || '-'}</p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Email Sekolah</label>
                                        <p className="text-slate-700 dark:text-slate-200 font-medium">{user?.email || '-'}</p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Nomor WhatsApp</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-700 dark:text-slate-200 font-medium">{user?.whatsapp || '-'}</span>
                                            {user?.whatsapp && (
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                                        💡 <b>Info:</b> Untuk mengubah Foto Profil atau Nomor WhatsApp, Anda akan diarahkan ke sistem Mail Baknus.
                                    </p>
                                </div>
                            </div>

                            <div className="p-8 pt-0 flex gap-3">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all"
                                >
                                    Tutup
                                </button>
                                <a
                                    href="https://baknusmail.smkbn666.sch.id/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-[1.5] py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                >
                                    Ubah Detail
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Overlays */}
                {uploadProgress.active && (
                    <div className="fixed bottom-8 right-8 z-[200] w-80 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                        <FileUp size={20} className={uploadProgress.percent < 100 ? "animate-bounce" : ""} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                            {uploadProgress.percent < 100 ? "Mengupload..." : "Upload Selesai!"}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{uploadProgress.fileName}</p>
                                    </div>
                                    <div className="text-sm font-black text-blue-600 dark:text-blue-400">{uploadProgress.percent}%</div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                                        style={{ width: `${uploadProgress.percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {downloading && (
                    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[200] flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-2xl border border-white/20 flex flex-col items-center max-w-xs w-full">
                            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/40 mb-6 relative">
                                <Download size={32} className="animate-bounce" />
                                <div className="absolute inset-0 rounded-2xl border-4 border-white/20 border-t-white animate-spin"></div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Menyiapkan File</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Silakan tunggu sebentar sedanga memproses file untuk diunduh...</p>
                        </div>
                    </div>
                )}

                {/* Form Responses Modal */}
                {responsesModal.visible && responsesModal.form && (() => {
                    const form = responsesModal.form;
                    let questions: any[] = [];
                    try { questions = JSON.parse(form.questions || '[]'); } catch { }
                    return (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                                {/* Modal Header */}
                                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{form.title}</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{formResponses.length} respon diterima</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={exportResponsesToDrive}
                                            disabled={exporting || formResponses.length === 0}
                                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/30"
                                        >
                                            {exporting ? (
                                                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> Mengekspor...</>
                                            ) : (
                                                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Ekspor ke Drive (.csv)</>
                                            )}
                                        </button>
                                        <button onClick={() => setResponsesModal({ visible: false, form: null })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body */}
                                <div className="overflow-auto flex-1 p-6">
                                    {loadingResponses ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                            <p>Memuat respon...</p>
                                        </div>
                                    ) : formResponses.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            <p className="font-medium">Belum ada respon</p>
                                            <p className="text-sm mt-1">Bagikan link formulir untuk mulai menerima respon.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                                        <th className="text-left px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap">#</th>
                                                        <th className="text-left px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap">Waktu</th>
                                                        {questions.map((q: any) => (
                                                            <th key={q.id} className="text-left px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap max-w-[200px]">
                                                                {q.label || 'Pertanyaan'}
                                                                {q.required && <span className="text-red-400 ml-0.5">*</span>}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {formResponses.map((resp: any, idx: number) => (
                                                        <tr key={resp.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}>
                                                            <td className="px-4 py-3 text-slate-500 font-medium">{idx + 1}</td>
                                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{new Date(resp.created_at).toLocaleString('id-ID')}</td>
                                                            {questions.map((q: any) => {
                                                                const val = resp.parsed?.[q.id];
                                                                const display = Array.isArray(val) ? val.join(', ') : (val ?? '-');
                                                                return (
                                                                    <td key={q.id} className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                                                                        {display.toString() || '-'}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ===== NEW DOC MODAL ===== */}
                {newDocModal.visible && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNewDocModal(prev => ({ ...prev, visible: false }))}>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-12 w-full max-w-2xl mx-6 border border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>

                            {/* Icon & Title */}
                            <div className="flex items-center gap-6 mb-10">
                                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg flex-shrink-0 ${newDocModal.type === 'docx' ? 'bg-blue-50 dark:bg-blue-900/30' : newDocModal.type === 'xlsx' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
                                    {newDocModal.type === 'docx' && <FileText size={52} className="text-blue-600 dark:text-blue-400" />}
                                    {newDocModal.type === 'xlsx' && <FileSpreadsheet size={52} className="text-green-600 dark:text-green-400" />}
                                    {newDocModal.type === 'pptx' && <Presentation size={52} className="text-orange-600 dark:text-orange-400" />}
                                </div>
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                                        {newDocModal.type === 'docx' ? 'Buat Dokumen Baru' : newDocModal.type === 'xlsx' ? 'Buat Spreadsheet Baru' : 'Buat Presentasi Baru'}
                                    </h3>
                                    <p className="text-lg text-slate-500 dark:text-slate-400">Masukkan nama file sebelum membuat</p>
                                </div>
                            </div>

                            {/* Label */}
                            <label className="block text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Nama File</label>

                            {/* Input */}
                            <input
                                type="text"
                                value={newDocModal.name}
                                onChange={e => setNewDocModal(prev => ({ ...prev, name: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirmCreateDoc(); if (e.key === 'Escape') setNewDocModal(prev => ({ ...prev, visible: false })); }}
                                className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 mb-10 transition-all"
                                placeholder="Contoh: Laporan Keuangan Maret..."
                                autoFocus
                                onFocus={e => e.target.select()}
                            />

                            {/* Buttons */}
                            <div className="flex gap-5">
                                <button
                                    onClick={() => setNewDocModal(prev => ({ ...prev, visible: false }))}
                                    className="flex-1 py-5 rounded-2xl border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleConfirmCreateDoc}
                                    disabled={!newDocModal.name.trim()}
                                    className={`flex-1 py-5 rounded-2xl text-white text-xl font-bold shadow-lg transition-all ${newDocModal.type === 'docx' ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' : newDocModal.type === 'xlsx' ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    ✨ Buat &amp; Buka
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== PUBLIC LINK MODAL ===== */}
                {publicLinkModal.visible && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPublicLinkModal(prev => ({ ...prev, visible: false }))}>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-md mx-4 border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Link className="text-blue-500" size={24} />
                                    Konfigurasi Link Publik
                                </h3>
                                <button onClick={() => setPublicLinkModal(prev => ({ ...prev, visible: false }))} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">File/folder ini akan terbuka untuk siapa pun di internet yang memiliki link tersebut. Sesuaikan tingkat keamanan sebelum Anda membagikan data.</p>

                            <div className="space-y-4 mb-8">
                                {/* Password Field */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Lock size={16} className="text-slate-500" />
                                        Kata Sandi (Opsional)
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Kosongkan jika tidak perlu..."
                                        value={publicLinkModal.password}
                                        onChange={e => setPublicLinkModal(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Hanya orang yang tahu kata sandi ini yang bisa melihat atau mengunduh.</p>
                                </div>

                                {/* Expiration Field */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Clock size={16} className="text-slate-500" />
                                        Tanda Waktu Kadaluwarsa (Opsional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={publicLinkModal.expiration}
                                        onChange={e => setPublicLinkModal(prev => ({ ...prev, expiration: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Setelah batas waktu ini, tautan akan otomatis dinonaktifkan.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setPublicLinkModal(prev => ({ ...prev, visible: false }))}
                                    className="flex-1 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleConfirmPublicLink}
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Link size={18} /> Aktifkan Link
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Help Modal */}
                {showHelpModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowHelpModal(false)}>
                        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl p-10 max-w-sm w-full text-center border border-white/20 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-inner">
                                <HelpCircle className="text-blue-600 dark:text-blue-400" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Butuh Bantuan?</h3>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-8">
                                Jangan ragu untuk bertanya pada tim <span className="text-blue-600 font-bold">IT Support</span> mengenai aplikasi ini. Kami senang membantu Anda!
                            </p>
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98]"
                            >
                                Oke, Siap!
                            </button>
                        </div>
                    </div>
                )}

                {/* Access Details Modal */}
                {accessDetailsModal.visible && accessDetailsModal.folder && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setAccessDetailsModal({ visible: false, folder: null, shares: [], loading: false })}>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-transparent dark:border-slate-700" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-white">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Detail Akses & Kontributor</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Folder: <span className="font-semibold text-slate-700 dark:text-slate-300">{accessDetailsModal.folder.name}</span></p>
                                </div>
                                <button onClick={() => setAccessDetailsModal({ visible: false, folder: null, shares: [], loading: false })} className="text-slate-400 dark:text-slate-200 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 p-2 rounded-full transition-colors border border-slate-100 dark:border-slate-650">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                                {/* Owner section */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Pemilik Folder</h3>
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 p-3 rounded-xl">
                                        <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex shrink-0 items-center justify-center font-bold text-sm shadow-sm">
                                            {accessDetailsModal.folder.owner_name?.charAt(0)?.toUpperCase() || 'P'}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{accessDetailsModal.folder.owner_name || 'Pemilik'}</span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Pembuat Folder • {accessDetailsModal.folder.owner_role || 'User'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Shared With section */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Daftar Penerima Akses</h3>
                                    {accessDetailsModal.loading ? (
                                        <div className="flex items-center justify-center py-4 gap-2 text-slate-500 dark:text-slate-400 text-xs">
                                            <Loader2 size={16} className="animate-spin text-blue-500" />
                                            Memuat penerima akses...
                                        </div>
                                    ) : accessDetailsModal.shares.length > 0 ? (
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                            {accessDetailsModal.shares.map((s: any) => {
                                                let label = s.shared_with;
                                                let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-805';
                                                let icon = '👤';
                                                if (s.shared_with?.startsWith('ROLE:')) {
                                                    label = s.shared_with.replace('ROLE:', 'Semua ');
                                                    badgeColor = 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30';
                                                    icon = '👥';
                                                } else if (s.shared_with?.startsWith('CLASS:')) {
                                                    label = 'Kelas ' + s.shared_with.replace('CLASS:', '');
                                                    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30';
                                                    icon = '🏫';
                                                }
                                                return (
                                                    <div key={s.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${badgeColor} text-xs font-medium`}>
                                                        <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-200">
                                                            <span>{icon}</span> <span className="truncate">{label}</span>
                                                        </span>
                                                        {(s.is_blind_drop || s.can_edit === false || s.can_download === false) && (
                                                            <div className="flex gap-1 text-[9px] uppercase font-bold shrink-0">
                                                                {s.is_blind_drop && <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded">Tugas</span>}
                                                                {s.can_edit === false && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded">Read-Only</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">Folder ini belum dibagikan ke siapa pun.</p>
                                    )}
                                </div>

                                {/* Contributors section */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Daftar Kontributor</h3>
                                        {accessDetailsModal.folder.contributors && accessDetailsModal.folder.contributors.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    const listStr = accessDetailsModal.folder.contributors.join(", ");
                                                    navigator.clipboard.writeText(listStr);
                                                    alert("Daftar kontributor berhasil disalin ke clipboard!");
                                                }}
                                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors bg-transparent border-none p-0 cursor-pointer"
                                            >
                                                <Copy size={12} /> Salin Semua
                                            </button>
                                        )}
                                    </div>
                                    {accessDetailsModal.folder.contributors && accessDetailsModal.folder.contributors.length > 0 ? (
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                            {accessDetailsModal.folder.contributors.map((name: string, index: number) => (
                                                <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex shrink-0 items-center justify-center font-bold text-xs">
                                                            {name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate">{name}</span>
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Mengunggah file / Mengubah isi</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(name);
                                                            alert(`Nama "${name}" disalin ke clipboard!`);
                                                        }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shrink-0"
                                                        title="Salin nama kontributor"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">Belum ada kontributor lain dalam folder ini.</p>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                <button onClick={() => setAccessDetailsModal({ visible: false, folder: null, shares: [], loading: false })} className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm active:scale-95">
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
