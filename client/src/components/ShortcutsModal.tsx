'use client';

import {
    Keyboard, X,
} from 'lucide-react';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcuts = [
    {
        category: 'General', items: [
            { keys: ['Ctrl', 'P'], action: 'Command Palette' },
            { keys: ['Ctrl', 'Shift', 'F'], action: 'Global Search' },
            { keys: ['Ctrl', 'B'], action: 'Toggle Sidebar' },
            { keys: ['Ctrl', '`'], action: 'Toggle Terminal' },
            { keys: ['?'], action: 'Keyboard Shortcuts' },
        ]
    },
    {
        category: 'Editor', items: [
            { keys: ['Ctrl', 'S'], action: 'Save File' },
            { keys: ['Ctrl', 'Z'], action: 'Undo' },
            { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
            { keys: ['Ctrl', '/'], action: 'Toggle Comment' },
            { keys: ['Ctrl', 'D'], action: 'Select Next Occurrence' },
            { keys: ['Alt', '↑/↓'], action: 'Move Line Up/Down' },
        ]
    },
    {
        category: 'Files', items: [
            { keys: ['Ctrl', 'N'], action: 'New File' },
            { keys: ['Double-click'], action: 'Rename File' },
        ]
    },
];

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <Keyboard size={20} /> Keyboard Shortcuts
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {shortcuts.map((group) => (
                    <div key={group.category} style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8
                        }}>
                            {group.category}
                        </div>
                        {group.items.map((item) => (
                            <div key={item.action} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 0', borderBottom: '1px solid var(--border)',
                            }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {item.action}
                                </span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {item.keys.map((key) => (
                                        <kbd key={key} style={{
                                            padding: '2px 8px',
                                            background: 'var(--bg-glass-light)',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'var(--font-mono)',
                                        }}>
                                            {key}
                                        </kbd>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
