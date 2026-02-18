// ============================================
// Email Configuration - Nodemailer Transporter
// ============================================
// Supports Gmail (dev), SendGrid (prod), AWS SES (scale)
// NO Firebase imports.

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

/**
 * Create and return the Nodemailer transporter.
 * Lazily initialized singleton.
 * @returns {object} Nodemailer transporter
 */
export const getEmailTransporter = () => {
    if (transporter) return transporter;

    const service = process.env.EMAIL_SERVICE;
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const secure = process.env.EMAIL_SECURE === 'true';
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    if (service && service.toLowerCase() === 'gmail') {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
        });
    } else {
        // Generic SMTP (SendGrid, AWS SES, etc.)
        transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
        });
    }

    return transporter;
};

/**
 * Reset the transporter (useful for testing).
 */
export const resetTransporter = () => {
    transporter = null;
};

export default { getEmailTransporter, resetTransporter };
