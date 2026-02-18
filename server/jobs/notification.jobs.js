// ============================================
// Background Jobs - Retry & Cleanup (node-cron)
// ============================================

import cron from 'node-cron';
import { getDb } from '../config/db.js';
import NotificationService from '../services/notification.service.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const MAX_RETRIES = parseInt(process.env.MAX_RETRY_ATTEMPTS, 10) || 3;

/**
 * Retry Job: Every 5 minutes, retry failed notifications.
 * - Process notificationQueue
 * - Retry if retryCount < MAX_RETRIES
 * - Remove if sent or maxRetries reached
 */
const retryJob = cron.schedule('*/5 * * * *', async () => {
    const db = getDb();
    const queue = [...db.notificationQueue];

    if (queue.length === 0) return;

    logger.info(`[RetryJob] Processing ${queue.length} queued notifications`);

    for (const notification of queue) {
        try {
            if (notification.status === 'sent') {
                // Already sent — remove from queue
                const idx = db.notificationQueue.findIndex((n) => n.id === notification.id);
                if (idx !== -1) db.notificationQueue.splice(idx, 1);
                continue;
            }

            if (notification.retryCount >= MAX_RETRIES) {
                logger.warn(`[RetryJob] Max retries reached for ${notification.id}. Removing from queue.`);
                const idx = db.notificationQueue.findIndex((n) => n.id === notification.id);
                if (idx !== -1) db.notificationQueue.splice(idx, 1);
                continue;
            }

            notification.incrementRetry();
            logger.info(`[RetryJob] Retrying notification ${notification.id} (attempt ${notification.retryCount})`);

            // Re-dispatch only failed channels
            const failedChannels = Object.entries(notification.channelStatus)
                .filter(([, cs]) => cs.status === 'failed')
                .map(([channel]) => channel);

            if (failedChannels.length === 0) {
                const idx = db.notificationQueue.findIndex((n) => n.id === notification.id);
                if (idx !== -1) db.notificationQueue.splice(idx, 1);
                continue;
            }

            const originalChannels = notification.channels;
            notification.channels = failedChannels;
            await NotificationService.dispatchNotification(notification);
            notification.channels = originalChannels;

            // If all channels now succeeded, remove from queue
            if (notification.status === 'sent') {
                const idx = db.notificationQueue.findIndex((n) => n.id === notification.id);
                if (idx !== -1) db.notificationQueue.splice(idx, 1);
            }
        } catch (error) {
            logger.error(`[RetryJob] Error retrying notification ${notification.id}:`, error);
        }
    }
}, { scheduled: false });

/**
 * Cleanup Job: Daily at midnight, delete notifications older than 30 days.
 */
const cleanupJob = cron.schedule('0 0 * * *', async () => {
    const db = getDb();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const before = db.notifications.length;
    db.notifications = db.notifications.filter((n) => n.createdAt > thirtyDaysAgo);
    const deleted = before - db.notifications.length;

    if (deleted > 0) {
        logger.info(`[CleanupJob] Deleted ${deleted} notifications older than 30 days`);
    }
}, { scheduled: false });

/**
 * Start all background jobs.
 */
export const startJobs = () => {
    retryJob.start();
    cleanupJob.start();
    logger.info('[Jobs] Background jobs started: retry (every 5m), cleanup (daily at midnight)');
};

/**
 * Stop all background jobs.
 */
export const stopJobs = () => {
    retryJob.stop();
    cleanupJob.stop();
};

export default { startJobs, stopJobs };
