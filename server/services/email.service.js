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
            <p>Total Amount: ₹${orderDetails.totalAmount || orderDetails.itemsTotal}</p>
            <p>We will notify you when your items are shipped.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendOrderConfirmed(email, orderDetails) {
        const subject = `Order Confirmed - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Your order has been confirmed!</h1>
            <p>Order #${orderDetails.orderNumber} has been confirmed by the seller and is being processed.</p>
            <p>We will notify you when it's shipped.</p>
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

    async sendOrderDelivered(email, orderDetails) {
        const subject = `Order Delivered - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Your order has been delivered!</h1>
            <p>Order #${orderDetails.orderNumber} has been delivered successfully.</p>
            <p>We hope you enjoy your purchase!</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendVendorOrderAlert(email, orderDetails) {
        const subject = `New Order Received - #${orderDetails.orderNumber}`;
        const html = `
            <h1>You have a new order!</h1>
            <p>Order #${orderDetails.orderNumber} has been received from ${orderDetails.customerName}.</p>
            <p>Please log in to your dashboard to review and approve the order.</p>
            <a href="${process.env.FRONTEND_URL}/vendor/orders">View Orders</a>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendAdminVendorAppliedAlert(email, vendorDetails) {
        const subject = `New Vendor Application: ${vendorDetails.vendorName}`;
        const html = `
            <h1>New Vendor Application Received</h1>
            <p>A new vendor has applied to join the platform:</p>
            <ul>
                <li><strong>Name:</strong> ${vendorDetails.vendorName}</li>
                <li><strong>Email:</strong> ${vendorDetails.vendorEmail}</li>
            </ul>
            <p>Please review the application in the super admin panel.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendAdminProductAddedAlert(email, productDetails) {
        const subject = `New Product for Approval: ${productDetails.productName}`;
        const html = `
            <h1>New Product Added by Vendor</h1>
            <p>Vendor "${productDetails.vendorName}" has added a new product that requires approval:</p>
            <ul>
                <li><strong>Product Name:</strong> ${productDetails.productName}</li>
            </ul>
            <p>Please review it in the super admin panel.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendAdminCustomerSignupAlert(email, customerDetails) {
        const subject = `New Customer Signup: ${customerDetails.customerName}`;
        const html = `
            <h1>A New Customer has Joined</h1>
            <p>A new customer has signed up on the platform:</p>
            <ul>
                <li><strong>Name:</strong> ${customerDetails.customerName}</li>
                <li><strong>Email:</strong> ${customerDetails.customerEmail}</li>
            </ul>
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
