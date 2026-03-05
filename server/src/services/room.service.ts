import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';

function generateSlug(): string {
    return uuidv4().split('-').slice(0, 2).join('-');
}

// ─── Create Room ────────────────────────────────────────────────────────

export async function createRoom(opts: {
    name: string;
    language: string;
    isPublic: boolean;
    password?: string;
    ownerId: string;
    templateFiles?: { name: string; content: string; language: string }[];
}) {
    const slug = generateSlug();
    const hashedPassword = opts.password ? await bcrypt.hash(opts.password, 10) : null;

    const room = await prisma.room.create({
        data: {
            name: opts.name,
            slug,
            language: opts.language,
            isPublic: opts.isPublic,
            password: hashedPassword,
            ownerId: opts.ownerId,
            members: {
                create: { userId: opts.ownerId, role: 'OWNER' },
            },
            files: {
                create: opts.templateFiles?.length
                    ? opts.templateFiles.map((f, i) => ({
                        name: f.name,
                        content: f.content,
                        language: f.language,
                        order: i,
                        path: `/${f.name}`,
                    }))
                    : [{
                        name: `main.${getExtension(opts.language)}`,
                        content: getStarterContent(opts.language),
                        language: opts.language,
                        path: `/main.${getExtension(opts.language)}`,
                    }],
            },
        },
        include: {
            files: true,
            members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
            owner: { select: { id: true, username: true, avatar: true } },
        },
    });

    return room;
}

// ─── Get Room ───────────────────────────────────────────────────────────

export async function getRoomBySlug(slug: string) {
    // Try cache first
    const cached = await cacheGet(`room:${slug}`);
    if (cached) return cached;

    const room = await prisma.room.findUnique({
        where: { slug },
        include: {
            files: { orderBy: { order: 'asc' } },
            members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
            owner: { select: { id: true, username: true, avatar: true } },
        },
    });

    if (room) {
        // Cache for 30 seconds
        await cacheSet(`room:${slug}`, { ...room, hasPassword: !!room.password, password: undefined }, 30);
    }

    return room;
}

// ─── Create Folder ──────────────────────────────────────────────────────

export async function createFolder(roomId: string, name: string, parentId?: string) {
    return prisma.file.create({
        data: {
            roomId,
            name,
            isFolder: true,
            path: parentId ? undefined : `/${name}`,
            parentId: parentId || null,
            language: 'folder',
            content: '',
        },
    });
}

// ─── Invalidate Room Cache ──────────────────────────────────────────────

export async function invalidateRoomCache(slug: string) {
    await cacheDel(`room:${slug}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getExtension(lang: string): string {
    const map: Record<string, string> = {
        javascript: 'js', typescript: 'ts', python: 'py', java: 'java',
        cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', html: 'html', css: 'css',
        ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt',
    };
    return map[lang] || 'txt';
}

function getStarterContent(lang: string): string {
    const starters: Record<string, string> = {
        javascript: '// Start coding here\nconsole.log("Hello, World!");\n',
        typescript: '// Start coding here\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n',
        python: '# Start coding here\nprint("Hello, World!")\n',
        java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
        go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
        rust: 'fn main() {\n    println!("Hello, World!");\n}\n',
    };
    return starters[lang] || '// Start coding here\n';
}
