const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Order = require('../models/order.model');
const storage = require('./storage.service');

// Invoices are private: they are stored under invoices/ in R2 with no public URL
// and only ever reach a customer through an authorised route (order.controller
// checks ownership, or verifies a signed guest token) that streams them back.
const INVOICE_FOLDER = 'invoices';

class InvoiceService {
    invoiceFileName(order) {
        const base = String(order.orderNumber || order._id).replace(/[^a-zA-Z0-9-_]/g, '_');
        return `${base}.pdf`;
    }

    // Old records stored an absolute filesystem path in invoiceUrl. Those files
    // only still exist on a machine that has not redeployed since, so treat a
    // readable one as a bonus and fall through to regeneration otherwise.
    legacyDiskPath(order) {
        const value = order?.invoiceUrl;
        if (!value || !path.isAbsolute(value)) return null;
        return fs.existsSync(value) ? value : null;
    }

    async generateInvoicePdf(orderId) {
        const order = await Order.findById(orderId)
            .populate({ path: 'items', populate: { path: 'product' } })
            .populate('user');

        if (!order) throw new Error('Order not found');

        const fileName = this.invoiceFileName(order);

        // Already in storage - nothing to render.
        if (order.invoiceKey && await storage.exists(order.invoiceKey)) {
            return { key: order.invoiceKey, fileName, cached: true };
        }

        const buffer = await this.renderInvoiceBuffer(order);
        const key = storage.buildKey(INVOICE_FOLDER, fileName);

        await storage.put({ key, body: buffer, contentType: 'application/pdf' });

        try {
            await Order.findByIdAndUpdate(orderId, {
                invoiceKey: key,
                invoiceGeneratedAt: new Date(),
            });
        } catch (updateError) {
            // The PDF is stored either way; a failed bookkeeping write only costs
            // a re-render next time.
            console.error('Failed to save invoice key to database:', updateError);
        }

        return { key, fileName, cached: false };
    }

    // Draws the invoice and resolves with the finished PDF bytes. Nothing here
    // touches the filesystem, so the same buffer works for R2 or local disk.
    renderInvoiceBuffer(order) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40 });
            const chunks = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

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

    // What the download routes use: a readable stream plus the name to send it
    // under. Generates the invoice first if it is not stored yet.
    async openInvoiceStream(orderId) {
        const order = await Order.findById(orderId).select('orderNumber invoiceKey invoiceUrl');
        if (!order) throw new Error('Order not found');

        const legacyPath = this.legacyDiskPath(order);
        if (!order.invoiceKey && legacyPath) {
            return { stream: fs.createReadStream(legacyPath), fileName: path.basename(legacyPath) };
        }

        const { key, fileName } = await this.generateInvoicePdf(orderId);
        return { stream: await storage.openStream(key), fileName };
    }

    async regenerateInvoice(orderId) {
        // Force regeneration by clearing the stored location first.
        await Order.findByIdAndUpdate(orderId, {
            invoiceKey: null,
            invoiceUrl: null,
            invoiceGeneratedAt: null,
        });
        return this.generateInvoicePdf(orderId);
    }

    async getInvoiceInfo(orderId) {
        const order = await Order.findById(orderId).select('invoiceKey invoiceUrl invoiceGeneratedAt');
        if (!order) throw new Error('Order not found');

        if (order.invoiceKey) {
            const stats = await storage.stat(order.invoiceKey);
            if (stats) {
                return {
                    exists: true,
                    path: order.invoiceKey,
                    fileName: path.posix.basename(order.invoiceKey),
                    size: stats.size,
                    generatedAt: order.invoiceGeneratedAt,
                    fileModified: stats.lastModified,
                };
            }
        }

        const legacyPath = this.legacyDiskPath(order);
        if (legacyPath) {
            const stats = fs.statSync(legacyPath);
            return {
                exists: true,
                path: legacyPath,
                fileName: path.basename(legacyPath),
                size: stats.size,
                generatedAt: order.invoiceGeneratedAt,
                fileModified: stats.mtime,
            };
        }

        return {
            exists: false,
            path: null,
            fileName: null,
            size: 0,
            generatedAt: null
        };
    }
}

function formatCurrency(value) {
    const num = Number(value || 0);
    return `${num.toFixed(2)}`;
}

module.exports = new InvoiceService();
