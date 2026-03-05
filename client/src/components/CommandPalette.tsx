'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Terminal, PanelRight, FilePlus } from 'lucide-react';

interface CommandItem {
    id: string;
    label: string;
    icon: string | React.ReactNode;
    shortcut?: string;
    category: 'file' | 'command' | 'settings';
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    files: { id: string; name: string }[];
    onSwitchFile: (fileId: string) => void;
    onRunCode: () => void;
    onToggleTerminal: () => void;
    onTogglePanel: () => void;
    onNewFile: () => void;
    getFileIcon: (name: string) => string;
}

export default function CommandPalette({
    isOpen, onClose, files, onSwitchFile, onRunCode,
    onToggleTerminal, onTogglePanel, onNewFile, getFileIcon,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const commands: CommandItem[] = [
        { id: 'run', label: 'Run Code', icon: <Play size={14} />, shortcut: 'Ctrl+Enter', category: 'command', action: onRunCode },
        { id: 'terminal', label: 'Toggle Terminal', icon: <Terminal size={14} />, shortcut: 'Ctrl+`', category: 'command', action: onToggleTerminal },
        { id: 'panel', label: 'Toggle Panel', icon: <PanelRight size={14} />, shortcut: 'Ctrl+B', category: 'command', action: onTogglePanel },
        { id: 'newfile', label: 'New File', icon: <FilePlus size={14} />, shortcut: 'Ctrl+N', category: 'command', action: onNewFile },
    ];

    const allItems: CommandItem[] = [
        ...files.map(f => ({
            id: `file-${f.id}`,
            label: f.name,
            icon: getFileIcon(f.name),
            category: 'file' as const,
            action: () => onSwitchFile(f.id),
        })),
        ...commands,
    ];

    const filtered = query.trim()
        ? allItems.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase())
        )
        : allItems;

    const fileResults = filtered.filter(i => i.category === 'file');
    const commandResults = filtered.filter(i => i.category === 'command');

    const flatFiltered = [...fileResults, ...commandResults];

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatFiltered[selectedIndex]) {
                flatFiltered[selectedIndex].action();
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                <div className="command-palette-input">
                    <span className="command-palette-input-icon"><Search size={16} /></span>
                    <input
                        ref={inputRef}
                        placeholder="Search files and commands..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <div className="command-palette-results">
                    {fileResults.length > 0 && (
                        <>
                            <div className="command-palette-category">Files</div>
                            {fileResults.map((item, i) => {
                                const globalIdx = i;
                                return (
                                    <div
                                        key={item.id}
                                        className={`command-palette-item ${selectedIndex === globalIdx ? 'selected' : ''}`}
                                        onClick={() => { item.action(); onClose(); }}
                                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                                    >
                                        <span className="command-palette-item-icon">{item.icon}</span>
                                        <span className="command-palette-item-label">{item.label}</span>
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {commandResults.length > 0 && (
                        <>
                            <div className="command-palette-category">Commands</div>
                            {commandResults.map((item, i) => {
                                const globalIdx = fileResults.length + i;
                                return (
                                    <div
                                        key={item.id}
                                        className={`command-palette-item ${selectedIndex === globalIdx ? 'selected' : ''}`}
                                        onClick={() => { item.action(); onClose(); }}
                                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                                    >
                                        <span className="command-palette-item-icon">{item.icon}</span>
                                        <span className="command-palette-item-label">{item.label}</span>
                                        {item.shortcut && (
                                            <div className="command-palette-item-shortcut">
                                                {item.shortcut.split('+').map(k => (
                                                    <kbd key={k}>{k}</kbd>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {flatFiltered.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                            No results for &quot;{query}&quot;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
