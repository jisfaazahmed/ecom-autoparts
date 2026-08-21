const EmailBuilder = require('../EmailBuilder');

const RefundReturnTemplates = {
    refundInitiatedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Refund Initiated', 'We are processing your refund.', EmailBuilder.theme.primary, '💸'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`A refund of ${EmailBuilder.formatCurrency(data.refundAmount)} has been initiated for order #${data.orderNumber}.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Refund Amount': EmailBuilder.formatCurrency(data.refundAmount),
                'Original Payment Method': data.paymentMethod || 'Original payment method',
                'Reason': data.reason || 'Requested by customer'
            }),
            EmailBuilder.buildNextSteps([
                'The refund has been sent to your bank or card issuer.',
                'Please allow 3-7 business days for the funds to reflect in your account, depending on your financial institution.'
            ]),
            EmailBuilder.buildButton('View Refund Status', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Refund Initiated: #${data.orderNumber}`);
    },

    refundCompletedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Refund Completed', 'Your refund has been successfully processed.', EmailBuilder.theme.success, '✅'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Your refund of ${EmailBuilder.formatCurrency(data.refundAmount)} for order #${data.orderNumber} is now complete.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Refund Amount': EmailBuilder.formatCurrency(data.refundAmount),
                'Completed On': new Date().toLocaleDateString()
            }),
            EmailBuilder.buildNextSteps([
                'The funds should now be available in your account.',
                'If you do not see the refund after a few days, please contact your bank with this reference number: ' + (data.refundReference || 'provided in your dashboard.')
            ]),
            EmailBuilder.buildButton('View Order Details', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Refund Completed: #${data.orderNumber}`);
    },

    returnRequestedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Return Request Received', 'We have received your return request.', EmailBuilder.theme.primary, '📦'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Your request to return items from order #${data.orderNumber} has been received and is pending seller review.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Reason': data.reason || 'Not specified'
            }),
            EmailBuilder.buildOrderItems(data.items, 'Items to Return'),
            EmailBuilder.buildNextSteps([
                'The seller will review your request within 24-48 hours.',
                'Once approved, you will receive instructions on how to ship the items back.'
            ]),
            EmailBuilder.buildButton('View Request', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Return Request: #${data.orderNumber}`);
    },

    returnApprovedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Return Approved', 'Your return request has been approved.', EmailBuilder.theme.success, '👍'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Good news! The seller has approved your return request for order #${data.orderNumber}.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`
            }),
            EmailBuilder.buildOrderItems(data.items, 'Approved Items'),
            EmailBuilder.buildNextSteps([
                'Please pack the items securely in their original packaging.',
                'Follow the return shipping instructions provided in your dashboard.',
                'A refund will be initiated once the seller receives and inspects the returned items.'
            ]),
            EmailBuilder.buildButton('View Return Instructions', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Return Approved: #${data.orderNumber}`);
    }
};

module.exports = RefundReturnTemplates;
