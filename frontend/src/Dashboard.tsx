import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import logo from './assets/logo.png';
import FormBuilder from './FormBuilder';
import {
    Search, Menu, X, Filter, LayoutGrid, Clock, Users, Database,
    User, Settings, LogOut, ChevronRight, MoreVertical,
    Grid, List, AlertCircle, HardDrive, MonitorSmartphone,
    Star, Trash2, Folder as FolderIcon, File as FileIcon, Image as ImageIcon, FileText, FileSpreadsheet, Presentation,
    Cloud, Plus, Download, FolderPlus, Upload, FileUp, Check,
    Edit2, Copy, Trash, RotateCcw, Share2, Sun, Moon, Eye, Shield, Lock, Unlock,
    HelpCircle, Grip, UserX, Loader2, ExternalLink, ClipboardList, Pencil
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

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [folders, setFolders] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
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
    const [breadcrumb, setBreadcrumb] = useState<{ id: number | null, name: string }[]>([{ id: null, name: 'My Drive' }]);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, item: any, type: 'file' | 'folder' | null }>({ visible: false, x: 0, y: 0, item: null, type: null });

    const [shareModal, setShareModal] = useState<{ visible: boolean, item: any, type: 'file' | 'folder' | null }>({ visible: false, item: null, type: null });
    const [usersList, setUsersList] = useState<any[]>([]); // also used for admin users view
    const [searchUser, setSearchUser] = useState("");
    const [roleFilter, setRoleFilter] = useState("Semua");
    const [storageInfo, setStorageInfo] = useState<{ used: number, quota: number } | null>(null);
    const [adminTargetUser, setAdminTargetUser] = useState<string | null>(null);
    const [quotaModal, setQuotaModal] = useState<{ visible: boolean, user: any }>({ visible: false, user: null });
    const [tempQuotaGB, setTempQuotaGB] = useState<string>("");

    const [uploadProgress, setUploadProgress] = useState<{ active: boolean, percent: number, fileName: string }>({ active: false, percent: 0, fileName: "" });
    const [downloading, setDownloading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [formStatusFilter, setFormStatusFilter] = useState("Semua");
    const [newDocModal, setNewDocModal] = useState<{ visible: boolean, type: string, name: string }>({ visible: false, type: '', name: '' });

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

        const handleGlobalClick = () => {
            if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
        };
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);

    useEffect(() => {
        fetchUserProfile();
        fetchDriveData();
        fetchUsers();
    }, [currentFolderId, currentView, selectedDevice]);

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

    const fetchDevices = async () => {
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.get('/api/drive/devices', { headers: { Authorization: `Bearer ${token}` } });
            setDevices(resp.data || []);
        } catch (error) {
            console.error("Failed to fetch devices", error);
        }
    };

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
                    await fetchDevices();
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
            } else if (currentView === 'admin') {
                const resp = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
                console.log("Admin Users List:", resp.data.users);
                setUsersList(resp.data.users || []);
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

    const toggleStar = async (item: any, type: 'file' | 'folder') => {
        // Star logic not fully implemented in backend models yet, keeping UI state
        item.is_starred = !item.is_starred;
        setFiles([...files]);
        setFolders([...folders]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setShowNewMenu(false);
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        if (currentFolderId) {
            formData.append('folder_id', currentFolderId.toString());
        } else if (currentView === 'computers' && selectedDevice) {
            formData.append('device_id', selectedDevice.id.toString());
        }

        try {
            const token = localStorage.getItem('token');
            setUploadProgress({ active: true, percent: 0, fileName: file.name });

            await axios.post('/api/drive/upload', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent: any) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(prev => ({ ...prev, percent: percentCompleted }));
                }
            });

            // Animation for completion
            setUploadProgress(prev => ({ ...prev, percent: 100 }));
            setTimeout(() => setUploadProgress({ active: false, percent: 0, fileName: "" }), 1000);

            fetchDriveData();
        } catch (error: any) {
            setUploadProgress({ active: false, percent: 0, fileName: "" });
            if (error.response?.data?.error) {
                alert("Upload Gagal: " + error.response.data.error);
            } else {
                alert("Failed to upload file");
            }
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    const handleDeleteFile = async (id: number) => {
        if (!confirm("Are you sure you want to delete this file?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/drive/file/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            console.error("Failed to delete file", error);
            alert("Failed to delete file");
        }
    };

    const handleDeleteFolder = async (id: number) => {
        if (!confirm("Are you sure you want to delete this folder?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/drive/folder/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            console.error("Failed to delete folder", error);
            alert("Failed to delete folder");
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: any, type: 'file' | 'folder') => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            item,
            type
        });
    };

    const handleRestoreItem = async () => {
        if (!contextMenu.item || !contextMenu.type) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/drive/trash/${contextMenu.type}/${contextMenu.item.id}/restore`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error) {
            console.error("Failed to restore", error);
            alert("Failed to restore");
        }
    };

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
            const resp = await axios.post('/api/drive/doc/create', {
                name: name.trim(),
                type,
                folder_id: currentFolderId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            if (resp.data && resp.data.id && newTab) {
                newTab.location.href = `/editor/${resp.data.id}`;
            } else if (newTab) {
                newTab.close();
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

    const handleRenameMenu = async () => {
        if (!contextMenu.item || !contextMenu.type) return;
        const itemName = contextMenu.item.name;
        const newName = prompt("Rename to:", itemName);
        if (!newName || newName === itemName) return;

        try {
            const token = localStorage.getItem('token');
            const endpoint = `/api/drive/${contextMenu.type}/${contextMenu.item.id}/rename`;
            await axios.put(endpoint, { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
            setContextMenu({ ...contextMenu, visible: false });
        } catch (error) {
            console.error("Failed to rename", error);
            alert("Failed to rename");
        }
    };

    const handleShareMenu = () => {
        if (!contextMenu.item || !contextMenu.type) return;
        setShareModal({ visible: true, item: contextMenu.item, type: contextMenu.type });
        setContextMenu({ ...contextMenu, visible: false });
    };

    const submitShare = async (target: string) => {
        if (!shareModal.item || !shareModal.type) return;
        try {
            const token = localStorage.getItem('token');
            const resp = await axios.post(`/api/drive/share`, {
                id: shareModal.item.id,
                type: shareModal.type,
                shared_with: target
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(resp.data.message);
            setShareModal({ visible: false, item: null, type: null });
        } catch (error: any) {
            console.error("Failed to share", error);
            alert(error.response?.data?.error || "Failed to share item");
        }
    };

    const navigateToFolder = (id: number, name: string) => {
        setCurrentFolderId(id);
        setBreadcrumb([...breadcrumb, { id, name }]);
    };

    const navigateToDevice = (device: any) => {
        setSelectedDevice(device);
        setCurrentFolderId(null);
        setBreadcrumb([{ id: null, name: 'Computers' }, { id: 'device', name: device.name }]);
    };

    const navigateToBreadcrumb = (index: number) => {
        if (index === breadcrumb.length - 1) return;
        const target = breadcrumb[index];

        if (target.name === 'Computers' && target.id === null) {
            setSelectedDevice(null);
            setCurrentFolderId(null);
        } else if (target.id === 'device') {
            setCurrentFolderId(null);
        } else {
            setCurrentFolderId(target.id);
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
        { id: 'spam', icon: AlertCircle, label: 'Spam' },
        { id: 'trash', icon: Trash2, label: 'Trash' },
        ...((user?.role?.toLowerCase() === 'admin') ? [{ id: 'admin', icon: Shield, label: 'Admin Panel' }] : [])
    ];

    const handleAdminUpdateUser = async (email: string, newQuota?: number, is_active?: boolean) => {
        try {
            const token = localStorage.getItem('token');
            const data: any = {};
            if (newQuota !== undefined) data.quota = newQuota;
            if (is_active !== undefined) data.is_active = is_active;

            await axios.put(`/api/admin/user/${email}`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDriveData();
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message;
            alert(`Gagal update user: ${msg}\nPastikan anda menggunakan akun Admin dengan benar.`);
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon size={22} className="text-red-500" />;
        return <FileText size={22} className="text-blue-500" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

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
                        <img src={logo} alt="BaknusDrive logo" className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 mb-1 tracking-tight">BaknusDoc</span>
                    </div>
                    <button className="md:hidden p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setShowSidebar(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 mb-4 relative">
                    <button
                        onClick={() => setShowNewMenu(!showNewMenu)}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-2 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-medium w-36 dark:text-slate-200"
                    >
                        <Plus size={24} /> New
                    </button>

                    {/* New Menu Dropdown */}
                    {showNewMenu && (
                        <div className="absolute left-6 top-16 mt-2 w-64 bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-xl py-2 z-[60]">
                            <button onClick={handleCreateFolder} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <FolderPlus size={18} className="text-slate-600 dark:text-slate-400" /> New folder
                            </button>
                            <button onClick={() => { setShowNewMenu(false); setShowFormBuilder(true); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <ClipboardList size={18} className="text-indigo-600 dark:text-indigo-400" /> New Baknus Form
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                            <button onClick={() => handleCreateDoc('docx')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <FileText size={18} className="text-blue-600 dark:text-blue-400" /> Baknus Write (Doc)
                            </button>
                            <button onClick={() => handleCreateDoc('xlsx')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <FileSpreadsheet size={18} className="text-green-600 dark:text-green-400" /> Baknus Calc (Sheet)
                            </button>
                            <button onClick={() => handleCreateDoc('pptx')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <Presentation size={18} className="text-orange-600 dark:text-orange-400" /> Baknus Impress (Slide)
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                <Upload size={18} className="text-slate-600 dark:text-slate-400" /> File upload
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
                        <button className="hidden md:block p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><HelpCircle size={24} /></button>
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
                                        src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
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
                                                    src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
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
                    <div className="flex items-center text-xs text-slate-400 font-medium">
                        {breadcrumb.map((crumb: any, idx: number) => (
                            <React.Fragment key={idx}>
                                <button
                                    onClick={() => navigateToFolder(crumb.id, breadcrumb.slice(0, idx + 1))}
                                    className="hover:text-indigo-600 hover:underline transition-all"
                                >
                                    {crumb.name === 'My Drive' ? 'Beranda' : crumb.name}
                                </button>
                                {idx < breadcrumb.length - 1 && <ChevronRight size={12} className="mx-1 opacity-50" />}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
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
                    ) : (
                        <>
                            <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Type</button>
                            <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">People</button>
                            <button className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-[14px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Modified</button>
                        </>
                    )}
                </div>

                {/* File List Header */}
                {(viewMode === 'list' && currentView !== 'admin' && currentView !== 'forms') && (
                    <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-4 text-[13px] font-semibold text-slate-600 dark:text-slate-400 sticky top-0 bg-white dark:bg-slate-800 z-20">
                        <div className="col-span-12 md:col-span-6 flex items-center">Name</div>
                        <div className="col-span-2 hidden md:flex items-center">Owner</div>
                        <div className="col-span-2 hidden md:block">Date modified</div>
                        <div className="col-span-2 hidden md:block">File size</div>
                    </div>
                )}

                {/* File List Content */}
                <div className="flex-1 overflow-y-auto w-full relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <Loader2 size={32} className="animate-spin text-baknus-500" />
                        </div>
                    )}

                    {currentView === 'admin' ? (
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield className="text-blue-500" /> Admin Dashboard (User Management)</h2>

                            {/* Search and Filter */}
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Cari nama atau email pengguna..."
                                        value={searchUser}
                                        onChange={(e) => setSearchUser(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
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
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Pengguna</th>
                                            <th className="px-6 py-4 font-medium">Role</th>
                                            <th className="px-6 py-4 font-medium">Penyimpanan</th>
                                            <th className="px-6 py-4 font-medium">Status</th>
                                            <th className="px-6 py-4 font-medium text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {usersList
                                            .filter(u => roleFilter === 'Semua' || u.role === roleFilter)
                                            .filter(u => {
                                                const search = searchUser.toLowerCase();
                                                return (u.full_name || '').toLowerCase().includes(search) ||
                                                    (u.email || '').toLowerCase().includes(search);
                                            })
                                            .map((u) => (
                                                <tr key={u.id || u.email || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{u.full_name || u.email}</span>
                                                            <span className="text-sm text-slate-500">{u.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-1.5 w-32">
                                                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((u.used_space || 0) / (u.quota || 1)) * 100)}%` }}></div>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{formatSize(u.used_space || 0)} / {formatSize(u.quota)}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.is_active ? (
                                                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                                                <Check size={14} /> Aktif
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                                                <Lock size={14} /> Nonaktif
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setAdminTargetUser(u.id || u.email);
                                                                setCurrentView('admin-drive');
                                                                setBreadcrumb([{ id: null, name: `Drive: ${u.full_name || u.email}` }]);
                                                                setCurrentFolderId(null);
                                                            }}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 flex items-center gap-1"
                                                        >
                                                            <FolderIcon size={14} /> Lihat File
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setQuotaModal({ visible: true, user: u });
                                                                setTempQuotaGB((u.quota / (1024 * 1024 * 1024)).toString());
                                                            }}
                                                            className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 flex items-center gap-1"
                                                        >
                                                            <Database size={14} /> Quota
                                                        </button>
                                                        <button
                                                            onClick={() => handleAdminUpdateUser(u.id || u.email, undefined, !u.is_active)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'}`}
                                                        >
                                                            {u.is_active ? <UserX size={14} /> : <Unlock size={14} />} {u.is_active ? 'Matikan' : 'Aktifkan'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
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
                                                            {new Date(form.created_at).toLocaleDateString()}
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
                                <div className="p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                        <MonitorSmartphone className="text-blue-500" /> Computers
                                    </h2>
                                    {devices.length === 0 ? (
                                        <div className="bg-blue-50 dark:bg-slate-900/50 border border-blue-100 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center text-center">
                                            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mb-6">
                                                <MonitorSmartphone size={40} className="text-[#1a73e8]" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No computers syncing</h3>
                                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 text-[14px]">
                                                Folders on your computer that you sync with BaknusDrive will appear here.
                                            </p>
                                            <button
                                                onClick={() => window.open(`${window.location.origin}/downloads/clients/BaknusDrive-Setup.exe`, '_blank')}
                                                className="px-6 py-2.5 bg-[#1a73e8] text-white rounded-full font-medium hover:bg-blue-600 transition-colors shadow-sm text-sm"
                                            >
                                                Download BaknusDrive for Desktop
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {devices.map((device: any) => (
                                                <div key={device.id}
                                                    onClick={() => navigateToDevice(device)}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                                                            <MonitorSmartphone className="text-[#1a73e8] dark:text-blue-400" />
                                                        </div>
                                                        <span className="text-[12px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Online</span>
                                                    </div>
                                                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{device.name}</h4>
                                                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4">{device.os} • Last sync: {new Date(device.last_sync).toLocaleString()}</p>
                                                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                                                        <FolderIcon size={16} className="text-slate-400" />
                                                        <span className="text-[13px] text-slate-600 dark:text-slate-300">Folders Synced</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                            onClick={() => {
                                                // Close sidebar if navigating on mobile
                                                if (window.innerWidth < 768) setShowSidebar(false);
                                                navigateToFolder(f.id, f.name);
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, f, 'folder')}
                                            className="px-5 py-3 md:py-2 grid grid-cols-12 gap-4 items-center group cursor-pointer hover:bg-[#f3fbfa] dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-800 md:border-transparent last:border-none"
                                        >
                                            <div className="col-span-10 md:col-span-6 flex items-center gap-4">
                                                <div className="relative flex-shrink-0">
                                                    <FolderIcon size={22} fill="#5f6368" className="text-slate-500 dark:text-slate-400 border-none" />
                                                    {f.is_shared && (
                                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm">
                                                            <Users size={10} className="text-slate-600 dark:text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">{f.name}</span>
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
                                                {new Date(f.updated_at).toLocaleDateString()}
                                            </div>
                                            <div className="col-span-2 md:col-span-2 flex items-center justify-end md:justify-between text-[14px] text-slate-600 dark:text-slate-400 font-medium">
                                                <span className="hidden md:inline">—</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {currentView !== 'shared' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }} className="p-2 hover:bg-slate-200 rounded-full text-red-500" title="Delete folder">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={`folder-${f.id}`}
                                            onClick={() => {
                                                if (window.innerWidth < 768) setShowSidebar(false);
                                                navigateToFolder(f.id, f.name);
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, f, 'folder')}
                                            className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer group"
                                        >
                                            <div className="relative flex-shrink-0">
                                                <FolderIcon size={24} fill="#5f6368" className="text-slate-500 dark:text-slate-400 shadow-sm border-none" />
                                            </div>
                                            <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
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
                                            onDoubleClick={() => handlePreview(f)}
                                            onContextMenu={(e) => handleContextMenu(e, f, 'file')}
                                            className="px-5 py-3 md:py-2 grid grid-cols-12 gap-4 items-center group cursor-pointer hover:bg-[#f3fbfa] dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-800 md:border-transparent last:border-none"
                                        >
                                            <div className="col-span-10 md:col-span-6 flex items-center gap-4">
                                                <div className="relative flex-shrink-0">
                                                    {getFileIcon(f.mime_type)}
                                                    {f.is_shared && (
                                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-[1px] shadow-sm">
                                                            <Users size={10} className="text-slate-600 dark:text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                                                        {f.name}
                                                    </span>
                                                    {/* Mobile only subtitle */}
                                                    <span className="text-[12px] text-slate-400 md:hidden mt-0.5 truncate">
                                                        {formatSize(f.size)} • {new Date(f.created_at).toLocaleDateString()}
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
                                                {new Date(f.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="col-span-2 md:col-span-2 flex items-center justify-end md:justify-between text-[14px] text-slate-600 dark:text-slate-400 font-medium">
                                                <span className="hidden md:inline">{formatSize(f.size)}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {currentView === 'trash' ? (
                                                        <button onClick={(e) => { e.stopPropagation(); setContextMenu({ item: f, type: 'file', visible: false, x: 0, y: 0 }); handleRestoreItem(); }} className="p-2 hover:bg-slate-200 rounded-full text-green-500" title="Restore">
                                                            <RotateCcw size={18} />
                                                        </button>
                                                    ) : currentView === 'shared' ? (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.name); }} className="p-2 hover:bg-slate-200 rounded-full text-blue-500" title="Download">
                                                            <Download size={18} />
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.name); }} className="p-2 hover:bg-slate-200 rounded-full text-blue-500" title="Download">
                                                                <Download size={18} />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }} className="p-2 hover:bg-slate-200 rounded-full text-red-500" title="Delete">
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
                                            onDoubleClick={() => handlePreview(f)}
                                            onContextMenu={(e) => handleContextMenu(e, f, 'file')}
                                            className="flex flex-col bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer overflow-hidden group"
                                        >
                                            <div className="h-32 bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center p-4 border-b border-slate-200 dark:border-slate-700">
                                                <div className="transform scale-[2]">{getFileIcon(f.mime_type)}</div>
                                            </div>
                                            <div className="p-3 flex items-center gap-3">
                                                {getFileIcon(f.mime_type)}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
                                                </div>
                                                {f.is_shared && (
                                                    <Users size={12} className="text-slate-500 dark:text-slate-400 mr-1" />
                                                )}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Right Click Context Menu */}
                {contextMenu.visible && contextMenu.item && (
                    <div
                        className="fixed bg-white shadow-xl rounded-lg py-2 border border-slate-100 z-[100] min-w-[200px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {(contextMenu.type === 'file' || contextMenu.type === 'folder') && (
                            <>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-slate-700" onClick={() => {
                                    if (contextMenu.type === 'file') {
                                        handleDownloadFile(contextMenu.item.id, contextMenu.item.name)
                                    } else {
                                        handleDownloadFolder(contextMenu.item.id, contextMenu.item.name)
                                    }
                                }}>
                                    <Download size={16} className="text-slate-500" />
                                    Download
                                </button>
                                <div className="border-t border-slate-100 my-1"></div>
                            </>
                        )}
                        {currentView === 'trash' ? (
                            <button
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-green-600"
                                onClick={handleRestoreItem}
                            >
                                <RotateCcw size={16} className="text-green-500" />
                                Restore
                            </button>
                        ) : currentView === 'shared' ? (
                            null

                        ) : (
                            <>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-slate-700" onClick={handleShareMenu}>
                                    <Share2 size={16} className="text-slate-500" />
                                    Share
                                </button>
                                <div className="border-t border-slate-100 my-1"></div>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-slate-700" onClick={handleRenameMenu}>
                                    <Edit2 size={16} className="text-slate-500" />
                                    Rename
                                </button>
                                {contextMenu.type === 'file' && (
                                    <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-slate-700" onClick={() => alert("Make a copy is coming soon!")}>
                                        <Copy size={16} className="text-slate-500" />
                                        Make a copy
                                    </button>
                                )}
                                <div className="border-t border-slate-100 my-1"></div>
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-sm text-red-600"
                                    onClick={() => {
                                        contextMenu.type === 'file' ? handleDeleteFile(contextMenu.item.id) : handleDeleteFolder(contextMenu.item.id);
                                        setContextMenu({ ...contextMenu, visible: false });
                                    }}
                                >
                                    <Trash size={16} className="text-red-500" />
                                    Remove
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Share Modal */}
                {shareModal.visible && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200]">
                        <div className="bg-white rounded-3xl shadow-xl w-[550px] flex flex-col overflow-hidden max-h-[85vh]">
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-[20px] font-medium text-slate-800">Share "{shareModal.item?.name}"</h2>
                                    <p className="text-sm text-slate-500 mt-0.5">Berbagi file dengan siswa, guru, atau tenaga kependidikan</p>
                                </div>
                                <button onClick={() => setShareModal({ visible: false, item: null, type: null })} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                <label className="text-sm font-medium text-slate-700 mb-3 block">Bagikan cepat ke Tag / Role</label>
                                <div className="mb-8 flex gap-3">
                                    <button onClick={() => submitShare('ROLE:Guru')} className="flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium py-3 rounded-xl transition-all border border-teal-200 shadow-sm flex flex-col items-center gap-1">
                                        <Users size={20} className="mb-1" /> All Guru
                                    </button>
                                    <button onClick={() => submitShare('ROLE:Siswa')} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 rounded-xl transition-all border border-blue-200 shadow-sm flex flex-col items-center gap-1">
                                        <Users size={20} className="mb-1" /> All Siswa
                                    </button>
                                    <button onClick={() => submitShare('ROLE:TU')} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-3 rounded-xl transition-all border border-indigo-200 shadow-sm flex flex-col items-center gap-1">
                                        <Users size={20} className="mb-1" /> All TU
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">Atau bagikan ke orang spesifik</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Search size={18} className="text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Cari nama atau email..."
                                            value={searchUser}
                                            onChange={(e) => setSearchUser(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-[15px]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {usersList.filter(u => u.email.toLowerCase().includes(searchUser.toLowerCase()) || u.full_name?.toLowerCase().includes(searchUser.toLowerCase())).slice(0, 15).map(u => (
                                        <div key={u.email} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-slate-100 rounded-[16px] hover:shadow-md hover:border-slate-200 bg-white transition-all cursor-pointer" onClick={() => submitShare(u.email)}>
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex shrink-0 items-center justify-center font-bold text-lg shadow-sm">
                                                    {u.full_name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="font-semibold text-slate-800 text-[15px] truncate">{u.full_name || u.email}</span>
                                                    <span className="text-[13px] text-slate-500 truncate flex items-center gap-1">
                                                        {u.email} <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 mx-0.5"></span> <span className="font-medium text-slate-600">{u.role}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); submitShare(u.email); }}
                                                className="mt-3 sm:mt-0 text-[14px] font-medium bg-[#f0f4f9] hover:bg-[#e1e5ea] text-[#1f1f1f] px-5 py-2 rounded-full transition-colors shrink-0 flex items-center gap-1.5"
                                            >
                                                Bagikan
                                            </button>
                                        </div>
                                    ))}
                                </div>
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
                                    {getFileIcon(previewFile.mime_type)}
                                </div>
                                <span className="text-lg font-medium tracking-wide">{previewFile.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleDownloadFile(previewFile.id, previewFile.name)} className="p-2 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2 px-4 bg-white/10 mr-2">
                                    <Download size={20} /> <span className="text-sm font-medium">Download</span>
                                </button>
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
                                        <FileIcon size={64} className="text-white/80" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Tidak ada preview tersedia</h3>
                                    <p className="text-white/60 mb-6 leading-relaxed">Tipe file ini ({previewFile.mime_type || 'unknown'}) tidak dapat ditampilkan secara langsung pad browser Anda.</p>

                                    {/\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/i.test(previewFile.name) && (
                                        <p className="text-white/80 mb-8 text-[14px] bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                            ℹ️ <b>Informasi:</b> Dokumen dari Microsoft Office atau aplikasi Perkantoran sejenisnya memerlukan aplikasi khusus di Desktop / HP untuk dapat dirender. Oleh karena itu, Anda harus mengunduh file ini terlebih dahulu.
                                        </p>
                                    )}

                                    <button onClick={() => handleDownloadFile(previewFile.id, previewFile.name)} className="bg-blue-500 hover:bg-blue-600 px-8 py-3 rounded-full font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30">
                                        <Download size={20} /> Download File
                                    </button>
                                </div>
                            )}
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
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Ubah Kapasitas</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{quotaModal.user?.full_name || quotaModal.user?.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setQuotaModal({ visible: false, user: null })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 ml-1">Kapasitas Penyimpanan (GB)</label>
                                <div className="relative">
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
                                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                    💡 <b>Tips:</b> Kapasitas yang Anda masukkan akan langsung membatasi jumlah file yang dapat diupload oleh pengguna ini.
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
                                            handleAdminUpdateUser(quotaModal.user.id || quotaModal.user.email, Math.round(bytes));
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
                                                src={`https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`}
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
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setNewDocModal(prev => ({ ...prev, visible: false }))}>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 border border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                            {/* Icon & Title */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${newDocModal.type === 'docx' ? 'bg-blue-50 dark:bg-blue-900/30' : newDocModal.type === 'xlsx' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
                                    {newDocModal.type === 'docx' && <FileText size={28} className="text-blue-600 dark:text-blue-400" />}
                                    {newDocModal.type === 'xlsx' && <FileSpreadsheet size={28} className="text-green-600 dark:text-green-400" />}
                                    {newDocModal.type === 'pptx' && <Presentation size={28} className="text-orange-600 dark:text-orange-400" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                        {newDocModal.type === 'docx' ? 'Buat Dokumen Baru' : newDocModal.type === 'xlsx' ? 'Buat Spreadsheet Baru' : 'Buat Presentasi Baru'}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Masukkan nama file sebelum membuat</p>
                                </div>
                            </div>

                            {/* Input */}
                            <input
                                type="text"
                                value={newDocModal.name}
                                onChange={e => setNewDocModal(prev => ({ ...prev, name: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirmCreateDoc(); if (e.key === 'Escape') setNewDocModal(prev => ({ ...prev, visible: false })); }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-6 transition-all"
                                placeholder="Nama file..."
                                autoFocus
                                onFocus={e => e.target.select()}
                            />

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setNewDocModal(prev => ({ ...prev, visible: false }))}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleConfirmCreateDoc}
                                    disabled={!newDocModal.name.trim()}
                                    className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold shadow-sm transition-all ${newDocModal.type === 'docx' ? 'bg-blue-600 hover:bg-blue-700' : newDocModal.type === 'xlsx' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    Buat & Buka
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== END NEW DOC MODAL ===== */}

            </main>
        </div>
    );
}
