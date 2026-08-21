const EmailBuilder = require('../EmailBuilder');

const OrderTemplates = {
    orderPlacedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Confirmed', 'Thank you for shopping with AutoMatrix! We have received your order.', EmailBuilder.theme.primary),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Your order has been successfully placed and is now awaiting seller approval.'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Order Date': data.orderDate ? new Date(data.orderDate).toLocaleDateString() : new Date().toLocaleDateString(),
                'Payment Status': data.paymentStatus || 'Pending'
            }),
            EmailBuilder.buildOrderItems(data.items),
            EmailBuilder.buildDeliveryAndPayment(data.shipping, data.payment),
            EmailBuilder.buildFinancialSummary(data.totals),
            EmailBuilder.buildNextSteps([
                'The seller will review and approve your order.',
                'You will receive another notification when the order is being prepared for shipment.'
            ]),
            EmailBuilder.buildButton('View Order', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Confirmed: #${data.orderNumber}`);
    },

    orderApprovedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Approved', 'Your order has been approved by the seller.', EmailBuilder.theme.success),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Great news! The seller has approved your order and will begin processing it shortly.'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Status': 'Approved'
            }),
            EmailBuilder.buildOrderItems(data.items),
            EmailBuilder.buildNextSteps([
                'The seller is packing your items.',
                'We will notify you once it has been handed over to the courier.'
            ]),
            EmailBuilder.buildButton('View Order', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Approved: #${data.orderNumber}`);
    },

    orderProcessingTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Processing', 'We are preparing your order for shipment.', EmailBuilder.theme.primary),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Your items are currently being packed and prepared for dispatch.'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Status': 'Processing'
            }),
            EmailBuilder.buildNextSteps([
                'Your package will be handed over to our delivery partner soon.',
                'You will receive tracking information once shipped.'
            ]),
            EmailBuilder.buildButton('Track Order', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Processing: #${data.orderNumber}`);
    },

    orderShippedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Shipped', 'Good news! Your order is on its way.', EmailBuilder.theme.success, '🚚'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Your order has been shipped via ${data.courierPartner || 'our delivery partner'}.`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Tracking Number': data.trackingNumber || 'Pending'
            }),
            EmailBuilder.buildOrderItems(data.items, 'Shipped Items'),
            EmailBuilder.buildNextSteps([
                'Your package is currently in transit.',
                'Use the tracking button below to follow the delivery status.'
            ]),
            EmailBuilder.buildButton('Track Package', data.trackingUrl || `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Shipped: #${data.orderNumber}`);
    },

    orderOutForDeliveryTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Out for Delivery', 'Your package will arrive today!', EmailBuilder.theme.primary, '📦'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Your order is out for delivery with our courier partner and should reach you today.'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`
            }),
            EmailBuilder.buildNextSteps([
                'Please ensure someone is available at the delivery address to receive the package.',
                'Keep your phone accessible in case the driver needs to contact you.'
            ]),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Out for Delivery: #${data.orderNumber}`);
    },

    orderDeliveredTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Delivered', 'Your order has been successfully delivered.', EmailBuilder.theme.success, '✅'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage('Your package has been delivered. We hope you enjoy your purchase from AutoMatrix!'),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Delivery Date': new Date().toLocaleDateString()
            }),
            EmailBuilder.buildOrderItems(data.items),
            EmailBuilder.buildNextSteps([
                'If you are satisfied with your items, please consider leaving a review.',
                'If there are any issues, you can initiate a return request from your dashboard within the return window.'
            ]),
            EmailBuilder.buildButton('Leave a Review', `https://automobiles.live/orders`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Delivered: #${data.orderNumber}`);
    },

    orderCancelledTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Cancelled', 'Your order has been cancelled.', EmailBuilder.theme.danger, '❌'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`We have processed the cancellation for your order. Reason: ${data.cancellationReason || 'Requested by customer'}`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Status': 'Cancelled'
            }),
            EmailBuilder.buildOrderItems(data.items, 'Cancelled Items'),
            EmailBuilder.buildNextSteps([
                'The cancellation is complete.',
                'If payment was already deducted, a refund has been initiated and will reflect in your account based on your payment method.'
            ]),
            EmailBuilder.buildButton('Continue Shopping', `https://automobiles.live`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Cancelled: #${data.orderNumber}`);
    },

    orderFailedTemplate(data) {
        const content = [
            EmailBuilder.buildHeader(),
            EmailBuilder.buildStatusBanner('Order Failed', 'There was an issue processing your order.', EmailBuilder.theme.danger, '⚠️'),
            EmailBuilder.buildGreeting(data.customerName),
            EmailBuilder.buildMessage(`Unfortunately, we encountered a problem with your order. Reason: ${data.failureReason || 'Payment authorization failed'}`),
            EmailBuilder.buildOrderSummary({
                'Order ID': `#${data.orderNumber}`,
                'Status': 'Failed'
            }),
            EmailBuilder.buildNextSteps([
                'No charges have been finalized for this failed order.',
                'Please review your payment details and try placing the order again.'
            ]),
            EmailBuilder.buildButton('Try Again', `https://automobiles.live/cart`),
            EmailBuilder.buildSupportSection()
        ].join('');

        return EmailBuilder.buildLayout(content, `Order Failed: #${data.orderNumber}`);
    }
};

module.exports = OrderTemplates;
