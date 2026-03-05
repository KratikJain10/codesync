'use client';

import { useMemo } from 'react';

interface MarkdownPreviewProps {
    content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
    const html = useMemo(() => renderMarkdown(content), [content]);

    return (
        <div
            className="markdown-preview"
            style={{
                padding: 24,
                overflow: 'auto',
                height: '100%',
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function renderMarkdown(md: string): string {
    let html = md
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre style="background:var(--bg-glass);padding:16px;border-radius:8px;overflow-x:auto;font-family:var(--font-mono);font-size:13px;border:1px solid var(--border);margin:16px 0"><code>${escapeHtml(code.trim())}</code></pre>`)
        // Inline code
        .replace(/`([^`]+)`/g, '<code style="background:var(--bg-glass);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.9em">$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:700;margin:20px 0 8px;color:var(--text-primary)">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:1.3em;font-weight:700;margin:24px 0 10px;color:var(--text-primary);border-bottom:1px solid var(--border);padding-bottom:8px">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="font-size:1.6em;font-weight:800;margin:28px 0 12px;color:var(--text-primary)">$1</h1>')
        // Bold & italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--accent-secondary);text-decoration:underline" target="_blank" rel="noopener">$1</a>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style-type:disc">$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;list-style-type:decimal">$1</li>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-primary);padding:8px 16px;margin:12px 0;color:var(--text-secondary);background:var(--bg-glass);border-radius:0 6px 6px 0">$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:24px 0">')
        // Images
        .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0">')
        // Line breaks
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

    return html;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
