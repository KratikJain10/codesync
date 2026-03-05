import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, createRoomSchema, updateRoomSchema, createFileSchema } from '../middleware/validate';

const router = Router();

function generateSlug(): string {
    return uuidv4().split('-').slice(0, 2).join('-');
}

// POST /api/rooms — Create a room
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, language, isPublic, templateFiles } = req.body;

        // Build files to create — use template files if provided, otherwise default
        const filesToCreate = templateFiles && Array.isArray(templateFiles) && templateFiles.length > 0
            ? templateFiles.map((f: { name: string; content: string; language: string }) => ({
                name: f.name,
                content: f.content,
                language: f.language || detectLanguage(f.name),
            }))
            : [{
                name: `main.${getExtension(language || 'javascript')}`,
                content: getStarterCode(language || 'javascript'),
                language: language || 'javascript',
            }];

        const room = await prisma.room.create({
            data: {
                name: name || 'Untitled Room',
                slug: generateSlug(),
                language: language || 'javascript',
                isPublic: isPublic !== false,
                ownerId: req.userId!,
                members: {
                    create: { userId: req.userId!, role: 'OWNER' },
                },
                files: {
                    create: filesToCreate,
                },
            },
            include: { files: true, members: { include: { user: { select: { id: true, username: true, avatar: true } } } } },
        });

        res.status(201).json({ room });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// GET /api/rooms — List user's rooms
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const rooms = await prisma.room.findMany({
            where: {
                members: { some: { userId: req.userId! } },
            },
            include: {
                owner: { select: { id: true, username: true, avatar: true } },
                _count: { select: { members: true, files: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({ rooms });
    } catch (error) {
        console.error('List rooms error:', error);
        res.status(500).json({ error: 'Failed to list rooms' });
    }
});

// GET /api/rooms/:slug — Get room by slug
router.get('/:slug', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({
            where: { slug: slugParam },
            include: {
                files: { orderBy: { order: 'asc' } },
                owner: { select: { id: true, username: true, avatar: true } },
                members: {
                    include: { user: { select: { id: true, username: true, avatar: true } } },
                },
            },
        });

        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const { password: _pw, ...safeRoom } = room;
        res.json({ room: { ...safeRoom, hasPassword: !!room.password } });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Failed to get room' });
    }
});

// POST /api/rooms/:slug/join — Join a room
router.post('/:slug/join', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const existingMember = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId: req.userId!, roomId: room.id } },
        });

        if (existingMember) {
            res.json({ message: 'Already a member', role: existingMember.role });
            return;
        }

        // Password gate
        if (room.password) {
            const { password } = req.body;
            if (!password) {
                res.status(401).json({ error: 'This room requires a password', requiresPassword: true });
                return;
            }
            const valid = await bcrypt.compare(password, room.password);
            if (!valid) {
                res.status(401).json({ error: 'Incorrect room password', requiresPassword: true });
                return;
            }
        }

        await prisma.roomMember.create({
            data: { userId: req.userId!, roomId: room.id, role: 'EDITOR' },
        });

        res.json({ message: 'Joined room', role: 'EDITOR' });
    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ error: 'Failed to join room' });
    }
});

