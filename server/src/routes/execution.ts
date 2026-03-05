import { Router, Request, Response } from 'express';
import { runInDocker, runLocally, isDockerAvailable, LANGUAGE_CONFIGS } from '../execution/DockerRunner';
import { initExecutionQueue, submitJob, getJobResult, getQueue } from '../execution/ExecutionQueue';
import { execLog } from '../lib/logger';

const router = Router();

// Try to initialize BullMQ queue (requires Redis)
const queueEnabled = initExecutionQueue();

// ─── POST /api/execute — Submit code for execution ──────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { code, language, stdin } = req.body;

    if (!code || !language) {
        res.status(400).json({ error: 'Code and language are required' });
        return;
    }

    if (!LANGUAGE_CONFIGS[language]) {
        res.status(400).json({ error: `Unsupported language: ${language}` });
        return;
    }

    // --- Path 1: BullMQ Queue (async, scalable) ---
    if (queueEnabled && getQueue()) {
        try {
            const jobId = await submitJob({ code, language, stdin });
            execLog.info('Job submitted to queue', { jobId, language });
            res.json({ jobId, status: 'queued', message: 'Job submitted — poll GET /api/execute/:jobId for result' });
            return;
        } catch (error) {
            execLog.warn('Queue submission failed, falling back to direct execution');
            // Fall through to direct execution
        }
    }

    // --- Path 2: Direct execution (sync, fallback) ---
    try {
        const useDocker = await isDockerAvailable();
        const result = useDocker
            ? await runInDocker(code, language, stdin)
            : await runLocally(code, language, stdin);

        res.json(result);
    } catch (error) {
        execLog.error('Execution failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Execution failed' });
    }
});

// ─── GET /api/execute/:jobId — Poll for execution result ────────────────

router.get('/:jobId', async (req: Request, res: Response): Promise<void> => {
    const jobId = req.params.jobId as string;

    try {
        const { status, result, error } = await getJobResult(jobId);

        if (status === 'completed' && result) {
            res.json({ status, ...result });
        } else if (status === 'failed') {
            res.json({ status, error: error || 'Execution failed' });
        } else {
            // queued or active — client should poll again
            res.json({ status });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// ─── GET /api/execute/languages — List supported languages ──────────────

router.get('/languages', (_req: Request, res: Response): void => {
    const languages = Object.entries(LANGUAGE_CONFIGS).map(([name, config]) => ({
        name,
        extension: config.extension,
        image: config.image,
    }));
    res.json({ languages });
});

export default router;
