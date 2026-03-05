const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
    token?: string;
}

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
    const { token, ...fetchOpts } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOpts,
        headers,
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

export const api = {
    auth: {
        signup: (data: { email: string; username: string; password: string }) =>
            fetchAPI('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
        login: (data: { email: string; password: string }) =>
            fetchAPI('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
        me: (token: string) =>
            fetchAPI('/api/auth/me', { token }),
        updateProfile: (data: { username?: string; avatar?: string }, token: string) =>
            fetchAPI('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        changePassword: (data: { currentPassword: string; newPassword: string }, token: string) =>
            fetchAPI('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data), token }),
        activity: (token: string) =>
            fetchAPI('/api/auth/activity', { token }),
    },
    rooms: {
        list: (token: string) =>
            fetchAPI('/api/rooms', { token }),
        create: (data: { name: string; language: string; templateFiles?: { name: string; content: string; language: string }[] }, token: string) =>
            fetchAPI('/api/rooms', { method: 'POST', body: JSON.stringify(data), token }),
        get: (slug: string) =>
            fetchAPI(`/api/rooms/${slug}`),
        join: (slug: string, token: string, password?: string) =>
            fetchAPI(`/api/rooms/${slug}/join`, { method: 'POST', body: password ? JSON.stringify({ password }) : undefined, token }),
        update: (slug: string, data: { name?: string; language?: string; isPublic?: boolean }, token: string) =>
            fetchAPI(`/api/rooms/${slug}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        delete: (slug: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}`, { method: 'DELETE', token }),
        createFile: (slug: string, data: { name: string }, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files`, { method: 'POST', body: JSON.stringify(data), token }),
        updateFile: (slug: string, fileId: string, data: { content?: string; name?: string }, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}`, { method: 'PUT', body: JSON.stringify(data), token }),
        deleteFile: (slug: string, fileId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}`, { method: 'DELETE', token }),
        updateMemberRole: (slug: string, userId: string, role: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }), token }),
        kickMember: (slug: string, userId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/members/${userId}`, { method: 'DELETE', token }),
        fork: (slug: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/fork`, { method: 'POST', token }),
        messages: (slug: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/messages`, { token }),
        exportUrl: (slug: string) => `${API_URL}/api/rooms/${slug}/export`,
    },
    templates: {
        list: () => fetchAPI('/api/rooms/templates/list'),
    },
    versions: {
        list: (slug: string, fileId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/versions`, { token }),
        get: (slug: string, fileId: string, versionId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/versions/${versionId}`, { token }),
        restore: (slug: string, fileId: string, versionId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/versions/${versionId}/restore`, { method: 'POST', token }),
    },
    admin: {
        stats: (token: string) =>
            fetchAPI('/api/admin/stats', { token }),
        roomActivities: (slug: string, token: string) =>
            fetchAPI(`/api/admin/activities/${slug}`, { token }),
    },
    snippets: {
        list: (token: string) =>
            fetchAPI('/api/snippets', { token }),
        create: (data: { title: string; code: string; language?: string; tags?: string }, token: string) =>
            fetchAPI('/api/snippets', { method: 'POST', body: JSON.stringify(data), token }),
        update: (id: string, data: any, token: string) =>
            fetchAPI(`/api/snippets/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        delete: (id: string, token: string) =>
            fetchAPI(`/api/snippets/${id}`, { method: 'DELETE', token }),
    },
    comments: {
        list: (slug: string, fileId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/comments`, { token }),
        create: (slug: string, fileId: string, data: { content: string; line: number }, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/comments`, { method: 'POST', body: JSON.stringify(data), token }),
        resolve: (slug: string, fileId: string, commentId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/comments/${commentId}/resolve`, { method: 'PATCH', token }),
        delete: (slug: string, fileId: string, commentId: string, token: string) =>
            fetchAPI(`/api/rooms/${slug}/files/${fileId}/comments/${commentId}`, { method: 'DELETE', token }),
    },
    format: (data: { code: string; language: string }, token: string) =>
        fetchAPI('/api/format', { method: 'POST', body: JSON.stringify(data), token }),
    execute: async (data: { code: string; language: string; stdin?: string }) => {
        const response = await fetchAPI('/api/execute', { method: 'POST', body: JSON.stringify(data) });

        // If BullMQ queue returned a jobId, poll for result
        if (response.jobId && response.status === 'queued') {
            const maxPolls = 30; // 30 seconds max
            for (let i = 0; i < maxPolls; i++) {
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s
                const poll = await fetchAPI(`/api/execute/${response.jobId}`);
                if (poll.status === 'completed') {
                    return poll;
                } else if (poll.status === 'failed') {
                    return { stdout: '', stderr: poll.error || 'Execution failed', exitCode: 1, timedOut: false, executionTime: 0 };
                }
                // queued or active — keep polling
            }
            return { stdout: '', stderr: 'Execution timed out waiting for result', exitCode: 1, timedOut: true, executionTime: 30000 };
        }

        // Direct execution result (no queue)
        return response;
    },
};

export { API_URL };
