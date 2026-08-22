const EmailBuilder = require('../EmailBuilder');

const PaymentTemplates = {
    paymentSuccessfulTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Payment Successful', 'We have received your payment.', EmailBuilder.theme.success, '💰'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Your payment has been successfully processed and applied to your order.'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Amount Paid': EmailBuilder.formatCurrency(data.amountPaid || data.totalAmount),
                'Payment Method': data.paymentMethod || 'Credit/Debit Card',
                'Date': new Date().toLocaleDateString()
            }),
            EmailBuilder.buildNextSteps([
                'Your order will now be processed by the seller.',
                'You will receive a notification when the items are shipped.'
            ]),
            EmailBuilder.buildButton('View Order', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Payment Received: #${data.orderNumber}`);
    },

    paymentFailedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Payment Failed', 'There was an issue processing your payment.', EmailBuilder.theme.danger, '⚠️'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`We couldn't process your payment for order #${data.orderNumber}. Reason: ${data.failureReason || 'Card declined or insufficient funds'}`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Amount Due': EmailBuilder.formatCurrency(data.totalAmount),
                'Status': 'Payment Failed'
            }),
            EmailBuilder.buildNextSteps([
                'Your order has not been finalized.',
                'Please update your payment method or try again to complete the purchase.'
            ]),
            EmailBuilder.buildButton('Retry Payment', `https://automobiles.live/checkout`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Payment Failed: #${data.orderNumber}`);
    },

    paymentPendingTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Payment Pending', 'Your payment is currently being processed.', EmailBuilder.theme.warning, '⏳'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Your payment for order #${data.orderNumber} is pending confirmation. This typically takes a few minutes but can sometimes take longer depending on your bank.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Amount': EmailBuilder.formatCurrency(data.totalAmount),
                'Payment Method': data.paymentMethod
            }),
            EmailBuilder.buildNextSteps([
                'No further action is required from you at this time.',
                'We will notify you via email as soon as the payment is confirmed or if any issues arise.'
            ]),
            EmailBuilder.buildButton('View Order Status', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Payment Pending: #${data.orderNumber}`);
    }
};

module.exports = PaymentTemplates;
