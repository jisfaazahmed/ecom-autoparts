// ============================================
// Notification Model - AutoMatrix
// ============================================
// Valid channels: email, sms, in-app ONLY.
// NO push. NO deviceToken.

import { v4 as uuidv4 } from 'uuid';

const validChannels = ['email', 'sms', 'in-app']; // NO 'push'

const validTypes = [
    'vendor_approval',
    'vendor_rejection',
    'vendor_suspension',
    'order_update',
    'order_confirmation',
    'order_shipped',
    'order_delivered',
    'commission_update',
    'low_stock',
    'promotion',
    'system',
];

const validStatuses = ['pending', 'processing', 'sent', 'partial', 'failed'];

class Notification {
    constructor(data) {
        this.id = data.id || uuidv4();
        this.userId = data.userId;
        this.type = data.type;
        this.title = data.title || '';
        this.content = data.content || '';
        this.channels = data.channels || [];
        this.recipient = {
            email: data.recipient?.email || null,
            phone: data.recipient?.phone || null,
            // NO deviceToken field
        };
        this.metadata = data.metadata || {};
        this.status = data.status || 'pending';
        this.channelStatus = data.channelStatus || {};
        this.read = data.read || false;
        this.retryCount = data.retryCount || 0;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    /**
     * Validate notification data.
     * @param {object} data - Raw notification data
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        if (!data.userId) {
            errors.push('userId is required');
        }

        if (!data.type) {
            errors.push('type is required');
        } else if (!validTypes.includes(data.type)) {
            errors.push(`Invalid type: ${data.type}. Valid: ${validTypes.join(', ')}`);
        }

        if (!data.content && !data.title) {
            errors.push('At least one of title or content is required');
        }

        if (!data.channels || !Array.isArray(data.channels) || data.channels.length === 0) {
            errors.push('channels must be a non-empty array');
        } else {
            // Explicitly reject push channel
            if (data.channels.includes('push')) {
                errors.push('Invalid channels: push. Valid: email, sms, in-app');
            }

            const invalidChannels = data.channels.filter((ch) => !validChannels.includes(ch));
            if (invalidChannels.length > 0) {
                errors.push(`Invalid channels: ${invalidChannels.join(', ')}. Valid: ${validChannels.join(', ')}`);
            }
        }

        // Validate recipient fields for requested channels
        if (data.channels?.includes('email') && !data.recipient?.email) {
            errors.push('recipient.email is required when email channel is selected');
        }

        if (data.channels?.includes('sms') && !data.recipient?.phone) {
            errors.push('recipient.phone is required when sms channel is selected');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Update the status of a specific channel.
     * @param {string} channel - Channel name
     * @param {string} status - 'success' or 'failed'
     * @param {string} [error] - Error message if failed
     */
    updateChannelStatus(channel, status, error = null) {
        this.channelStatus[channel] = {
            status,
            timestamp: new Date().toISOString(),
        };
        if (error) {
            this.channelStatus[channel].error = error;
        }
        this.updatedAt = new Date().toISOString();
        this._computeOverallStatus();
    }

    /**
     * Compute the overall status based on channel statuses.
     * @private
     */
    _computeOverallStatus() {
        const statuses = Object.values(this.channelStatus).map((cs) => cs.status);
        if (statuses.length === 0) {
            this.status = 'pending';
        } else if (statuses.every((s) => s === 'success')) {
            this.status = 'sent';
        } else if (statuses.every((s) => s === 'failed')) {
            this.status = 'failed';
        } else if (statuses.length === this.channels.length) {
            this.status = 'partial';
        } else {
            this.status = 'processing';
        }
    }

    /**
     * Mark the notification as read.
     */
    markAsRead() {
        this.read = true;
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Increment retry count.
     * @returns {number} New retry count
     */
    incrementRetry() {
        this.retryCount += 1;
        this.updatedAt = new Date().toISOString();
        return this.retryCount;
    }

    /**
     * Convert to a plain JSON object (no deviceToken field).
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            type: this.type,
            title: this.title,
            content: this.content,
            channels: this.channels,
            recipient: {
                email: this.recipient.email,
                phone: this.recipient.phone,
                // NO deviceToken
            },
            metadata: this.metadata,
            status: this.status,
            channelStatus: this.channelStatus,
            read: this.read,
            retryCount: this.retryCount,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

export { validChannels, validTypes, validStatuses };
export default Notification;
