import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execLog } from '../lib/logger';

// ─── Language Configs ───────────────────────────────────────────────────

export interface LanguageConfig {
    extension: string;
    image: string;           // Docker image
    command: (filename: string) => string;  // Run command inside container
}

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
    javascript: {
        extension: 'js',
        image: 'node:20-alpine',
        command: (f) => `node /code/${f}`,
    },
    typescript: {
        extension: 'ts',
        image: 'node:20-alpine',
        command: (f) => `npx -y ts-node /code/${f}`,
    },
    python: {
        extension: 'py',
        image: 'python:3.12-alpine',
        command: (f) => `python3 /code/${f}`,
    },
    cpp: {
        extension: 'cpp',
        image: 'gcc:13',
        command: (f) => `g++ -o /tmp/a.out /code/${f} && /tmp/a.out`,
    },
    c: {
        extension: 'c',
        image: 'gcc:13',
        command: (f) => `gcc -o /tmp/a.out /code/${f} && /tmp/a.out`,
    },
    java: {
        extension: 'java',
        image: 'openjdk:17-alpine',
        command: (_f) => `javac /code/Main.java && java -cp /code Main`,
    },
    go: {
        extension: 'go',
        image: 'golang:1.22-alpine',
        command: (f) => `go run /code/${f}`,
    },
    rust: {
        extension: 'rs',
        image: 'rust:1.77-alpine',
        command: (f) => `rustc -o /tmp/a.out /code/${f} && /tmp/a.out`,
    },
    ruby: {
        extension: 'rb',
        image: 'ruby:3.3-alpine',
        command: (f) => `ruby /code/${f}`,
    },
    php: {
        extension: 'php',
        image: 'php:8.3-alpine',
        command: (f) => `php /code/${f}`,
    },
};

// ─── Execution Result ───────────────────────────────────────────────────

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    executionTime: number;
    engine: 'docker' | 'local';
}

// ─── Docker Runner ──────────────────────────────────────────────────────

const MEMORY_LIMIT = process.env.EXEC_MEMORY_LIMIT || '50m';
const CPU_LIMIT = process.env.EXEC_CPU_LIMIT || '0.5';
const TIMEOUT_SECONDS = parseInt(process.env.EXEC_TIMEOUT_SECONDS || '10', 10);
const TIMEOUT_MS = TIMEOUT_SECONDS * 1000;

export async function runInDocker(
    code: string,
    language: string,
    stdin?: string
): Promise<ExecutionResult> {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
        throw new Error(`Unsupported language: ${language}`);
    }

    const executionId = uuidv4();
    const tmpDir = join('/tmp', `codesync-exec-${executionId}`);
    const filename = language === 'java' ? 'Main.java' : `main.${config.extension}`;

    try {
        mkdirSync(tmpDir, { recursive: true });
        writeFileSync(join(tmpDir, filename), code);

        // Build Docker command with resource limits
        const dockerCmd = [
            'docker run',
            '--rm',                           // Remove container after execution
            `--memory=${MEMORY_LIMIT}`,        // Memory cap (50MB)
            `--cpus=${CPU_LIMIT}`,             // CPU cap (0.5 cores)
            '--network=none',                  // No internet access
            '--read-only',                     // Read-only filesystem
            '--tmpfs /tmp:rw,noexec,size=10m', // Writable /tmp with limit
            `--stop-timeout=${TIMEOUT_SECONDS}`,
            `-v ${tmpDir}:/code:ro`,           // Mount code as read-only
            config.image,
            'sh', '-c', `"${config.command(filename)}"`,
        ].join(' ');

        execLog.info('Docker execution', { language, executionId });
        const result = await executeWithTimeout(dockerCmd, tmpDir, stdin, TIMEOUT_MS);
        return { ...result, engine: 'docker' };
    } finally {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

// ─── Local Fallback Runner ──────────────────────────────────────────────

const LOCAL_COMMANDS: Record<string, (f: string) => string> = {
    javascript: (f) => `/usr/local/bin/node ${f}`,
    typescript: (f) => `npx ts-node ${f}`,
    python: (f) => `/usr/bin/python3 ${f}`,
    cpp: (f) => `g++ -o /tmp/a.out ${f} && /tmp/a.out`,
    c: (f) => `gcc -o /tmp/a.out ${f} && /tmp/a.out`,
    java: (f) => { const dir = f.substring(0, f.lastIndexOf('/')); return `javac ${f} && java -cp ${dir} Main`; },
    go: (f) => `go run ${f}`,
    rust: (f) => `rustc -o /tmp/a.out ${f} && /tmp/a.out`,
};

export async function runLocally(
    code: string,
    language: string,
    stdin?: string
): Promise<ExecutionResult> {
    const cmdFn = LOCAL_COMMANDS[language];
    if (!cmdFn) throw new Error(`Unsupported language: ${language}`);

    const executionId = uuidv4();
    const tmpDir = join('/tmp', `codesync-exec-${executionId}`);
    const ext = LANGUAGE_CONFIGS[language]?.extension || 'txt';
    const filename = language === 'java' ? 'Main.java' : `main.${ext}`;
    const filepath = join(tmpDir, filename);

    try {
        mkdirSync(tmpDir, { recursive: true });
        writeFileSync(filepath, code);
        execLog.info('Local execution', { language, executionId });
        const result = await executeWithTimeout(cmdFn(filepath), tmpDir, stdin, TIMEOUT_MS);
        return { ...result, engine: 'local' };
    } finally {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

// ─── Check Docker Availability ──────────────────────────────────────────

let dockerAvailable: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
    if (dockerAvailable !== null) return dockerAvailable;

    return new Promise((resolve) => {
        exec('docker info', { timeout: 3000 }, (error) => {
            dockerAvailable = !error;
            if (dockerAvailable) {
                execLog.info('Docker available — using container execution');
            } else {
                execLog.warn('Docker unavailable — using local fallback');
            }
            resolve(dockerAvailable);
        });
    });
}

// ─── Execute Command with Timeout ───────────────────────────────────────

function executeWithTimeout(
    command: string,
    cwd: string,
    stdin?: string,
    timeout = TIMEOUT_MS
): Promise<Omit<ExecutionResult, 'engine'>> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        const child = exec(command, {
            cwd,
            timeout,
            maxBuffer: 1024 * 1024, // 1MB output
            shell: '/bin/sh',
            killSignal: 'SIGKILL',
        }, (error, stdout, stderr) => {
            if (resolved) return;
            resolved = true;
            const executionTime = Date.now() - startTime;
            const timedOut = error?.killed === true;

            resolve({
                stdout: (stdout || '').toString().slice(0, 10000),
                stderr: timedOut
                    ? `Execution timed out (${timeout / 1000}s limit)`
                    : (stderr || '').toString().slice(0, 10000),
                exitCode: error
                    ? (typeof error.code === 'number' ? error.code : 1)
                    : 0,
                timedOut,
                executionTime,
            });
        });

        // Safety kill — if exec() hangs beyond timeout + 2s, force resolve
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                try { child.kill('SIGKILL'); } catch { /* ignore */ }
                resolve({
                    stdout: '',
                    stderr: `Execution timed out (${timeout / 1000}s limit)`,
                    exitCode: 1,
                    timedOut: true,
                    executionTime: Date.now() - startTime,
                });
            }
        }, timeout + 2000);

        if (stdin && child.stdin) {
            child.stdin.write(stdin);
            child.stdin.end();
        }
    });
}
