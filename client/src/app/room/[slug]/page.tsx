'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { api, API_URL } from '@/lib/api';
import CommandPalette from '@/components/CommandPalette';
import LivePreview from '@/components/LivePreview';
import { useToast } from '@/components/Toast';
import ShortcutsModal from '@/components/ShortcutsModal';
import { useTheme } from '@/hooks/useTheme';
import NotificationBell, { useNotifications } from '@/components/NotificationBell';
import MarkdownPreview from '@/components/MarkdownPreview';
import {
    Zap, Play, Pause, Link2, ChevronRight, ChevronLeft,
    Plus, Search, X, Trash2, Copy, Check, Share2,
    FileText, FileCode, FileJson, File, FileCog,
    Terminal, Users, MessageSquare, Send, Wifi, WifiOff,
    Code2, Eye, SplitSquareHorizontal, ChevronDown,
    RefreshCw, Globe, Hash, Braces, GitBranch,
    Download, GitFork, Settings, SearchCode, Edit2, Wand2, Trash2 as TrashIcon, Lock, MessageCircle,
    CheckCircle2, CloudOff, Loader, Shield, Sun, Moon, Upload
} from 'lucide-react';

// Dynamic import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface FileData {
    id: string;
    name: string;
    content: string;
    language: string;
}

interface RoomData {
    id: string;
    name: string;
    slug: string;
    language: string;
    isPublic: boolean;
    files: FileData[];
    owner: { id: string; username: string };
    members: { user: { id: string; username: string; avatar: string | null }; role: string }[];
}

interface UserPresence {
    userId: string;
    username: string;
    color: string;
    activeFile?: string;
    cursorPosition?: { lineNumber: number; column: number };
    selection?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

interface ChatMessage {
    id: string;
    content: string;
    userId: string;
    username: string;
    color: string;
    timestamp: string;
}

interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    executionTime: number;
}

