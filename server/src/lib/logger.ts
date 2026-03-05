// Structured logger — tagged, leveled, timestamp.
// Replaces raw console.log for production readiness.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_COLORS: Record<LogLevel, string> = {
    info: '\x1b[36m',   // cyan
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m',  // red
    debug: '\x1b[90m',  // gray
};
const RESET = '\x1b[0m';

function formatLog(level: LogLevel, tag: string, message: string, data?: unknown): string {
    const ts = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const base = `${color}[${level.toUpperCase()}]${RESET} ${ts} [${tag}] ${message}`;
    if (data !== undefined) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}

export function createLogger(tag: string) {
    return {
        info: (msg: string, data?: unknown) => console.log(formatLog('info', tag, msg, data)),
        warn: (msg: string, data?: unknown) => console.warn(formatLog('warn', tag, msg, data)),
        error: (msg: string, data?: unknown) => console.error(formatLog('error', tag, msg, data)),
        debug: (msg: string, data?: unknown) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(formatLog('debug', tag, msg, data));
            }
        },
    };
}

// Pre-built loggers for common tags
export const serverLog = createLogger('Server');
export const authLog = createLogger('Auth');
export const roomLog = createLogger('Room');
export const yjsLog = createLogger('Yjs');
export const execLog = createLogger('Exec');
export const cacheLog = createLogger('Cache');
