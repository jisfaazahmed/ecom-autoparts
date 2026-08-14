const EmailBuilder = require('../EmailBuilder');

const VendorAdminTemplates = {
    vendorOrderAlertTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('New Order Received', 'You have a new order to process!', EmailBuilder.theme.success, '🛍️'),
            EmailBuilder.buildGreeting(data.vendorName || 'Vendor'),
            EmailBuilder.buildMessage(`Great news! Customer ${data.customerName} has placed an order containing your products.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Date': new Date().toLocaleDateString()
            }),
            EmailBuilder.buildNextSteps([
                'Please log in to your vendor dashboard to review the order details.',
                'Approve the order to notify the customer that it is being processed.',
                'Prepare the items for shipping.'
            ]),
            EmailBuilder.buildButton('View Order Dashboard', `${process.env.FRONTEND_URL}/vendor/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `New Order: #${data.orderNumber}`);
    },

    adminVendorAppliedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('New Vendor Application', 'Review required.', EmailBuilder.theme.primary, '📝'),
            EmailBuilder.buildGreeting('Super Admin'),
            EmailBuilder.buildMessage(`A new vendor has applied to join AutoMatrix: <strong>${data.shopName || data.vendorName}</strong>.`),
            EmailBuilder.buildOrderSummary({
                'Vendor Name': data.vendorName,
                'Email': data.vendorEmail,
                'Shop Name': data.shopName
            }),
            EmailBuilder.buildNextSteps([
                'Review the vendor application in the super admin panel.',
                'Approve or reject the request.'
            ]),
            EmailBuilder.buildButton('Review Application', `${process.env.FRONTEND_URL}/superadmin/vendors`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `New Vendor: ${data.vendorName}`);
    },

    vendorApplicationApprovedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Application Approved!', 'Welcome to AutoMatrix Sellers.', EmailBuilder.theme.success, '🎉'),
            EmailBuilder.buildGreeting(data.vendorName),
            EmailBuilder.buildMessage(`Congratulations! Your vendor application for <strong>${data.shopName}</strong> has been approved.`),
            EmailBuilder.buildNextSteps([
                'Log in to your vendor dashboard.',
                'Set up your store profile and policies.',
                'Start listing your auto parts products.'
            ]),
            EmailBuilder.buildButton('Go to Dashboard', `${process.env.FRONTEND_URL}/auth/login`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, 'Your Vendor Application is Approved');
    },

    vendorApplicationRejectedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Application Update', 'Regarding your vendor application.', EmailBuilder.theme.warning, 'ℹ️'),
            EmailBuilder.buildGreeting(data.vendorName),
            EmailBuilder.buildMessage(`Thank you for your interest in joining AutoMatrix. After careful review, we regret to inform you that your vendor application for <strong>${data.shopName}</strong> was not approved at this time.`),
            EmailBuilder.buildMessage(`Reason: ${data.reason || 'Does not meet current platform requirements.'}`),
            EmailBuilder.buildNextSteps([
                'You may contact support if you believe this was a mistake or need further clarification.'
            ]),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, 'Update on Vendor Application');
    }
};

module.exports = VendorAdminTemplates;
