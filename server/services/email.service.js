const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
                pass: process.env.EMAIL_PASS || 'ethereal.pass'
            }
        });
    }

    async sendEmail(to, subject, html, text = '') {
        try {
            const info = await this.transporter.sendMail({
                from: `"${process.env.EMAIL_FROM_NAME || 'Ecom Autoparts'}" <${process.env.EMAIL_FROM_ADDRESS || 'noreply@ecom-autoparts.com'}>`,
                to,
                subject,
                text,
                html
            });

            console.log('Message sent: %s', info.messageId);
            // If using Ethereal, log the preview URL
            if (process.env.EMAIL_HOST === 'smtp.ethereal.email' || !process.env.EMAIL_HOST) {
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            }
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            // Don't throw error to avoid breaking the main flow, just log it
            return null;
        }
    }

    async sendOrderConfirmation(email, orderDetails) {
        const subject = `Order Confirmation - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Thank you for your order!</h1>
            <p>Your order #${orderDetails.orderNumber} has been placed successfully.</p>
            <p>Total Amount: ${orderDetails.totalAmount}</p>
            <p>We will notify you when your items are shipped.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendOrderShipped(email, orderDetails) {
        const subject = `Your Order has been Shipped - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Good news! Your order is on its way.</h1>
            <p>Order #${orderDetails.orderNumber} has been shipped.</p>
            <p>Tracking Number: ${orderDetails.trackingNumber}</p>
            <p>Courier: ${orderDetails.courierPartner}</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendPasswordReset(email, resetLink) {
        const subject = 'Password Reset Request';
        const html = `
            <h1>Password Reset</h1>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>This link is valid for 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;
        return this.sendEmail(email, subject, html);
    }
}

module.exports = new EmailService();
