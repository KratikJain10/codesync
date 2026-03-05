'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Lock, RefreshCw } from 'lucide-react';

interface LivePreviewProps {
    htmlContent: string;
    cssContent: string;
    jsContent: string;
    isVisible: boolean;
}

export default function LivePreview({ htmlContent, cssContent, jsContent, isVisible }: LivePreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const updatePreview = useCallback(() => {
        if (!iframeRef.current) return;

        // Build full HTML document
        const fullHtml = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE')
            ? htmlContent
                .replace(
                    /<link\s+rel=["']stylesheet["']\s+href=["']style\.css["']\s*\/?>/gi,
                    `<style>${cssContent}</style>`
                )
                .replace(
                    /<script\s+src=["']app\.js["']\s*><\/script>/gi,
                    `<script>${jsContent}<\/script>`
                )
            : `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${cssContent}</style>
</head>
<body>
    ${htmlContent}
    <script>${jsContent}<\/script>
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframeRef.current.src = url;

        // Cleanup blob URL after load
        iframeRef.current.onload = () => URL.revokeObjectURL(url);
    }, [htmlContent, cssContent, jsContent]);

    useEffect(() => {
        if (!isVisible) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(updatePreview, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [htmlContent, cssContent, jsContent, isVisible, updatePreview]);

    if (!isVisible) return null;

    return (
        <div className="preview-pane">
            <div className="preview-pane-header">
                <span><Globe size={14} /></span>
                <div className="preview-pane-header-url">
                    <span><Lock size={12} /></span>
                    localhost:preview
                </div>
                <button
                    className="file-tree-action"
                    onClick={updatePreview}
                    title="Refresh preview"
                    style={{ fontSize: 14 }}
                >
                    <RefreshCw size={13} />
                </button>
            </div>
            <iframe
                ref={iframeRef}
                className="preview-iframe"
                sandbox="allow-scripts allow-modals"
                title="Live Preview"
            />
        </div>
    );
}
