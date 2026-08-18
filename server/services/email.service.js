const nodemailer = require('nodemailer');
const OrderTemplates = require('./emails/templates/OrderTemplates');
const PaymentTemplates = require('./emails/templates/PaymentTemplates');
const RefundReturnTemplates = require('./emails/templates/RefundReturnTemplates');
const AccountTemplates = require('./emails/templates/AccountTemplates');
const VendorAdminTemplates = require('./emails/templates/VendorAdminTemplates');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: process.env.EMAIL_PORT || process.env.SMTP_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER || process.env.SMTP_USER || 'ethereal.user@ethereal.email',
                pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || 'ethereal.pass'
            }
        });
    }

    async sendEmail(to, subject, html, text = '') {
        try {
            const fromName = process.env.EMAIL_FROM_NAME || 'AutoMatrix';
            const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SENDER_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@automatrix.com';
            const info = await this.transporter.sendMail({
                from: `"${fromName}" <${fromAddress}>`,
                to,
                subject,
                text,
                html
            });

            console.log('Message sent: %s', info.messageId);
            if (process.env.EMAIL_HOST === 'smtp.ethereal.email' || !process.env.EMAIL_HOST) {
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            }
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            return null;
        }
    }

    // --- Order Emails ---
    async sendOrderConfirmation(email, orderDetails) {
        const html = OrderTemplates.orderPlacedTemplate(orderDetails);
        return this.sendEmail(email, `Order Confirmation - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderConfirmed(email, orderDetails) {
        const html = OrderTemplates.orderApprovedTemplate(orderDetails);
        return this.sendEmail(email, `Order Confirmed - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderProcessing(email, orderDetails) {
        const html = OrderTemplates.orderProcessingTemplate(orderDetails);
        return this.sendEmail(email, `Order Update: Processing - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderShipped(email, orderDetails) {
        const html = OrderTemplates.orderShippedTemplate(orderDetails);
        return this.sendEmail(email, `Your Order has been Shipped - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderOutForDelivery(email, orderDetails) {
        const html = OrderTemplates.orderOutForDeliveryTemplate(orderDetails);
        return this.sendEmail(email, `Order Update: Out for Delivery - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderDelivered(email, orderDetails) {
        const html = OrderTemplates.orderDeliveredTemplate(orderDetails);
        return this.sendEmail(email, `Order Delivered - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderCancelled(email, orderDetails) {
        const html = OrderTemplates.orderCancelledTemplate(orderDetails);
        return this.sendEmail(email, `Order Cancelled - #${orderDetails.orderNumber}`, html);
    }
    async sendOrderFailed(email, orderDetails) {
        const html = OrderTemplates.orderFailedTemplate(orderDetails);
        return this.sendEmail(email, `Order Failed - #${orderDetails.orderNumber}`, html);
    }

    // --- Payment Emails ---
    async sendPaymentSuccessful(email, data) {
        const html = PaymentTemplates.paymentSuccessfulTemplate(data);
        return this.sendEmail(email, `Payment Successful - #${data.orderNumber}`, html);
    }
    async sendPaymentFailed(email, data) {
        const html = PaymentTemplates.paymentFailedTemplate(data);
        return this.sendEmail(email, `Payment Failed - #${data.orderNumber}`, html);
    }
    async sendPaymentPending(email, data) {
        const html = PaymentTemplates.paymentPendingTemplate(data);
        return this.sendEmail(email, `Payment Pending - #${data.orderNumber}`, html);
    }

    // --- Refund & Return Emails ---
    async sendRefundInitiated(email, data) {
        const html = RefundReturnTemplates.refundInitiatedTemplate(data);
        return this.sendEmail(email, `Refund Initiated - #${data.orderNumber}`, html);
    }
    async sendRefundCompleted(email, data) {
        const html = RefundReturnTemplates.refundCompletedTemplate(data);
        return this.sendEmail(email, `Refund Completed - #${data.orderNumber}`, html);
    }
    async sendReturnRequested(email, data) {
        const html = RefundReturnTemplates.returnRequestedTemplate(data);
        return this.sendEmail(email, `Return Request Received - #${data.orderNumber}`, html);
    }
    async sendReturnApproved(email, data) {
        const html = RefundReturnTemplates.returnApprovedTemplate(data);
        return this.sendEmail(email, `Return Approved - #${data.orderNumber}`, html);
    }

    // --- Vendor & Admin Alerts ---
    async sendVendorOrderAlert(email, orderDetails) {
        const html = VendorAdminTemplates.vendorOrderAlertTemplate(orderDetails);
        return this.sendEmail(email, `New Order Received - #${orderDetails.orderNumber}`, html);
    }
    async sendVendorOrderDelivered(email, orderDetails) {
        const html = OrderTemplates.orderDeliveredTemplate(orderDetails);
        return this.sendEmail(email, `Order Delivered to Customer - #${orderDetails.orderNumber}`, html);
    }
    async sendAdminVendorAppliedAlert(email, vendorDetails) {
        const html = VendorAdminTemplates.adminVendorAppliedTemplate(vendorDetails);
        return this.sendEmail(email, `New Vendor Application: ${vendorDetails.vendorName}`, html);
    }
    async sendVendorApplicationApproved(email, details) {
        const html = VendorAdminTemplates.vendorApplicationApprovedTemplate(details);
        return this.sendEmail(email, 'Welcome to AutoMatrix! Your Application is Approved', html);
    }
    async sendVendorApplicationRejected(email, details) {
        const html = VendorAdminTemplates.vendorApplicationRejectedTemplate(details);
        return this.sendEmail(email, 'Update on Your Vendor Application', html);
    }
    
    // --- Misc / Legacy preservation ---
    async sendAdminProductAddedAlert(email, productDetails) {
        const html = `<div style="font-family:sans-serif;padding:20px;"><h2>New Product Added</h2><p>Vendor ${productDetails.vendorName} added ${productDetails.productName}. Please review in dashboard.</p></div>`;
        return this.sendEmail(email, `New Product for Approval: ${productDetails.productName}`, html);
    }
    async sendAdminCustomerSignupAlert(email, customerDetails) {
        const html = AccountTemplates.welcomeTemplate(customerDetails); 
        return this.sendEmail(email, `New Customer Signup: ${customerDetails.customerName}`, html);
    }
    async sendAdminCouponUsedAlert(email, details) {
        const html = `<div style="font-family:sans-serif;padding:20px;"><h2>Coupon Used</h2><p>Coupon code ${details.couponCode} was used on order #${details.orderNumber}.</p></div>`;
        return this.sendEmail(email, `Coupon Used: ${details.couponCode} on Order #${details.orderNumber}`, html);
    }
    async sendPasswordReset(email, resetLink) {
        const html = AccountTemplates.passwordResetTemplate({ customerName: 'User', resetLink });
        return this.sendEmail(email, 'Password Reset Request', html);
    }
}

module.exports = new EmailService();