export default function RoomPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();
    const { user, token } = useAuth();
    const { toast } = useToast();

    const [room, setRoom] = useState<RoomData | null>(null);
    const [files, setFiles] = useState<FileData[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [openTabs, setOpenTabs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Collab state
    const [users, setUsers] = useState<UserPresence[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const yjsDocRef = useRef<any>(null);
    const isRemoteUpdate = useRef(false); // Guard against feedback loops
    const cursorDecorationsRef = useRef<string[]>([]); // Track Monaco decorations for remote cursors
    const cursorStyleRef = useRef<HTMLStyleElement | null>(null); // Dynamic CSS for cursor colors

    // Chat
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Terminal
    const [terminalOutput, setTerminalOutput] = useState<{ type: string; text: string }[]>([]);
    const [executing, setExecuting] = useState(false);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    // Editor
    const editorRef = useRef<any>(null);
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

    // New file
    const [showNewFile, setShowNewFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');

    // File rename
    const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Panel visibility
    const [showPanel, setShowPanel] = useState(true);
    const [showTerminal, setShowTerminal] = useState(false);

    // Share modal
    const [showShare, setShowShare] = useState(false);
    const [copied, setCopied] = useState(false);

    // Premium features
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [previewMode, setPreviewMode] = useState<'code' | 'split' | 'preview'>('code');
    const [isConnected, setIsConnected] = useState(false);

    // Settings & new features
    const [showSettings, setShowSettings] = useState(false);
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [editRoomName, setEditRoomName] = useState('');
    const [editRoomPublic, setEditRoomPublic] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [formatting, setFormatting] = useState(false);
    // Snippets
    const [showSnippets, setShowSnippets] = useState(false);
    const [snippets, setSnippets] = useState<any[]>([]);
    const [snippetTitle, setSnippetTitle] = useState('');
    const [snippetCode, setSnippetCode] = useState('');
    // Password prompt
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [joiningWithPassword, setJoiningWithPassword] = useState(false);
    // Inline comments
    const [comments, setComments] = useState<any[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [newCommentLine, setNewCommentLine] = useState<number | null>(null);
    const [newCommentContent, setNewCommentContent] = useState('');
    const { theme, toggleTheme } = useTheme();
    const [isDragOver, setIsDragOver] = useState(false);
    const { notifications, addNotification, markAllRead, clearAll, unreadCount } = useNotifications();
    const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<{ fileId: string; fileName: string; line: number; text: string }[]>([]);
    const globalSearchRef = useRef<HTMLInputElement>(null);

    // --- Load Room ---
    useEffect(() => {
        async function loadRoom() {
            try {
                const data = await api.rooms.get(slug);
                setRoom(data.room);
                setFiles(data.room.files);
                if (data.room.files.length > 0) {
                    const firstFile = data.room.files[0];
                    setActiveFileId(firstFile.id);
                    setOpenTabs([firstFile.id]);
                }

                // Join room if authenticated
                if (token) {
                    try {
                        await api.rooms.join(slug, token);
                    } catch (joinErr: any) {
                        if (joinErr?.message?.includes('password') || joinErr?.requiresPassword) {
                            setShowPasswordPrompt(true);
                            setLoading(false);
                            return;
                        }
                    }
                    // Load chat history
                    try {
                        const chatData = await api.rooms.messages(slug, token);
                        if (chatData.messages?.length) {
                            setMessages(chatData.messages.map((m: any) => ({
                                id: m.id,
                                content: m.content,
                                userId: m.user.id,
                                username: m.user.username,
                                avatar: m.user.avatar,
                                color: '#4ECDC4',
                                timestamp: m.createdAt,
                            })));
                        }
                    } catch { /* ignore if chat load fails */ }
                }
            } catch (err) {
                console.error('Failed to load room:', err);
            } finally {
                setLoading(false);
            }
        }
        loadRoom();
    }, [slug, token]);

    // --- Socket.io Connection ---
    useEffect(() => {
        if (!user || !room) return;

        const socket = io(API_URL, {
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join-room', {
                roomSlug: slug,
                userId: user.id,
                username: user.username,
                avatar: user.avatar,
            });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('room-users', (roomUsers: UserPresence[]) => {
            setUsers(roomUsers);
        });

        socket.on('user-joined', (presence: UserPresence) => {
            setUsers(prev => {
                if (prev.some(u => u.userId === presence.userId)) return prev;
                return [...prev, presence];
            });
            if (presence.userId !== user?.id) {
                toast(`${presence.username} joined the room`, 'info');
                addNotification('join', `${presence.username} joined the room`);
            }
        });

        socket.on('user-left', (data: { userId: string }) => {
            const leftUser = users.find(u => u.userId === data.userId);
            setUsers(prev => prev.filter(u => u.userId !== data.userId));
            if (leftUser && leftUser.userId !== user?.id) {
                toast(`${leftUser.username} left the room`, 'info');
                addNotification('info', `${leftUser.username} left the room`);
            }
        });

        socket.on('cursor-moved', (data: UserPresence & { socketId: string }) => {
            setUsers(prev => prev.map(u =>
                u.userId === data.userId ? { ...u, cursorPosition: data.cursorPosition, activeFile: data.activeFile, selection: data.selection } : u
            ));
        });

        socket.on('chat-message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });

        socket.on('file-created', (data: { file: FileData }) => {
            setFiles(prev => {
                if (prev.some(f => f.id === data.file.id)) return prev;
                return [...prev, data.file];
            });
        });

        socket.on('file-deleted', (data: { fileId: string }) => {
            setFiles(prev => prev.filter(f => f.id !== data.fileId));
            setOpenTabs(prev => prev.filter(id => id !== data.fileId));
        });

        socket.on('execution-started', (data: { language: string; username: string }) => {
            setTerminalOutput(prev => [...prev, { type: 'info', text: `▶ ${data.username} started running ${data.language}...` }]);
            setShowTerminal(true);
        });

        socket.on('execution-result', (result: ExecutionResult) => {
            setExecuting(false);
            const newOutput: { type: string; text: string }[] = [];
            if (result.stdout) newOutput.push({ type: 'stdout', text: result.stdout });
            if (result.stderr) newOutput.push({ type: 'stderr', text: result.stderr });
            newOutput.push({ type: 'timing', text: `Completed in ${result.executionTime}ms (exit code: ${result.exitCode})` });
            setTerminalOutput(prev => [...prev, ...newOutput]);
        });

        socketRef.current = socket;

        return () => {
            setIsConnected(false);
            socket.disconnect();
        };
    }, [user, room, slug]);

    // --- Yjs WebSocket for CRDT sync ---
    useEffect(() => {
        if (!activeFileId || !room) return;

        let ws: WebSocket;
        let yDoc: any;
        let cleanedUp = false;

        async function setupYjs() {
            const Y = await import('yjs');
            if (cleanedUp) return;

            yDoc = new Y.Doc();
            yjsDocRef.current = yDoc;

            const wsUrl = API_URL.replace('http', 'ws');
            ws = new WebSocket(`${wsUrl}/yjs/${slug}/${activeFileId}`);
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            const yText = yDoc.getText('content');
            let hasReceivedSync = false;

            ws.onopen = () => {
                // Send initial state vector to request missing updates
                const sv = Y.encodeStateVector(yDoc);
                ws.send(new Uint8Array([0, ...sv]));
            };

            ws.onmessage = (event) => {
                const data = new Uint8Array(event.data);
                const messageType = data[0];
                if (messageType === 0) {
                    const update = data.slice(1);
                    Y.applyUpdate(yDoc, update);
                }

                // After first sync message, check if we need to seed content
                if (!hasReceivedSync) {
                    hasReceivedSync = true;

                    const currentYjsContent = yText.toString();
                    const currentFileContent = files.find(f => f.id === activeFileId)?.content || '';

                    if (currentYjsContent === '' && currentFileContent) {
                        // Yjs doc is empty after sync — we're the first tab, seed with DB content
                        yDoc.transact(() => {
                            yText.insert(0, currentFileContent);
                        });
                        const update = Y.encodeStateAsUpdate(yDoc);
                        ws.send(new Uint8Array([0, ...update]));
                    }

                    // Set editor content from Yjs (which now has either synced or seeded content)
                    if (editorRef.current) {
                        const contentToSet = yText.toString() || currentFileContent;
                        if (contentToSet) {
                            isRemoteUpdate.current = true;
                            editorRef.current.setValue(contentToSet);
                            isRemoteUpdate.current = false;
                        }
                    }
                }
            };

            // When Yjs doc changes (from remote), sync to editor
            yText.observe(() => {
                const newContent = yText.toString();

                if (editorRef.current) {
                    const currentValue = editorRef.current.getValue();
                    if (currentValue !== newContent) {
                        isRemoteUpdate.current = true;
                        const selection = editorRef.current.getSelection();
                        editorRef.current.setValue(newContent);
                        if (selection) {
                            editorRef.current.setSelection(selection);
                        }
                        isRemoteUpdate.current = false;
                    }
                }
            });

            // Fallback: if WebSocket doesn't respond within 2s, set editor from DB
            setTimeout(() => {
                if (!hasReceivedSync && editorRef.current) {
                    const currentFileContent = files.find(f => f.id === activeFileId)?.content || '';
                    if (currentFileContent && editorRef.current.getValue() === '') {
                        isRemoteUpdate.current = true;
                        editorRef.current.setValue(currentFileContent);
                        isRemoteUpdate.current = false;
                    }
                }
            }, 2000);
        }

        setupYjs();

        return () => {
            cleanedUp = true;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            yjsDocRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFileId, room, slug]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-scroll terminal
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalOutput]);

    // Load comments for active file
    useEffect(() => {
        if (!activeFileId || !token || !slug) return;
        api.comments.list(slug as string, activeFileId, token)
            .then(res => setComments(res.comments || []))
            .catch(() => { });
    }, [activeFileId, token, slug]);

    // --- Remote Cursor Rendering ---
    useEffect(() => {
        if (!editorRef.current || !user) return;

        const editor = editorRef.current;
        const remoteUsers = users.filter(
            u => u.userId !== user.id && u.activeFile === activeFileId && u.cursorPosition
        );

        // Generate dynamic CSS for each user's cursor color
        if (!cursorStyleRef.current) {
            cursorStyleRef.current = document.createElement('style');
            document.head.appendChild(cursorStyleRef.current);
        }

        let cssRules = '';
        const decorations: any[] = [];

        remoteUsers.forEach((u) => {
            const safeId = u.userId.replace(/[^a-zA-Z0-9]/g, '_');

            // CSS for cursor line, name label (via ::after pseudo-element), and selection
            cssRules += `
                .remote-cursor-${safeId} {
                    border-left: 2px solid ${u.color} !important;
                    border-left-style: solid !important;
                }
                .remote-cursor-label-${safeId}::after {
                    content: '${u.username.replace(/'/g, "\\'")}';
                    background: ${u.color};
                    color: #fff;
                    font-size: 11px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    padding: 1px 6px;
                    border-radius: 3px 3px 3px 0;
                    position: absolute;
                    top: -18px;
                    left: 0;
                    white-space: nowrap;
                    pointer-events: none;
                    z-index: 200;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                }
                .remote-selection-${safeId} {
                    background: ${u.color}33 !important;
                    min-width: 4px;
                }
            `;

            // Cursor decoration — vertical colored line
            if (u.cursorPosition) {
                decorations.push({
                    range: {
                        startLineNumber: u.cursorPosition.lineNumber,
                        startColumn: u.cursorPosition.column,
                        endLineNumber: u.cursorPosition.lineNumber,
                        endColumn: u.cursorPosition.column + 1,
                    },
                    options: {
                        className: `remote-cursor-${safeId}`,
                        afterContentClassName: `remote-cursor-label-${safeId}`,
                        stickiness: 1,
                    },
                });
            }

            // Selection range decoration
            if (u.selection &&
                (u.selection.startLineNumber !== u.selection.endLineNumber ||
                    u.selection.startColumn !== u.selection.endColumn)) {
                decorations.push({
                    range: {
                        startLineNumber: u.selection.startLineNumber,
                        startColumn: u.selection.startColumn,
                        endLineNumber: u.selection.endLineNumber,
                        endColumn: u.selection.endColumn,
                    },
                    options: {
                        className: `remote-selection-${safeId}`,
                        stickiness: 1,
                    },
                });
            }
        });

        cursorStyleRef.current.textContent = cssRules;

        // Apply decorations using deltaDecorations
        cursorDecorationsRef.current = editor.deltaDecorations(
            cursorDecorationsRef.current,
            decorations
        );

        return () => {
            // Cleanup decorations when component unmounts or deps change
        };
    }, [users, activeFileId, user]);

    // Cleanup dynamic style on unmount
    useEffect(() => {
        return () => {
            if (cursorStyleRef.current) {
                cursorStyleRef.current.remove();
                cursorStyleRef.current = null;
            }
        };
    }, []);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        runCode();
                        break;
                    case 's':
                        e.preventDefault();
                        // Save current file
                        if (activeFileId && editorRef.current && token) {
                            const content = editorRef.current.getValue();
                            api.rooms.updateFile(slug, activeFileId, { content }, token).catch(console.error);
                        }
                        break;
                    case 'b':
                        e.preventDefault();
                        setShowPanel(prev => !prev);
                        break;
                    case '`':
                        e.preventDefault();
                        setShowTerminal(prev => !prev);
                        break;
                    case 'p':
                        e.preventDefault();
                        setShowCommandPalette(prev => !prev);
                        break;
                    case 'f':
                        if (e.shiftKey) {
                            e.preventDefault();
                            setShowGlobalSearch(prev => !prev);
                        }
                        break;
                }
            }
            // '?' key for shortcuts (only when not typing in input/editor)
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                const tag = (e.target as HTMLElement).tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    e.preventDefault();
                    setShowShortcuts(prev => !prev);
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    // --- Handlers ---
    const handleEditorChange = useCallback((value: string | undefined) => {
        // CRITICAL: Skip if this change was triggered by a remote Yjs update
        if (isRemoteUpdate.current) return;
        if (!value || !yjsDocRef.current) return;

        const Y = require('yjs');
        const yText = yjsDocRef.current.getText('content');
        const currentContent = yText.toString();

        if (currentContent !== value) {
            isRemoteUpdate.current = true; // Prevent observe → onChange loop
            yjsDocRef.current.transact(() => {
                yText.delete(0, currentContent.length);
                yText.insert(0, value);
            });
            isRemoteUpdate.current = false;

            // Broadcast update via WebSocket
            const update = Y.encodeStateAsUpdate(yjsDocRef.current);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(new Uint8Array([0, ...update]));
            }
        }

        // Update cursor position + selection
        if (editorRef.current && socketRef.current) {
            const position = editorRef.current.getPosition();
            const sel = editorRef.current.getSelection();
            if (position) {
                socketRef.current.emit('cursor-update', {
                    lineNumber: position.lineNumber,
                    column: position.column,
                    activeFile: activeFileId,
                    selection: sel ? {
                        startLineNumber: sel.startLineNumber,
                        startColumn: sel.startColumn,
                        endLineNumber: sel.endLineNumber,
                        endColumn: sel.endColumn,
                    } : undefined,
                });
            }
        }
        // Update local files array
        setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));

        // Auto-save with debounce
        setSaveStatus('unsaved');
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        autoSaveRef.current = setTimeout(async () => {
            if (token && activeFileId) {
                setSaveStatus('saving');
                try {
                    await api.rooms.updateFile(slug, activeFileId, { content: value }, token);
                    setSaveStatus('saved');
                } catch {
                    setSaveStatus('unsaved');
                }
            }
        }, 1500);
    }, [activeFileId, token, slug]);

    function handleEditorMount(editor: any) {
        editorRef.current = editor;

        // Set initial content from files
        const currentFile = files.find(f => f.id === activeFileId);
        if (currentFile) {
            isRemoteUpdate.current = true;
            editor.setValue(currentFile.content);
            isRemoteUpdate.current = false;
        }

        // Broadcast cursor position + selection on every cursor move
        editor.onDidChangeCursorPosition((e: any) => {
            if (socketRef.current) {
                const sel = editor.getSelection();
                socketRef.current.emit('cursor-update', {
                    lineNumber: e.position.lineNumber,
                    column: e.position.column,
                    activeFile: activeFileId,
                    selection: sel ? {
                        startLineNumber: sel.startLineNumber,
                        startColumn: sel.startColumn,
                        endLineNumber: sel.endLineNumber,
                        endColumn: sel.endColumn,
                    } : undefined,
                });
            }
        });

        // Also broadcast on selection change (drag select)
        editor.onDidChangeCursorSelection((e: any) => {
            if (socketRef.current) {
                const pos = editor.getPosition();
                socketRef.current.emit('cursor-update', {
                    lineNumber: pos?.lineNumber || 1,
                    column: pos?.column || 1,
                    activeFile: activeFileId,
                    selection: {
                        startLineNumber: e.selection.startLineNumber,
                        startColumn: e.selection.startColumn,
                        endLineNumber: e.selection.endLineNumber,
                        endColumn: e.selection.endColumn,
                    },
                });
            }
        });
    }

    function switchFile(fileId: string) {
        // Save current file content first
        if (activeFileId && editorRef.current) {
            const content = editorRef.current.getValue();
            setFiles(prev => prev.map(f =>
                f.id === activeFileId ? { ...f, content } : f
            ));
            // Persist to backend
            if (token) {
                api.rooms.updateFile(slug, activeFileId, { content }, token).catch(console.error);
            }
        }

        setActiveFileId(fileId);
        // Editor content will be set by the Yjs effect when activeFileId changes
        if (!openTabs.includes(fileId)) {
            setOpenTabs(prev => [...prev, fileId]);
        }
    }

    function closeTab(fileId: string) {
        setOpenTabs(prev => prev.filter(id => id !== fileId));
        if (activeFileId === fileId) {
            const remaining = openTabs.filter(id => id !== fileId);
            if (remaining.length > 0) {
                switchFile(remaining[remaining.length - 1]);
            } else {
                setActiveFileId(null);
                if (editorRef.current) {
                    isRemoteUpdate.current = true;
                    editorRef.current.setValue('');
                    isRemoteUpdate.current = false;
                }
            }
        }
    }

    async function createFile() {
        if (!newFileName.trim() || !token) return;
        try {
            const data = await api.rooms.createFile(slug, { name: newFileName.trim() }, token);
            const newFile = { ...data.file, content: '' };
            setFiles(prev => [...prev, newFile]);
            switchFile(data.file.id);
            // Explicitly clear editor for new empty file
            setTimeout(() => {
                if (editorRef.current) {
                    isRemoteUpdate.current = true;
                    editorRef.current.setValue(data.file.content || '');
                    isRemoteUpdate.current = false;
                }
            }, 100);
            setNewFileName('');
            setShowNewFile(false);
            socketRef.current?.emit('file-created', { file: data.file });
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteFile(fileId: string) {
        if (!token) return;
        if (files.length <= 1) return; // Don't delete last file
        try {
            await api.rooms.deleteFile(slug, fileId, token);
            setFiles(prev => prev.filter(f => f.id !== fileId));
            closeTab(fileId);
            socketRef.current?.emit('file-deleted', { fileId });
        } catch (err) {
            console.error(err);
        }
    }

    // --- Download project as ZIP ---
    function downloadProject() {
        if (!token) return;
        const url = api.rooms.exportUrl(slug);
        // Create a hidden link and click it to trigger download with auth
        const link = document.createElement('a');
        link.href = `${url}?token=${token}`;
        link.download = `${room?.name || 'project'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Fork room ---
    async function forkRoom() {
        if (!token) return;
        try {
            const data = await api.rooms.fork(slug, token);
            router.push(`/room/${data.room.slug}`);
        } catch (err) {
            console.error('Failed to fork room:', err);
        }
    }

    // --- Global search across files ---
    function performGlobalSearch(query: string) {
        setGlobalSearchQuery(query);
        if (!query.trim()) {
            setGlobalSearchResults([]);
            return;
        }
        const results: { fileId: string; fileName: string; line: number; text: string }[] = [];
        const q = query.toLowerCase();
        for (const file of files) {
            const lines = file.content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(q)) {
                    results.push({
                        fileId: file.id,
                        fileName: file.name,
                        line: i + 1,
                        text: lines[i].trim(),
                    });
                    if (results.length >= 100) break; // Cap at 100 results
                }
            }
            if (results.length >= 100) break;
        }
        setGlobalSearchResults(results);
    }

    // Focus global search input when opened
    useEffect(() => {
        if (showGlobalSearch) {
            setTimeout(() => globalSearchRef.current?.focus(), 50);
        }
    }, [showGlobalSearch]);

    async function runCode() {
        const activeFile = files.find(f => f.id === activeFileId);
        if (!activeFile || !editorRef.current) return;

        const code = editorRef.current.getValue();
        setExecuting(true);
        setShowTerminal(true);
        setTerminalOutput([{ type: 'info', text: `▶ Running ${activeFile.name}...` }]);

        socketRef.current?.emit('execution-started', { language: activeFile.language, filename: activeFile.name });

        try {
            const result = await api.execute({ code, language: activeFile.language });
            const newOutput: { type: string; text: string }[] = [];
            if (result.stdout) newOutput.push({ type: 'stdout', text: result.stdout });
            if (result.stderr) newOutput.push({ type: 'stderr', text: result.stderr });
            if (result.timedOut) newOutput.push({ type: 'stderr', text: '⏱ Execution timed out (10s limit)' });
            newOutput.push({ type: 'timing', text: `✓ Completed in ${result.executionTime}ms (exit code: ${result.exitCode})` });
            setTerminalOutput(prev => [...prev, ...newOutput]);
            socketRef.current?.emit('execution-result', result);
        } catch (err) {
            setTerminalOutput(prev => [...prev, { type: 'stderr', text: 'Execution failed' }]);
        } finally {
            setExecuting(false);
        }
    }

    function sendMessage() {
        if (!chatInput.trim() || !socketRef.current) return;
        socketRef.current.emit('chat-message', { content: chatInput.trim() });
        setChatInput('');
    }

    function copyShareLink() {
        const link = `${window.location.origin}/room/${slug}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function getFileIcon(name: string): React.ReactNode {
        const ext = name.split('.').pop() || '';
        const size = 14;
        const iconMap: Record<string, React.ReactNode> = {
            js: <FileCode size={size} style={{ color: '#f7df1e' }} />,
            ts: <FileCode size={size} style={{ color: '#3178c6' }} />,
            jsx: <FileCode size={size} style={{ color: '#61dafb' }} />,
            tsx: <FileCode size={size} style={{ color: '#3178c6' }} />,
            py: <FileCode size={size} style={{ color: '#3776ab' }} />,
            cpp: <FileCog size={size} style={{ color: '#00599c' }} />,
            c: <FileCog size={size} style={{ color: '#00599c' }} />,
            java: <FileCode size={size} style={{ color: '#f89820' }} />,
            go: <FileCode size={size} style={{ color: '#00add8' }} />,
            rs: <FileCog size={size} style={{ color: '#ce422b' }} />,
            html: <Globe size={size} style={{ color: '#e34c26' }} />,
            css: <Hash size={size} style={{ color: '#563d7c' }} />,
            json: <FileJson size={size} style={{ color: '#a8b1c2' }} />,
            md: <FileText size={size} style={{ color: '#519aba' }} />,
        };
        return iconMap[ext] || <File size={size} style={{ color: '#8b949e' }} />;
    }

    function getFileIconString(name: string): string {
        // Flat string version for CommandPalette (which expects string icons)
        const ext = name.split('.').pop() || '';
        const icons: Record<string, string> = {
            js: 'JS', ts: 'TS', py: 'PY', cpp: 'C+', c: 'C',
            java: 'JV', go: 'GO', rs: 'RS', html: '<>',
            css: '#', json: '{}', md: 'MD',
        };
        return icons[ext] || '···';
    }

    function getMonacoLanguage(lang: string): string {
        const map: Record<string, string> = {
            javascript: 'javascript', typescript: 'typescript', python: 'python',
            cpp: 'cpp', c: 'c', java: 'java', go: 'go', rust: 'rust',
            html: 'html', css: 'css', json: 'json', markdown: 'markdown',
            plaintext: 'plaintext',
        };
        return map[lang] || 'plaintext';
    }

    // Live preview helpers
    const isWebProject = files.some(f => f.name.endsWith('.html'));
    const htmlFile = files.find(f => f.name.endsWith('.html'));
    const cssFile = files.find(f => f.name.endsWith('.css'));
    const jsFile = files.find(f => f.name.endsWith('.js'));

    function getPreviewContent() {
        const getContent = (file: FileData | undefined) => {
            if (!file) return '';
            if (file.id === activeFileId && editorRef.current) return editorRef.current.getValue();
            return file.content;
        };
        return {
            html: getContent(htmlFile),
            css: getContent(cssFile),
            js: getContent(jsFile),
        };
    }

    // --- Render ---
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg" />
                <p>Loading room...</p>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="loading-screen">
                <p style={{ marginBottom: 16, opacity: 0.4 }}><FileText size={48} /></p>
                <p>Room not found</p>
                <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 16 }}>
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const activeFile = files.find(f => f.id === activeFileId);
    const cursorLine = editorRef.current?.getPosition()?.lineNumber || 1;
    const cursorCol = editorRef.current?.getPosition()?.column || 1;
    const previewContent = getPreviewContent();

    return (
        <div className={`workspace with-statusbar ${!showPanel ? 'panel-collapsed' : ''}`}>
            {/* Header */}
            <header className="workspace-header">
                <div className="workspace-header-left">
                    <Link href="/dashboard" className="workspace-header-logo">
                        <div className="workspace-header-logo-icon"><Zap size={18} /></div>
                        CodeSync
                    </Link>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <span className="workspace-room-name">{room.name}</span>
                </div>

                <div className="workspace-header-right">
                    {/* Preview mode toggle (only for web projects) */}
                    {isWebProject && (
                        <div className="preview-mode-toggle">
                            <button
                                className={`preview-mode-btn ${previewMode === 'code' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('code')}
                            >
                                <Code2 size={12} /> Code
                            </button>
                            <button
                                className={`preview-mode-btn ${previewMode === 'split' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('split')}
                            >
                                <SplitSquareHorizontal size={12} /> Split
                            </button>
                            <button
                                className={`preview-mode-btn ${previewMode === 'preview' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('preview')}
                            >
                                <Eye size={12} /> Preview
                            </button>
                        </div>
                    )}

                    {/* Online users */}
                    <div className="user-avatars">
                        {users.map((u) => (
                            <div
                                key={u.userId}
                                className="user-avatar-small"
                                style={{ backgroundColor: u.color }}
                                title={u.username}
                            >
                                {u.username.charAt(0).toUpperCase()}
                                <span className="user-avatar-tooltip">{u.username}</span>
                            </div>
                        ))}
                    </div>

                    {/* Run button */}
                    <button
                        className={`run-btn ${executing ? 'running' : ''}`}
                        onClick={runCode}
                        disabled={executing || !activeFile}
                    >
                        {executing ? <Pause size={14} /> : <Play size={14} />} {executing ? 'Running...' : 'Run'}
                    </button>

                    {/* Format Code */}
                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={async () => {
                            if (!activeFile || !token || formatting) return;
                            setFormatting(true);
                            try {
                                const langMap: Record<string, string> = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', html: 'html', css: 'css', json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml' };
                                const ext = activeFile.name.split('.').pop() || '';
                                const lang = langMap[ext] || 'javascript';
                                const res = await api.format({ code: activeFile.content || '', language: lang }, token);
                                if (res.formatted) {
                                    setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content: res.formatted } : f));
                                    toast('Code formatted!', 'success');
                                }
                            } catch (err: any) {
                                toast(err.message || 'Format failed', 'error');
                            } finally {
                                setFormatting(false);
                            }
                        }}
                        title="Format code (Prettier)"
                        disabled={!activeFile || formatting}
                    >
                        <Wand2 size={16} />
                    </button>

                    {/* Comments toggle */}
                    <button
                        className={`btn btn-secondary btn-icon ${showComments ? 'active' : ''}`}
                        onClick={() => setShowComments(!showComments)}
                        title="Inline comments"
                        style={showComments ? { background: 'var(--accent)', color: '#fff' } : {}}
                    >
                        <MessageCircle size={16} />
                        {comments.length > 0 && (
                            <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--accent)', color: '#fff', fontSize: 9, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {comments.length}
                            </span>
                        )}
                    </button>

                    {/* Share button */}
                    <button className="btn btn-secondary btn-icon" onClick={() => setShowShare(true)} title="Share">
                        <Share2 size={16} />
                    </button>

                    {/* Download ZIP */}
                    <button className="btn btn-secondary btn-icon" onClick={downloadProject} title="Download project as ZIP">
                        <Download size={16} />
                    </button>

                    {/* Fork */}
                    <button className="btn btn-secondary btn-icon" onClick={forkRoom} title="Fork this room">
                        <GitFork size={16} />
                    </button>

                    <button className="btn btn-secondary btn-icon" onClick={() => { setEditRoomName(room?.name || ''); setEditRoomPublic(room?.isPublic ?? false); setConfirmDelete(false); setShowSettings(true); }} title="Room settings">
                        <Settings size={16} />
                    </button>

                    {/* Theme toggle */}
                    <button className="btn btn-secondary btn-icon" onClick={toggleTheme} title="Toggle theme">
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

                    {/* Notifications */}
                    <NotificationBell
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAllRead={markAllRead}
                        onClearAll={clearAll}
                    />

                    {/* Toggle panel */}
                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => setShowPanel(!showPanel)}
                        title={showPanel ? 'Hide panel' : 'Show panel'}
                    >
                        {showPanel ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>
            </header>

            {/* Sidebar - File Tree */}
            <aside className="workspace-sidebar">
                <div className="file-tree-header">
                    <h3>Explorer</h3>
                    <div className="file-tree-actions">
                        <button className="file-tree-action" onClick={async () => {
                            setShowSnippets(true);
                            if (token) {
                                try {
                                    const res = await api.snippets.list(token);
                                    setSnippets(res.snippets || []);
                                } catch { }
                            }
                        }} title="Snippets">
                            <Braces size={14} />
                        </button>
                        <button className="file-tree-action" onClick={() => setShowCommandPalette(true)} title="Command Palette (Ctrl+P)">
                            <Search size={14} />
                        </button>
                        <button className="file-tree-action" onClick={() => setShowNewFile(true)} title="New File">
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                {showNewFile && (
                    <div className="new-file-input">
                        <input
                            placeholder="filename.js"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') createFile();
                                if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
                            }}
                            autoFocus
                        />
                    </div>
                )}

                <div
                    className="file-tree-list"
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (!token) return;
                        const droppedFiles = Array.from(e.dataTransfer.files);
                        for (const file of droppedFiles) {
                            try {
                                const content = await file.text();
                                const created = await api.rooms.createFile(slug, { name: file.name }, token);
                                if (created?.file) {
                                    await api.rooms.updateFile(slug, created.file.id, { content }, token);
                                    setFiles(prev => [...prev, { ...created.file, content }]);
                                    toast(`Uploaded ${file.name}`);
                                }
                            } catch { toast(`Failed to upload ${file.name}`); }
                        }
                    }}
                    style={isDragOver ? { outline: '2px dashed var(--accent)', outlineOffset: -2, background: 'rgba(108,92,231,0.08)' } : {}}
                >
                    {files.map(file => (
                        <div
                            key={file.id}
                            className={`file-tree-item ${activeFileId === file.id ? 'active' : ''}`}
                            onClick={() => switchFile(file.id)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setRenamingFileId(file.id);
                                setRenameValue(file.name);
                            }}
                        >
                            <span className="file-tree-item-icon">{getFileIcon(file.name)}</span>
                            {renamingFileId === file.id ? (
                                <input
                                    className="file-tree-item-name"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && renameValue.trim() && token) {
                                            try {
                                                await api.rooms.updateFile(slug, file.id, { name: renameValue.trim() }, token);
                                                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: renameValue.trim() } : f));
                                            } catch { /* ignore */ }
                                            setRenamingFileId(null);
                                        } else if (e.key === 'Escape') {
                                            setRenamingFileId(null);
                                        }
                                    }}
                                    onBlur={() => setRenamingFileId(null)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    style={{
                                        background: 'var(--bg-glass-light)',
                                        border: '1px solid var(--accent)',
                                        borderRadius: 3,
                                        color: 'var(--text-primary)',
                                        fontSize: 13,
                                        padding: '1px 4px',
                                        width: '100%',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <span className="file-tree-item-name">{file.name}</span>
                            )}
                            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                                <button
                                    className="file-tree-item-delete"
                                    onClick={(e) => { e.stopPropagation(); setRenamingFileId(file.id); setRenameValue(file.name); }}
                                    title="Rename file"
                                    style={{ opacity: 0.5 }}
                                >
                                    <Edit2 size={11} />
                                </button>
                                {files.length > 1 && (
                                    <button
                                        className="file-tree-item-delete"
                                        onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                                        title="Delete file"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Editor Area */}
            <main className="workspace-editor">
                {/* Tabs */}
                <div className="file-tabs">
                    {openTabs.map(tabId => {
                        const file = files.find(f => f.id === tabId);
                        if (!file) return null;
                        return (
                            <div
                                key={tabId}
                                className={`file-tab ${activeFileId === tabId ? 'active' : ''}`}
                                onClick={() => switchFile(tabId)}
                            >
                                <span>{getFileIcon(file.name)}</span>
                                <span>{file.name}</span>
                                <button
                                    className="file-tab-close"
                                    onClick={(e) => { e.stopPropagation(); closeTab(tabId); }}
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Breadcrumbs */}
                {activeFile && (
                    <div className="breadcrumbs">
                        <span className="breadcrumb-item" onClick={() => { }}><Zap size={12} /> {room.name}</span>
                        <span className="breadcrumb-sep"><ChevronRight size={10} /></span>
                        <span className="breadcrumb-item active">{getFileIcon(activeFile.name)} {activeFile.name}</span>
                        {activeFile.name.endsWith('.md') && (
                            <button
                                className={`btn btn-secondary`}
                                style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setShowMarkdownPreview(prev => !prev)}
                            >
                                <Eye size={12} /> {showMarkdownPreview ? 'Code' : 'Preview'}
                            </button>
                        )}
                    </div>
                )}

                {/* Editor + Live Preview Container */}
                <div className={`editor-preview-container ${previewMode === 'split' ? 'split' : ''}`}>
                    {/* Editor Pane */}
                    {previewMode !== 'preview' && (
                        <div className="editor-pane">
                            {activeFile ? (
                                activeFile.name.endsWith('.md') && showMarkdownPreview ? (
                                    <MarkdownPreview content={activeFile.content || ''} />
                                ) : (
                                    <MonacoEditor
                                        height="100%"
                                        language={getMonacoLanguage(activeFile.language)}
                                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                                        onChange={handleEditorChange}
                                        onMount={handleEditorMount}
                                        options={{
                                            fontSize: 14,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            fontLigatures: true,
                                            minimap: { enabled: true, scale: 2 },
                                            scrollBeyondLastLine: false,
                                            renderWhitespace: 'selection',
                                            cursorBlinking: 'smooth',
                                            cursorSmoothCaretAnimation: 'on',
                                            smoothScrolling: true,
                                            wordWrap: 'on',
                                            bracketPairColorization: { enabled: true },
                                            padding: { top: 12 },
                                            lineNumbers: 'on',
                                            renderLineHighlight: 'all',
                                            automaticLayout: true,
                                            suggest: { showWords: true },
                                        }}
                                    />
                                )
                            ) : (
                                <div className="editor-empty-state">
                                    <div className="editor-empty-state-icon"><FileCode size={48} style={{ color: 'var(--text-muted)' }} /></div>
                                    <h3>Select a file to start editing</h3>
                                    <p>Pick a file from the explorer or use keyboard shortcuts to navigate</p>
                                    <div className="editor-empty-shortcuts">
                                        <div className="editor-empty-shortcut">
                                            <kbd style={{ padding: '2px 6px', background: 'var(--bg-glass-light)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border)' }}>Ctrl+P</kbd>
                                            Search files
                                        </div>
                                        <div className="editor-empty-shortcut">
                                            <kbd style={{ padding: '2px 6px', background: 'var(--bg-glass-light)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border)' }}>Ctrl+N</kbd>
                                            New file
                                        </div>
                                        <div className="editor-empty-shortcut">
                                            <kbd style={{ padding: '2px 6px', background: 'var(--bg-glass-light)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border)' }}>Ctrl+Enter</kbd>
                                            Run code
                                        </div>
                                        <div className="editor-empty-shortcut">
                                            <kbd style={{ padding: '2px 6px', background: 'var(--bg-glass-light)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border)' }}>Ctrl+B</kbd>
                                            Toggle panel
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Live Preview Pane */}
                    {isWebProject && previewMode !== 'code' && (
                        <LivePreview
                            htmlContent={previewContent.html}
                            cssContent={previewContent.css}
                            jsContent={previewContent.js}
                            isVisible={true}
                        />
                    )}
                </div>

                {/* Terminal */}
                {showTerminal && (
                    <div className="terminal-container">
                        <div className="terminal-header">
                            <h3>
                                <span className={`terminal-status ${executing ? 'running' : terminalOutput.some(o => o.type === 'stderr') ? 'error' : 'success'}`} />
                                Terminal
                            </h3>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="file-tree-action" onClick={() => setTerminalOutput([])} title="Clear">
                                    <Trash2 size={13} />
                                </button>
                                <button className="file-tree-action" onClick={() => setShowTerminal(false)} title="Close">
                                    <X size={13} />
                                </button>
                            </div>
                        </div>
                        <div className="terminal-output">
                            {terminalOutput.map((line, i) => (
                                <div key={i} className={line.type}>{line.text}</div>
                            ))}
                            {executing && (
                                <div className="info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="spinner" /> Executing...
                                </div>
                            )}
                            <div ref={terminalEndRef} />
                        </div>
                    </div>
                )}
            </main>

            {/* Right Panel - Presence & Chat */}
            {showPanel && (
                <aside className="workspace-panel">
                    {/* Online Users */}
                    <div className="presence-section">
                        <h3>Online — {users.length}</h3>
                        <div className="presence-users">
                            {users.map(u => (
                                <div key={u.userId} className="presence-user">
                                    <div className="presence-avatar" style={{ backgroundColor: u.color }}>
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="presence-user-info">
                                        <div className="presence-user-name">{u.username}</div>
                                        {u.activeFile && (
                                            <div className="presence-user-file">
                                                {files.find(f => f.id === u.activeFile)?.name || ''}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {users.length === 0 && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 8px' }}>
                                    No other users online
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="chat-section">
                        <div className="chat-section-header">
                            <h3>Chat</h3>
                        </div>
                        <div className="chat-messages">
                            {messages.length === 0 && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                                    No messages yet. Start the conversation.
                                </div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} className="chat-message">
                                    <div className="chat-message-header">
                                        <span className="chat-message-user" style={{ color: msg.color }}>
                                            {msg.username}
                                        </span>
                                        <span className="chat-message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="chat-message-content">{msg.content}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input-wrapper">
                            <input
                                className="chat-input"
                                placeholder="Type a message..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            />
                        </div>
                    </div>
                </aside>
            )}

            {/* Status Bar */}
            <div className="status-bar">
                <div className="status-bar-left">
                    <div className="status-bar-item">
                        <span className={`status-bar-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <div className="status-bar-item">
                        <GitBranch size={12} /> {room.language}
                    </div>
                    {activeFile && (
                        <div className="status-bar-item">
                            {getFileIcon(activeFile.name)} {activeFile.name}
                        </div>
                    )}
                </div>
                <div className="status-bar-right">
                    <div className="status-bar-item" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {saveStatus === 'saved' && <><CheckCircle2 size={12} style={{ color: '#22c55e' }} /> Saved</>}
                        {saveStatus === 'saving' && <><Loader size={12} style={{ color: '#f59e0b' }} className="spinner" /> Saving...</>}
                        {saveStatus === 'unsaved' && <><CloudOff size={12} style={{ color: '#ef4444' }} /> Unsaved</>}
                    </div>
                    <div className="status-bar-item">
                        Ln {cursorLine}, Col {cursorCol}
                    </div>
                    <div className="status-bar-item">
                        {activeFile?.language || 'Plain Text'}
                    </div>
                    <div className="status-bar-item">
                        UTF-8
                    </div>
                    <div className="status-bar-item">
                        <Users size={12} /> {users.length} online
                    </div>
                </div>
            </div>

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                files={files}
                onSwitchFile={switchFile}
                onRunCode={runCode}
                onToggleTerminal={() => setShowTerminal(prev => !prev)}
                onTogglePanel={() => setShowPanel(prev => !prev)}
                onNewFile={() => setShowNewFile(true)}
                getFileIcon={getFileIconString}
            />

            {/* Share Modal */}
            {showShare && (
                <div className="modal-overlay" onClick={() => setShowShare(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Share Room</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                            Share this link with your collaborators:
                        </p>

                        {/* Role selector */}
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Shield size={14} /> Invite as:
                            </label>
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
                                style={{
                                    background: 'var(--bg-glass-light)', border: '1px solid var(--border)',
                                    borderRadius: 6, color: 'var(--text-primary)', padding: '6px 12px',
                                    fontSize: 13, cursor: 'pointer', outline: 'none'
                                }}
                            >
                                <option value="EDITOR">Editor — Can edit code</option>
                                <option value="VIEWER">Viewer — Read only</option>
                            </select>
                        </div>

                        <div className="share-link">
                            <input
                                readOnly
                                value={typeof window !== 'undefined' ? `${window.location.origin}/room/${slug}?role=${inviteRole.toLowerCase()}` : ''}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button className="btn btn-primary" onClick={copyShareLink}>
                                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                            </button>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowShare(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => { setShowSettings(false); setConfirmDelete(false); }}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                        <h2><Settings size={18} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Room Settings</h2>

                        <div style={{ marginTop: 16 }}>
                            <div className="input-group" style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Room Name</label>
                                <input
                                    className="input"
                                    value={editRoomName}
                                    onChange={(e) => setEditRoomName(e.target.value)}
                                    placeholder="Room name"
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Language</label>
                                <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{room?.language}</div>
                            </div>
                            <div className="input-group" style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Room Slug</label>
                                <code style={{ fontSize: 13, color: 'var(--accent)', background: 'var(--bg-glass-light)', padding: '4px 8px', borderRadius: 4 }}>{slug}</code>
                            </div>
                            <div className="input-group" style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Visibility</label>
                                <button
                                    className={`btn ${editRoomPublic ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setEditRoomPublic(!editRoomPublic)}
                                    style={{ fontSize: 13 }}
                                >
                                    <Globe size={14} /> {editRoomPublic ? 'Public' : 'Private'}
                                </button>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={14} /> Members ({room?.members?.length || 0})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(room?.members || []).map((member: any) => (
                                    <div key={member.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 12px', background: 'var(--bg-glass-light)', borderRadius: 6, border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600
                                            }}>
                                                {member.user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: 13 }}>{member.user.username}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{
                                                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                                background: member.role === 'OWNER' ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-glass-light)',
                                                color: member.role === 'OWNER' ? 'var(--accent)' : 'var(--text-secondary)',
                                                fontWeight: 500
                                            }}>
                                                {member.role}
                                            </span>
                                            {room?.owner?.id === user?.id && member.role !== 'OWNER' && (
                                                <>
                                                    <button
                                                        style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                                        title={member.role === 'EDITOR' ? 'Demote to Viewer' : 'Promote to Editor'}
                                                        onClick={async () => {
                                                            if (!token) return;
                                                            const newRole = member.role === 'EDITOR' ? 'VIEWER' : 'EDITOR';
                                                            try {
                                                                await api.rooms.updateMemberRole(slug as string, member.user.id, newRole, token);
                                                                setRoom((prev: any) => prev ? {
                                                                    ...prev,
                                                                    members: prev.members.map((m: any) =>
                                                                        m.user.id === member.user.id ? { ...m, role: newRole } : m
                                                                    )
                                                                } : prev);
                                                                toast(`${member.user.username} → ${newRole}`);
                                                            } catch { toast('Failed to update role', 'error'); }
                                                        }}
                                                    >
                                                        {member.role === 'EDITOR' ? '↓' : '↑'}
                                                    </button>
                                                    <button
                                                        style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                                        title="Remove member"
                                                        onClick={async () => {
                                                            if (!token) return;
                                                            try {
                                                                await api.rooms.kickMember(slug as string, member.user.id, token);
                                                                setRoom((prev: any) => prev ? {
                                                                    ...prev,
                                                                    members: prev.members.filter((m: any) => m.user.id !== member.user.id)
                                                                } : prev);
                                                                toast(`Removed ${member.user.username}`);
                                                            } catch { toast('Failed to remove', 'error'); }
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: 20, justifyContent: 'space-between' }}>
                            <div>
                                {!confirmDelete ? (
                                    <button className="btn btn-secondary" onClick={() => setConfirmDelete(true)} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                                        <TrashIcon size={14} /> Delete Room
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        style={{ background: '#ef4444' }}
                                        onClick={async () => {
                                            if (!token) return;
                                            try {
                                                await api.rooms.delete(slug as string, token);
                                                toast('Room deleted', 'success');
                                                router.push('/dashboard');
                                            } catch (err: any) { toast(err.message || 'Delete failed', 'error'); }
                                        }}
                                    >
                                        Confirm Delete
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary" onClick={() => { setShowSettings(false); setConfirmDelete(false); }}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    disabled={savingSettings}
                                    onClick={async () => {
                                        if (!token) return;
                                        setSavingSettings(true);
                                        try {
                                            const res = await api.rooms.update(slug as string, { name: editRoomName || undefined, isPublic: editRoomPublic }, token);
                                            if (res.room) {
                                                setRoom((prev: any) => ({ ...prev, name: res.room.name, isPublic: res.room.isPublic }));
                                                toast('Settings saved!', 'success');
                                                setShowSettings(false);
                                            }
                                        } catch (err: any) { toast(err.message || 'Save failed', 'error'); }
                                        finally { setSavingSettings(false); }
                                    }}
                                >
                                    {savingSettings ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Comments Panel */}
            {showComments && (
                <div style={{
                    position: 'fixed', right: 0, top: 48, bottom: 0, width: 320,
                    background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)',
                    zIndex: 90, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MessageCircle size={14} /> Comments ({comments.length})
                        </h3>
                        <button className="btn btn-secondary btn-icon" onClick={() => setShowComments(false)} style={{ padding: 4 }}>✕</button>
                    </div>

                    {/* Add comment form */}
                    <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input
                                className="input"
                                type="number"
                                placeholder="Line #"
                                value={newCommentLine ?? ''}
                                onChange={(e) => setNewCommentLine(e.target.value ? parseInt(e.target.value) : null)}
                                style={{ width: 70, fontSize: 12 }}
                                min={1}
                            />
                            <input
                                className="input"
                                placeholder="Add a comment..."
                                value={newCommentContent}
                                onChange={(e) => setNewCommentContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newCommentLine && newCommentContent.trim() && token && activeFileId) {
                                        api.comments.create(slug as string, activeFileId, { content: newCommentContent, line: newCommentLine }, token)
                                            .then(res => {
                                                if (res.comment) {
                                                    setComments(prev => [...prev, res.comment]);
                                                    setNewCommentContent('');
                                                    setNewCommentLine(null);
                                                    toast('Comment added!');
                                                }
                                            })
                                            .catch(() => toast('Failed to add comment', 'error'));
                                    }
                                }}
                                style={{ flex: 1, fontSize: 12 }}
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', fontSize: 12, padding: '6px 0' }}
                            disabled={!newCommentLine || !newCommentContent.trim()}
                            onClick={() => {
                                if (!token || !activeFileId || !newCommentLine) return;
                                api.comments.create(slug as string, activeFileId, { content: newCommentContent, line: newCommentLine }, token)
                                    .then(res => {
                                        if (res.comment) {
                                            setComments(prev => [...prev, res.comment]);
                                            setNewCommentContent('');
                                            setNewCommentLine(null);
                                            toast('Comment added!');
                                        }
                                    })
                                    .catch(() => toast('Failed to add comment', 'error'));
                            }}
                        >
                            Add Comment
                        </button>
                    </div>

                    {/* Comment list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                        {comments.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 12 }}>
                                No comments on this file yet.
                            </div>
                        ) : comments.map((c: any) => (
                            <div key={c.id} style={{
                                padding: 10, marginBottom: 6, borderRadius: 6,
                                background: c.resolved ? 'rgba(34,197,94,0.08)' : 'var(--bg-glass-light)',
                                border: `1px solid ${c.resolved ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                                opacity: c.resolved ? 0.7 : 1,
                                cursor: 'pointer'
                            }}
                                onClick={() => {
                                    if (editorRef.current) {
                                        editorRef.current.revealLineInCenter(c.line);
                                        editorRef.current.setPosition({ lineNumber: c.line, column: 1 });
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.user?.username || 'User'}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>L{c.line}</span>
                                </div>
                                <div style={{ fontSize: 12, textDecoration: c.resolved ? 'line-through' : 'none' }}>{c.content}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <button
                                        style={{ fontSize: 10, color: c.resolved ? '#22c55e' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!token || !activeFileId) return;
                                            api.comments.resolve(slug as string, activeFileId, c.id, token)
                                                .then(res => {
                                                    setComments(prev => prev.map(x => x.id === c.id ? { ...x, resolved: res.comment.resolved } : x));
                                                })
                                                .catch(() => { });
                                        }}
                                    >
                                        {c.resolved ? '↩ Reopen' : '✓ Resolve'}
                                    </button>
                                    <button
                                        style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!token || !activeFileId) return;
                                            api.comments.delete(slug as string, activeFileId, c.id, token)
                                                .then(() => setComments(prev => prev.filter(x => x.id !== c.id)))
                                                .catch(() => { });
                                        }}
                                    >
                                        ✕ Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                                background: 'rgba(108, 92, 231, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Lock size={24} style={{ color: 'var(--accent)' }} />
                            </div>
                            <h2 style={{ marginBottom: 4 }}>Room Protected</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>This room requires a password to join.</p>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!token || !roomPassword.trim()) return;
                            setJoiningWithPassword(true);
                            try {
                                await api.rooms.join(slug as string, token, roomPassword);
                                setShowPasswordPrompt(false);
                                setRoomPassword('');
                                toast('Joined room!', 'success');
                                // Reload to fully initialize
                                window.location.reload();
                            } catch (err: any) {
                                toast(err.message || 'Incorrect password', 'error');
                            } finally {
                                setJoiningWithPassword(false);
                            }
                        }}>
                            <input
                                className="input"
                                type="password"
                                placeholder="Enter room password"
                                value={roomPassword}
                                onChange={(e) => setRoomPassword(e.target.value)}
                                autoFocus
                                style={{ marginBottom: 12 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.push('/dashboard')}>
                                    Go Back
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={joiningWithPassword || !roomPassword.trim()}>
                                    {joiningWithPassword ? 'Joining...' : 'Join Room'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Snippets Panel */}
            {showSnippets && (
                <div className="modal-overlay" onClick={() => setShowSnippets(false)}>
                    <div className="modal" style={{ maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                        <h2><Braces size={18} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Code Snippets</h2>

                        {/* Create snippet form */}
                        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-glass-light)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <input
                                className="input"
                                placeholder="Snippet title"
                                value={snippetTitle}
                                onChange={(e) => setSnippetTitle(e.target.value)}
                                style={{ marginBottom: 8 }}
                            />
                            <textarea
                                className="input"
                                placeholder="Paste code here..."
                                value={snippetCode}
                                onChange={(e) => setSnippetCode(e.target.value)}
                                rows={4}
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                            />
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: 8, width: '100%' }}
                                disabled={!snippetTitle.trim() || !snippetCode.trim()}
                                onClick={async () => {
                                    if (!token) return;
                                    try {
                                        const lang = activeFile?.name.split('.').pop() || 'text';
                                        const res = await api.snippets.create({ title: snippetTitle, code: snippetCode, language: lang }, token);
                                        if (res.snippet) {
                                            setSnippets(prev => [res.snippet, ...prev]);
                                            setSnippetTitle('');
                                            setSnippetCode('');
                                            toast('Snippet saved!', 'success');
                                        }
                                    } catch (err: any) { toast(err.message || 'Save failed', 'error'); }
                                }}
                            >
                                <Plus size={14} /> Save Snippet
                            </button>
                        </div>

                        {/* Snippet list */}
                        <div style={{ marginTop: 16, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {snippets.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
                                    No snippets yet. Save code above to build your library.
                                </div>
                            ) : snippets.map((s: any) => (
                                <div key={s.id} style={{
                                    padding: 12, background: 'var(--bg-glass-light)', borderRadius: 8,
                                    border: '1px solid var(--border)', position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</span>
                                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                                            {s.language || 'text'}
                                        </span>
                                    </div>
                                    <pre style={{
                                        fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                                        maxHeight: 80, overflow: 'hidden', margin: 0, whiteSpace: 'pre-wrap'
                                    }}>{s.code}</pre>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: 11, padding: '4px 10px' }}
                                            onClick={() => {
                                                if (editorRef.current) {
                                                    const editor = editorRef.current;
                                                    const pos = editor.getPosition();
                                                    if (pos) {
                                                        editor.executeEdits('snippets', [{
                                                            range: { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column },
                                                            text: s.code,
                                                        }]);
                                                    }
                                                    setShowSnippets(false);
                                                    toast('Snippet inserted!');
                                                }
                                            }}
                                        >
                                            Insert
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 11, padding: '4px 10px', color: '#ef4444' }}
                                            onClick={async () => {
                                                if (!token) return;
                                                try {
                                                    await api.snippets.delete(s.id, token);
                                                    setSnippets(prev => prev.filter(x => x.id !== s.id));
                                                    toast('Snippet deleted');
                                                } catch { toast('Delete failed', 'error'); }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-actions" style={{ marginTop: 16 }}>
                            <button className="btn btn-secondary" onClick={() => setShowSnippets(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Search Panel (Ctrl+Shift+F) */}
            {showGlobalSearch && (
                <div className="modal-overlay" onClick={() => setShowGlobalSearch(false)}>
                    <div className="command-palette" style={{ maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
                        <div className="command-palette-input">
                            <span className="command-palette-input-icon"><SearchCode size={16} /></span>
                            <input
                                ref={globalSearchRef}
                                placeholder="Search across all files..."
                                value={globalSearchQuery}
                                onChange={(e) => performGlobalSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setShowGlobalSearch(false); }}
                            />
                        </div>
                        <div className="command-palette-results">
                            {globalSearchResults.length > 0 ? (
                                <>
                                    <div className="command-palette-category">
                                        {globalSearchResults.length} result{globalSearchResults.length !== 1 ? 's' : ''} in {new Set(globalSearchResults.map(r => r.fileId)).size} file{new Set(globalSearchResults.map(r => r.fileId)).size !== 1 ? 's' : ''}
                                    </div>
                                    {globalSearchResults.map((result, i) => (
                                        <div
                                            key={`${result.fileId}-${result.line}-${i}`}
                                            className="command-palette-item"
                                            onClick={() => {
                                                switchFile(result.fileId);
                                                setShowGlobalSearch(false);
                                                // Navigate to line after a brief delay for editor to mount
                                                setTimeout(() => {
                                                    if (editorRef.current) {
                                                        editorRef.current.revealLineInCenter(result.line);
                                                        editorRef.current.setPosition({ lineNumber: result.line, column: 1 });
                                                        editorRef.current.focus();
                                                    }
                                                }, 100);
                                            }}
                                        >
                                            <span className="command-palette-item-icon">{getFileIconString(result.fileName)}</span>
                                            <span style={{ flex: 1, overflow: 'hidden' }}>
                                                <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{result.fileName}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>:{result.line}</span>
                                                <div style={{
                                                    fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2
                                                }}>
                                                    {result.text}
                                                </div>
                                            </span>
                                        </div>
                                    ))}
                                </>
                            ) : globalSearchQuery.trim() ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                                    No results for &quot;{globalSearchQuery}&quot;
                                </div>
                            ) : (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                    Type to search across all files in this room
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts */}
            <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </div>
    );
}