// GET /api/rooms/:slug/messages — Get chat history
router.get('/:slug/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

        const messages = await prisma.message.findMany({
            where: { roomId: room.id },
            include: { user: { select: { id: true, username: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
            take: 50,
        });
        res.json({ messages });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// POST /api/rooms/:slug/files — Create a file in room
router.post('/:slug/files', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, content, language } = req.body;
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({ where: { slug: slugParam } });

        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const file = await prisma.file.create({
            data: {
                name,
                content: content || '',
                language: language || detectLanguage(name),
                roomId: room.id,
            },
        });

        res.status(201).json({ file });
    } catch (error) {
        console.error('Create file error:', error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

// PUT /api/rooms/:slug/files/:fileId — Update file
router.put('/:slug/files/:fileId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, content } = req.body;

        const fileId = req.params.fileId as string;
        const file = await prisma.file.update({
            where: { id: fileId },
            data: {
                ...(name && { name }),
                ...(content !== undefined && { content }),
            },
        });

        res.json({ file });
    } catch (error) {
        console.error('Update file error:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

// DELETE /api/rooms/:slug/files/:fileId — Delete file
router.delete('/:slug/files/:fileId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const fileId = req.params.fileId as string;
        await prisma.file.delete({ where: { id: fileId } });
        res.json({ message: 'File deleted' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// PATCH /api/rooms/:slug — Update room settings
router.patch('/:slug', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
        if (room.ownerId !== req.userId) { res.status(403).json({ error: 'Only the owner can update room settings' }); return; }

        const { name, language, isPublic, password } = req.body;
        const updateData: any = {};
        if (name) updateData.name = name;
        if (language) updateData.language = language;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        if (password !== undefined) {
            if (password === null || password === '') {
                updateData.password = null;
            } else {
                const bcrypt = require('bcryptjs');
                updateData.password = await bcrypt.hash(password, 10);
            }
        }
        const updated = await prisma.room.update({
            where: { slug: slugParam },
            data: updateData,
        });
        res.json({ room: updated });
    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({ error: 'Failed to update room' });
    }
});

// DELETE /api/rooms/:slug — Delete room
router.delete('/:slug', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
        if (room.ownerId !== req.userId) { res.status(403).json({ error: 'Only the owner can delete room' }); return; }

        await prisma.message.deleteMany({ where: { roomId: room.id } });
        await prisma.file.deleteMany({ where: { roomId: room.id } });
        await prisma.roomMember.deleteMany({ where: { roomId: room.id } });
        await prisma.room.delete({ where: { id: room.id } });
        res.json({ message: 'Room deleted' });
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

// PUT /api/rooms/:slug/members/:userId — Change member role
router.put('/:slug/members/:userId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const targetUserId = req.params.userId as string;
        const { role } = req.body;

        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
        if (room.ownerId !== req.userId) { res.status(403).json({ error: 'Only the owner can change roles' }); return; }

        const member = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId: targetUserId, roomId: room.id } },
        });
        if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

        await prisma.roomMember.update({
            where: { userId_roomId: { userId: targetUserId, roomId: room.id } },
            data: { role },
        });
        res.json({ message: 'Role updated' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// DELETE /api/rooms/:slug/members/:userId — Kick member
router.delete('/:slug/members/:userId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;
        const targetUserId = req.params.userId as string;

        const room = await prisma.room.findUnique({ where: { slug: slugParam } });
        if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
        if (room.ownerId !== req.userId) { res.status(403).json({ error: 'Only the owner can kick members' }); return; }

        await prisma.roomMember.delete({
            where: { userId_roomId: { userId: targetUserId, roomId: room.id } },
        });
        res.json({ message: 'Member removed' });
    } catch (error) {
        console.error('Kick member error:', error);
        res.status(500).json({ error: 'Failed to kick member' });
    }
});

// POST /api/rooms/:slug/fork — Fork a room (copy with all files)
router.post('/:slug/fork', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const slugParam = req.params.slug as string;

        const sourceRoom = await prisma.room.findUnique({
            where: { slug: slugParam },
            include: { files: true },
        });

        if (!sourceRoom) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const newSlug = generateSlug();
        const forkedRoom = await prisma.room.create({
            data: {
                name: `Fork of ${sourceRoom.name}`,
                slug: newSlug,
                language: sourceRoom.language,
                ownerId: req.userId!,
                members: {
                    create: { userId: req.userId!, role: 'OWNER' },
                },
                files: {
                    create: sourceRoom.files.map((f, i) => ({
                        name: f.name,
                        content: f.content,
                        language: f.language,
                        order: i,
                    })),
                },
            },
            include: {
                files: true,
                members: {
                    include: { user: { select: { id: true, username: true, avatar: true } } }
                }
            },
        });

        res.status(201).json({ room: forkedRoom });
    } catch (error) {
        console.error('Fork room error:', error);
        res.status(500).json({ error: 'Failed to fork room' });
    }
});

// --- Helpers ---

function getExtension(language: string): string {
    const map: Record<string, string> = {
        javascript: 'js', typescript: 'ts', python: 'py',
        cpp: 'cpp', c: 'c', java: 'java', go: 'go',
        rust: 'rs', ruby: 'rb', php: 'php',
    };
    return map[language] || 'txt';
}

function detectLanguage(filename: string): string {
    const ext = filename.split('.').pop() || '';
    const map: Record<string, string> = {
        js: 'javascript', ts: 'typescript', py: 'python',
        cpp: 'cpp', c: 'c', java: 'java', go: 'go',
        rs: 'rust', rb: 'ruby', php: 'php', html: 'html',
        css: 'css', json: 'json', md: 'markdown',
    };
    return map[ext] || 'plaintext';
}

function getStarterCode(language: string): string {
    const starters: Record<string, string> = {
        javascript: '// Welcome to CodeSync!\nconsole.log("Hello, World!");\n',
        typescript: '// Welcome to CodeSync!\nconsole.log("Hello, World!");\n',
        python: '# Welcome to CodeSync!\nprint("Hello, World!")\n',
        cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
        java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
        go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
        rust: 'fn main() {\n    println!("Hello, World!");\n}\n',
    };
    return starters[language] || '// Start coding here\n';
}

// GET /api/templates — List available templates
router.get('/templates/list', async (_req: AuthRequest, res: Response): Promise<void> => {
    const templates = [
        {
            id: 'blank',
            name: 'Blank Project',
            icon: '📄',
            description: 'Start from scratch',
            language: 'javascript',
            files: [{ name: 'main.js', content: '// Start coding here\n', language: 'javascript' }],
        },
        {
            id: 'algorithm',
            name: 'Algorithm Practice',
            icon: '🧩',
            description: 'DSA problem solving template',
            language: 'javascript',
            files: [
                { name: 'solution.js', content: '/**\n * Problem: Two Sum\n * Given an array of integers nums and an integer target,\n * return indices of the two numbers that add up to target.\n */\n\nfunction twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}\n\n// Test\nconsole.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]\n', language: 'javascript' },
                { name: 'notes.md', content: '# Solution Notes\n\n## Approach\n- Hash Map approach: O(n) time, O(n) space\n\n## Edge Cases\n- Empty array\n- No solution exists\n- Duplicate values\n', language: 'markdown' },
            ],
        },
        {
            id: 'web-app',
            name: 'Web App',
            icon: '🌐',
            description: 'HTML + CSS + JS starter',
            language: 'html',
            files: [
                { name: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My App</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <div id="app">\n        <h1>Hello World! 🚀</h1>\n        <p>Edit this code and see live preview</p>\n    </div>\n    <script src="app.js"></script>\n</body>\n</html>\n', language: 'html' },
                { name: 'style.css', content: '* { margin: 0; padding: 0; box-sizing: border-box; }\n\nbody {\n    font-family: system-ui, sans-serif;\n    background: #0a0a0a;\n    color: #fff;\n    min-height: 100vh;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n}\n\n#app {\n    text-align: center;\n}\n\nh1 {\n    font-size: 3rem;\n    background: linear-gradient(135deg, #667eea, #764ba2);\n    -webkit-background-clip: text;\n    -webkit-text-fill-color: transparent;\n}\n\np { color: #888; margin-top: 1rem; }\n', language: 'css' },
                { name: 'app.js', content: '// App logic\ndocument.querySelector("h1").addEventListener("click", () => {\n    alert("Hello from CodeSync! 👋");\n});\n', language: 'javascript' },
            ],
        },
        {
            id: 'python-ds',
            name: 'Python Data Science',
            icon: '🐍',
            description: 'Python with data analysis starter',
            language: 'python',
            files: [
                { name: 'main.py', content: '# Data Analysis Starter\nimport json\nfrom collections import Counter\n\n# Sample data\ndata = [\n    {"name": "Alice", "age": 30, "city": "NYC"},\n    {"name": "Bob", "age": 25, "city": "SF"},\n    {"name": "Charlie", "age": 35, "city": "NYC"},\n    {"name": "Diana", "age": 28, "city": "LA"},\n    {"name": "Eve", "age": 32, "city": "NYC"},\n]\n\n# Analysis\ncities = Counter(p["city"] for p in data)\nprint("City distribution:", dict(cities))\n\navg_age = sum(p["age"] for p in data) / len(data)\nprint(f"Average age: {avg_age:.1f}")\n\nnyc_people = [p["name"] for p in data if p["city"] == "NYC"]\nprint(f"NYC residents: {nyc_people}")\n', language: 'python' },
            ],
        },
        {
            id: 'interview',
            name: 'Interview Prep',
            icon: '💼',
            description: 'System design & coding interview prep',
            language: 'javascript',
            files: [
                { name: 'problem.js', content: '/**\n * CODING INTERVIEW\n * ==================\n * Problem: \n * Approach: \n * Time Complexity: O(?)\n * Space Complexity: O(?)\n */\n\nfunction solve(input) {\n    // Your solution here\n    \n}\n\n// Test cases\nconsole.log(solve()); // expected: \n', language: 'javascript' },
                { name: 'notes.md', content: '# Interview Notes\n\n## Problem Understanding\n- Input: \n- Output: \n- Constraints: \n\n## Approach\n1. \n2. \n3. \n\n## Complexity\n- Time: \n- Space: \n\n## Follow-up Questions\n- \n', language: 'markdown' },
            ],
        },
        {
            id: 'rust-starter',
            name: 'Rust Starter',
            icon: '🦀',
            description: 'Rust with tests',
            language: 'rust',
            files: [
                { name: 'main.rs', content: 'fn main() {\n    let greeting = greet("World");\n    println!("{}", greeting);\n    \n    let nums = vec![1, 2, 3, 4, 5];\n    println!("Sum: {}", sum(&nums));\n}\n\nfn greet(name: &str) -> String {\n    format!("Hello, {}! 🦀", name)\n}\n\nfn sum(nums: &[i32]) -> i32 {\n    nums.iter().sum()\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn test_greet() {\n        assert_eq!(greet("Rust"), "Hello, Rust! 🦀");\n    }\n\n    #[test]\n    fn test_sum() {\n        assert_eq!(sum(&[1, 2, 3]), 6);\n        assert_eq!(sum(&[]), 0);\n    }\n}\n', language: 'rust' },
            ],
        },
        {
            id: 'react-component',
            name: 'React Component',
            icon: '⚛️',
            description: 'React JSX component starter',
            language: 'javascript',
            files: [
                { name: 'App.jsx', content: 'import React, { useState } from "react";\n\nexport default function App() {\n    const [count, setCount] = useState(0);\n\n    return (\n        <div className="app">\n            <h1>React + CodeSync ⚛️</h1>\n            <div className="card">\n                <button onClick={() => setCount(c => c + 1)}>\n                    Count is {count}\n                </button>\n            </div>\n            <p className="hint">Edit and see changes live</p>\n        </div>\n    );\n}\n', language: 'javascript' },
                { name: 'styles.css', content: '.app {\n    max-width: 1280px;\n    margin: 0 auto;\n    padding: 2rem;\n    text-align: center;\n}\n\n.card {\n    padding: 2em;\n}\n\nbutton {\n    border-radius: 8px;\n    border: 1px solid transparent;\n    padding: 0.6em 1.2em;\n    font-size: 1em;\n    font-weight: 500;\n    font-family: inherit;\n    background-color: #646cff;\n    color: #fff;\n    cursor: pointer;\n    transition: all 0.2s;\n}\n\nbutton:hover {\n    background-color: #535bf2;\n    transform: scale(1.05);\n}\n\n.hint {\n    color: #888;\n    margin-top: 1rem;\n}\n', language: 'css' },
            ],
        },
        {
            id: 'typescript-starter',
            name: 'TypeScript Starter',
            icon: '🔷',
            description: 'TypeScript with types and interfaces',
            language: 'typescript',
            files: [
                { name: 'main.ts', content: 'interface User {\n    id: number;\n    name: string;\n    email: string;\n    role: Role;\n}\n\nenum Role {\n    Admin = "ADMIN",\n    User = "USER",\n    Guest = "GUEST",\n}\n\nfunction greetUser(user: User): string {\n    return `Hello ${user.name} (${user.role})`;\n}\n\nfunction filterByRole<T extends { role: Role }>(items: T[], role: Role): T[] {\n    return items.filter(item => item.role === role);\n}\n\n// Demo\nconst users: User[] = [\n    { id: 1, name: "Alice", email: "alice@example.com", role: Role.Admin },\n    { id: 2, name: "Bob", email: "bob@example.com", role: Role.User },\n    { id: 3, name: "Charlie", email: "charlie@example.com", role: Role.User },\n];\n\nconsole.log(greetUser(users[0]));\nconsole.log("Users:", filterByRole(users, Role.User).map(u => u.name));\n', language: 'typescript' },
            ],
        },
        {
            id: 'go-starter',
            name: 'Go Starter',
            icon: '🐹',
            description: 'Go with basic HTTP server',
            language: 'go',
            files: [
                { name: 'main.go', content: 'package main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"log"\n\t"net/http"\n)\n\ntype Response struct {\n\tMessage string `json:"message"`\n\tStatus  int    `json:"status"`\n}\n\nfunc handler(w http.ResponseWriter, r *http.Request) {\n\tw.Header().Set("Content-Type", "application/json")\n\tresponse := Response{\n\t\tMessage: "Hello from Go! 🐹",\n\t\tStatus:  200,\n\t}\n\tjson.NewEncoder(w).Encode(response)\n}\n\nfunc main() {\n\thttp.HandleFunc("/", handler)\n\tfmt.Println("Server starting on :8080...")\n\tlog.Fatal(http.ListenAndServe(":8080", nil))\n}\n', language: 'go' },
            ],
        },
    ];

    res.json({ templates });
});

export default router;
