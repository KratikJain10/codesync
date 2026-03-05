import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { runInDocker, runLocally, isDockerAvailable, ExecutionResult } from './DockerRunner';
import { execLog } from '../lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ExecutionJobData {
    code: string;
    language: string;
    stdin?: string;
    submittedAt: number;
}

export interface ExecutionJobResult extends ExecutionResult {
    jobId: string;
    queuedTime: number;
}

// ─── Queue Setup ────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'code-execution';

let connection: any = null;
let executionQueue: Queue | null = null;
let executionWorker: Worker | null = null;

// In-memory result store (used when Redis unavailable for polling)
const resultStore = new Map<string, ExecutionJobResult>();

export function getQueue(): Queue<ExecutionJobData> | null {
    return executionQueue;
}

// ─── Initialize Queue ───────────────────────────────────────────────────

export function initExecutionQueue(): boolean {
    try {
        connection = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        }) as any;

        executionQueue = new Queue(QUEUE_NAME, {
            connection: connection as any,
            defaultJobOptions: {
                attempts: 1,               // No retries for code execution
                removeOnComplete: {
                    age: 300,              // Remove completed jobs after 5 min
                    count: 100,
                },
                removeOnFail: {
                    age: 300,
                },
            },
        });

        // Create worker to process jobs
        executionWorker = new Worker(
            QUEUE_NAME,
            async (job: Job) => {
                const { code, language, stdin, submittedAt } = job.data as ExecutionJobData;
                const queuedTime = Date.now() - submittedAt;
                execLog.info(`Processing job ${job.id}`, { language, queuedTime });

                // Determine execution engine
                const useDocker = await isDockerAvailable();
                const result = useDocker
                    ? await runInDocker(code, language, stdin)
                    : await runLocally(code, language, stdin);

                const jobResult: ExecutionJobResult = {
                    ...result,
                    jobId: job.id || '',
                    queuedTime,
                };

                // Store result for polling
                resultStore.set(job.id || '', jobResult);
                setTimeout(() => resultStore.delete(job.id || ''), 300000); // Clean after 5 min

                return jobResult;
            },
            {
                connection: new IORedis(REDIS_URL, {
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                }) as any,
                concurrency: parseInt(process.env.EXEC_CONCURRENCY || '3', 10),
                limiter: {
                    max: 10,                // Max 10 jobs
                    duration: 60000,        // Per minute
                },
            }
        );

        executionWorker.on('completed', (job) => {
            execLog.info(`Job ${job.id} completed`);
        });

        executionWorker.on('failed', (job, err) => {
            execLog.error(`Job ${job?.id} failed`, { error: err.message });
        });

        execLog.info('BullMQ execution queue initialized', { concurrency: process.env.EXEC_CONCURRENCY || '3' });
        return true;
    } catch (error) {
        execLog.warn('BullMQ queue unavailable — falling back to direct execution', {
            error: (error as Error).message,
        });
        return false;
    }
}

// ─── Submit Job ─────────────────────────────────────────────────────────

export async function submitJob(data: Omit<ExecutionJobData, 'submittedAt'>): Promise<string> {
    if (!executionQueue) {
        throw new Error('Queue not initialized');
    }

    const job = await executionQueue.add('execute', {
        ...data,
        submittedAt: Date.now(),
    });

    return job.id || '';
}

// ─── Get Job Status ─────────────────────────────────────────────────────

export async function getJobResult(jobId: string): Promise<{
    status: 'queued' | 'active' | 'completed' | 'failed';
    result?: ExecutionJobResult;
    error?: string;
}> {
    // Check in-memory store first
    const cached = resultStore.get(jobId);
    if (cached) {
        return { status: 'completed', result: cached };
    }

    if (!executionQueue) {
        return { status: 'failed', error: 'Queue not available' };
    }

    const job = await executionQueue.getJob(jobId);
    if (!job) {
        return { status: 'failed', error: 'Job not found' };
    }

    const state = await job.getState();

    if (state === 'completed') {
        return { status: 'completed', result: job.returnvalue };
    } else if (state === 'failed') {
        return { status: 'failed', error: job.failedReason || 'Execution failed' };
    } else if (state === 'active') {
        return { status: 'active' };
    } else {
        return { status: 'queued' };
    }
}

// ─── Shutdown ───────────────────────────────────────────────────────────

export async function shutdownQueue(): Promise<void> {
    if (executionWorker) await executionWorker.close();
    if (executionQueue) await executionQueue.close();
    if (connection) connection.disconnect();
}
