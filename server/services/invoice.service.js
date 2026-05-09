const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Order = require('../models/order.model');

class InvoiceService {
    ensureInvoiceDirectory() {
        const dir = path.join(__dirname, '..', 'uploads', 'invoices');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    async generateInvoicePdf(orderId) {
        const order = await Order.findById(orderId)
            .populate({ path: 'items', populate: { path: 'product' } })
            .populate('user');

        if (!order) throw new Error('Order not found');

        const invoicesDir = this.ensureInvoiceDirectory();
        const fileName = `${String(order.orderNumber || order._id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
        const filePath = path.join(invoicesDir, fileName);

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40 });
            const stream = fs.createWriteStream(filePath);

            stream.on('finish', () => resolve({ filePath, fileName }));
            stream.on('error', reject);
            doc.on('error', reject);

            doc.pipe(stream);

            // Header
            doc.fontSize(20).text('Invoice', { align: 'center' });
            doc.moveDown();

            // Order & customer
            doc.fontSize(10).text(`Order: ${order.orderNumber || order._id}`);
            doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
            doc.moveDown(0.5);

            const customerName = order.shippingAddress?.fullName || order.user?.fullName || 'Guest';
            doc.text(`Bill To: ${customerName}`);
            if (order.shippingAddress) {
                const addr = order.shippingAddress;
                const lines = [addr.addressLine1, addr.addressLine2, addr.city, addr.postalCode, addr.country].filter(Boolean).join(', ');
                doc.text(lines);
            }

            doc.moveDown();

            // Table header
            doc.fontSize(10).text('Item', 40, doc.y, { continued: true });
            doc.text('Qty', 320, doc.y, { continued: true });
            doc.text('Unit', 380, doc.y, { continued: true });
            doc.text('Total', 460, doc.y);
            doc.moveDown(0.5);

            // Items
            (order.items || []).forEach((item) => {
                const name = item.product?.name || item.productName || 'Item';
                const qty = item.quantity || 1;
                const unit = item.unitPrice || item.price || 0;
                const total = item.totalPrice || (unit * qty);

                doc.fontSize(10).text(name, 40, doc.y, { continued: true, width: 260 });
                doc.text(String(qty), 320, doc.y, { continued: true });
                doc.text(formatCurrency(unit), 380, doc.y, { continued: true });
                doc.text(formatCurrency(total), 460, doc.y);
                doc.moveDown(0.2);
            });

            doc.moveDown();

            // Summary
            const subtotal = order.itemsTotal || (order.items || []).reduce((s, i) => s + (i.totalPrice || ((i.unitPrice || 0) * (i.quantity || 1))), 0);
            const shipping = order.shippingCharges || 0;
            const discount = order.discountAmount || 0;
            const tax = order.taxAmount || 0;
            const total = order.totalAmount || subtotal + shipping + tax - discount;

            doc.text(`Subtotal: ${formatCurrency(subtotal)}`, { align: 'right' });
            doc.text(`Shipping: ${formatCurrency(shipping)}`, { align: 'right' });
            if (discount) doc.text(`Discount: -${formatCurrency(discount)}`, { align: 'right' });
            if (tax) doc.text(`Tax: ${formatCurrency(tax)}`, { align: 'right' });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Total: ${formatCurrency(total)}`, { align: 'right' });

            doc.moveDown(1);
            doc.fontSize(10).text('Thank you for your purchase!', { align: 'center' });

            doc.end();
        });
    }
}

function formatCurrency(value) {
    const num = Number(value || 0);
    return `${num.toFixed(2)}`;
}

module.exports = new InvoiceService();
