// ============================================
// SMS Configuration - Twilio Client
// ============================================
// NO Firebase imports.

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

let twilioClient = null;

/**
 * Get the Twilio client instance.
 * Lazily initialized singleton.
 * @returns {object} Twilio client
 */
export const getTwilioClient = () => {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }

    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
};

/**
 * Get the Twilio phone number from env.
 * @returns {string} Twilio phone number
 */
export const getTwilioPhoneNumber = () => {
    return process.env.TWILIO_PHONE_NUMBER || '';
};

/**
 * Reset the client (useful for testing).
 */
export const resetTwilioClient = () => {
    twilioClient = null;
};

export default { getTwilioClient, getTwilioPhoneNumber, resetTwilioClient };
