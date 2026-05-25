const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: process.env.EMAIL_PORT || process.env.SMTP_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER || process.env.SMTP_USER || 'ethereal.user@ethereal.email',
                pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || 'ethereal.pass'
            }
        });
    }

    async sendEmail(to, subject, html, text = '') {
        try {
            const fromName = process.env.EMAIL_FROM_NAME || 'Ecom Autoparts';
            const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SENDER_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@ecom-autoparts.com';
            const info = await this.transporter.sendMail({
                from: `"${fromName}" <${fromAddress}>`,
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
            <p>Total Amount: Rs.${orderDetails.totalAmount || orderDetails.itemsTotal}</p>
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

    async sendOrderProcessing(email, orderDetails) {
        const subject = `Order Update: We are packing your order - #${orderDetails.orderNumber}`;
        const html = `
            <h1>We are preparing your order!</h1>
            <p>Order #${orderDetails.orderNumber} is now being packed and prepared for shipping.</p>
            <p>We will notify you once it's picked up by our courier partner.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendOrderOutForDelivery(email, orderDetails) {
        const subject = `Order Update: Out for Delivery - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Your order is out for delivery!</h1>
            <p>Order #${orderDetails.orderNumber} is with our delivery partner and will reach you today.</p>
            <p>Please ensure someone is available to receive the package.</p>
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

    async sendVendorOrderDelivered(email, orderDetails) {
        const subject = `Order Delivered to Customer - #${orderDetails.orderNumber}`;
        const html = `
            <h1>Great news!</h1>
            <p>Order #${orderDetails.orderNumber} has been successfully delivered to the customer.</p>
            <p>You can check the details in your vendor dashboard.</p>
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

    async sendAdminCouponUsedAlert(email, details) {
        const subject = `Coupon Used: ${details.couponCode} on Order #${details.orderNumber}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Coupon Used Alert</h2>
                <p>Hello Admin,</p>
                <p>A customer has used a coupon code.</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Order Number:</strong> #${details.orderNumber}</p>
                    <p><strong>Coupon Code:</strong> ${details.couponCode}</p>
                    <p><strong>Discount Amount:</strong> Rs.${details.discountAmount}</p>
                </div>
                <p>You can view the full order details in the admin dashboard.</p>
            </div>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendVendorApplicationApproved(email, details) {
        const subject = 'Welcome to Ecom Autoparts! Your Application is Approved';
        const html = `
            <h1>Congratulations!</h1>
            <p>Your vendor application for <strong>"${details.shopName}"</strong> has been approved.</p>
            <p>You can now log in to your dashboard to start adding products and managing your shop.</p>
            <a href="${process.env.FRONTEND_URL}/auth/login" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Log in to Dashboard</a>
            <p>If you have any questions, please contact our support team.</p>
        `;
        return this.sendEmail(email, subject, html);
    }

    async sendVendorApplicationRejected(email, details) {
        const subject = 'Update on Your Vendor Application';
        const html = `
            <h1>Application Update</h1>
            <p>Thank you for your interest in joining Ecom Autoparts.</p>
            <p>We regret to inform you that your application for <strong>"${details.shopName}"</strong> was not approved at this time.</p>
            <p>We appreciate your interest and wish you the best in your business endeavors.</p>
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