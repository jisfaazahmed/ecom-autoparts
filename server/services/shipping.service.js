const Shipping = require('../models/shipping.model');
const Order = require('../models/order.model');
const OrderTimeline = require('../models/timeline.model');
const ShippingZone = require('../models/deliveryZone.model');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ZONES = {
    'zone1': {
        districts: ['Colombo'],
    },
    'zone2': {
        districts: ['Gampaha', 'Kalutara'],
    },
    'zone3': {
        districts: ['Kurunegala',
            'Kandy',
            'Matale',
            'Nuwara Eliya',
            'Galle',
            'Matara',
            'Hambantota',
            'Puttalam',
            'Anuradhapura',
            'Polonnaruwa',
            'Badulla',
            'Monaragala',
            'Ratnapura',
            'Kegalle',
            'Trincomalee',
            'Batticaloa',
            'Ampara',
            'Jaffna',
            'Vavuniya',
            'Mannar',
            'Kilinochchi',
            'Mullaitivu'],

    }
};

class ShippingService {

    ensureLabelDirectory() {
        const labelsDir = path.join(__dirname, '..', 'uploads', 'labels');
        if (!fs.existsSync(labelsDir)) {
            fs.mkdirSync(labelsDir, { recursive: true });
        }
        return labelsDir;
    }

    sanitizeFileName(value) {
        return String(value || '')
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .slice(0, 80);
    }

    generateTrackingNumber(courierName) {
        const prefix = String(courierName || 'SHIP')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 3)
            .toUpperCase() || 'SHP';

        const date = new Date();
        const year = String(date.getFullYear()).slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const stamp = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900) + 100}`;

        return `${prefix}${year}${month}${day}${stamp}`;
    }

    async createLabelPdf(shipping, filePath) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const stream = fs.createWriteStream(filePath);

            stream.on('finish', resolve);
            stream.on('error', reject);
            doc.on('error', reject);

            doc.pipe(stream);

            const orderNumber = shipping?.order?.orderNumber || 'N/A';
            const trackingNumber = shipping?.trackingNumber || 'N/A';
            const courier = shipping?.courierPartner || shipping?.courierPartner?.name || 'N/A';
            const customerName = shipping?.deliveryAddress?.customerName || shipping?.shippingAddress?.fullName || 'N/A';
            const phone = shipping?.deliveryAddress?.phone || shipping?.shippingAddress?.phone || 'N/A';
            const address = [
                shipping?.deliveryAddress?.addressLine1 || shipping?.shippingAddress?.addressLine1,
                shipping?.deliveryAddress?.addressLine2 || shipping?.shippingAddress?.addressLine2,
                shipping?.deliveryAddress?.city || shipping?.shippingAddress?.city,
                shipping?.deliveryAddress?.district || shipping?.shippingAddress?.district,
                shipping?.deliveryAddress?.postalCode || shipping?.shippingAddress?.postalCode,
            ].filter(Boolean).join(', ');

            doc.fontSize(20).text('Shipping Label', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
            doc.moveDown();

            doc.fontSize(12).text(`Order Number: ${orderNumber}`);
            doc.text(`Tracking Number: ${trackingNumber}`);
            doc.text(`Courier Partner: ${courier}`);
            doc.text(`Shipping Method: ${shipping?.shippingMethod || shipping?.shipmentType || 'standard'}`);
            doc.moveDown();

            doc.fontSize(13).text('Deliver To', { underline: true });
            doc.fontSize(12).text(`Name: ${customerName}`);
            doc.text(`Phone: ${phone}`);
            doc.text(`Address: ${address || 'N/A'}`);
            doc.moveDown();

            doc.fontSize(13).text('Package Details', { underline: true });
            doc.fontSize(12).text(`Weight: ${shipping?.packageDetails?.weight || shipping?.package?.weight || 'N/A'}`);
            doc.text(`Package Type: ${shipping?.packageDetails?.packageType || shipping?.package?.packageType || 'N/A'}`);
            doc.text(`Estimated Delivery: ${shipping?.estimatedDeliveryDate ? new Date(shipping.estimatedDeliveryDate).toDateString() : 'N/A'}`);

            doc.moveDown(2);
            doc.fontSize(10).fillColor('gray').text('This shipping label is system generated.', { align: 'center' });

            doc.end();
        });
    }

    async calculateShippingCost(orderData) {
        const {
            items,
            deliveryAddress,
            shippingMethod = 'standard',
        } = orderData;

        const totalWeight = items.reduce((sum, item) => {
            const weight = item.product.weight || 0.5;
            return sum + (weight * item.quantity);
        }, 0);

        const zone = await this.getShippingZone(deliveryAddress.district, deliveryAddress.city);

        if (!zone) {
            throw new Error('Delivery not available to this location');
        }

        const rateConfig = zone.rates[shippingMethod];

        if (!rateConfig) {
            throw new Error(`${shippingMethod} delivery not available for this zone`);
        }

        const baseCharge = rateConfig.baseRate;
        const weightCharge = totalWeight > 1 ? (totalWeight - 1) * rateConfig.perKgRate : 0;

        const zoneCharge = this.getZoneCharge(zone.zoneType, shippingMethod);
        const totalCharge = baseCharge + weightCharge + zoneCharge;

        const orderTotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const freeShippingThreshold = rateConfig.freeShippingThreshold || 0;

        return {
            baseCharge,
            weightCharge,
            zoneCharge,
            totalCharge: orderTotal >= freeShippingThreshold ? 0 : totalCharge,
            freeShipping: orderTotal >= freeShippingThreshold,
            weight: totalWeight,
            zone: zone.zoneName,
            estimatedDays: zone.estimatedDelivery[shippingMethod]
        };

    }

    async getShippingZone(district) {
        if (!district) district = '';
        const normalizedDistrict = district.trim().toLowerCase();

        let zone = await ShippingZone.findOne({
            'district.name': { $regex: new RegExp('^' + normalizedDistrict + '$', 'i') },
            isActive: true
        });

        if (!zone) {
            // Fallback to zone type matching
            for (const [zoneType, data] of Object.entries(ZONES)) {
                if (data.districts.some(d => d.toLowerCase() === normalizedDistrict)) {
                    zone = {
                        zoneName: zoneType,
                        zoneType: zoneType,
                        rates: {
                            standard: { baseRate: 250, perKgRate: 50, freeShippingThreshold: 5000 },
                            express: { baseRate: 500, perKgRate: 100, freeShippingThreshold: 10000 },
                            same_day: { baseRate: 1000, perKgRate: 200, freeShippingThreshold: 15000 }
                        },
                        estimatedDelivery: {
                            standard: { min: 1, max: 3 },
                            express: { min: 1, max: 2 },
                            same_day: { min: 0, max: 1 }
                        }
                    };
                    break;
                }
            }
        }

        if (!zone) {
            // Universal fallback if district totally unknown to avoid 500 error
            zone = {
                zoneName: 'zone3',
                zoneType: 'zone3',
                rates: {
                    standard: { baseRate: 350, perKgRate: 50, freeShippingThreshold: 5000 },
                    express: { baseRate: 600, perKgRate: 100, freeShippingThreshold: 10000 },
                    same_day: { baseRate: 1000, perKgRate: 200, freeShippingThreshold: 15000 }
                },
                estimatedDelivery: {
                    standard: { min: 1, max: 5 },
                    express: { min: 1, max: 3 },
                    same_day: { min: 0, max: 2 }
                }
            };
        }

        return zone;
    }

    getZoneCharge(zoneType, shippingMethod) {
        const zoneCharges = {
            'zone1': { standard: 100, express: 300, same_day: 500 },
            'zone2': { standard: 200, express: 400, same_day: 0 },
            'zone3': { standard: 300, express: 500, same_day: 0 },
        };

        return zoneCharges[zoneType]?.[shippingMethod] || 0;
    }

    async createShipping(orderId, vendorId) {
        const order = await Order.findById(orderId)
            .populate({
                path: 'items',
                populate: { path: 'product' }
            })
            .populate('user');

        if (!order) {
            throw new Error('Order not found');
        }

        // Get vendor items
        const vendorItems = (order.items || []).filter((item) => {
            const itemVendorId = item?.vendor ? String(item.vendor) : '';
            return itemVendorId && itemVendorId === String(vendorId);
        });

        if (vendorItems.length === 0) {
            throw new Error('No items for this vendor');
        }

        const totalWeight = vendorItems.reduce((sum, item) => {
            const weight = item.product?.weight || 0.5;
            return sum + (weight * item.quantity);
        }, 0);

        const packageType = totalWeight < 2 ? 'small_box' :
            totalWeight < 5 ? 'medium_box' : 'large_box';

        const courierPartner = await this.assignCourier(order.shippingAddress.district, order.shippingMethod);

        const estimatedDeliveryDate = await this.calculateDeliveryDate(
            order.shippingAddress.district,
            order.shippingMethod
        );

        const selectedOrderItem = vendorItems[0];
        const courierName = await this.assignCourier(order.shippingAddress.district, order.shippingMethod);
        const trackingNumber = this.generateTrackingNumber(courierName);

        // Create shipping record
        const shipping = new Shipping({
            order: orderId,
            orderItem: selectedOrderItem._id,
            vendor: vendorId,
            customer: order.user._id,
            shipmentType: order.shippingMethod,
            courierPartner: {
                name: courierName,
            },
            shippingAddress: {
                fullName: order.shippingAddress.fullName,
                phone: order.shippingAddress.phone,
                alternatePhone: order.shippingAddress.alternatePhone,
                addressLine1: order.shippingAddress.addressLine1,
                addressLine2: order.shippingAddress.addressLine2,
                city: order.shippingAddress.city,
                district: order.shippingAddress.district,
                postalCode: order.shippingAddress.postalCode,
                country: order.shippingAddress.country || 'Sri Lanka',
                addressType: order.shippingAddress.addressType,
            },
            package: {
                weight: totalWeight,
                packageType: packageType === 'small_box' ? 'box' : 'parcel',
                packageValue: vendorItems.reduce((sum, item) => sum + item.finalPrice, 0),
            },
            shippingCost: {
                baseCharge: order.shippingCharges,
                totalCharge: order.shippingCharges,
                paidBy: 'sender'
            },
            trackingNumber,
            estimatedDeliveryDate,
            status: 'label_created',
            trackingEvents: [{
                status: 'label_created',
                timestamp: new Date(),
                description: 'Shipping created, awaiting pickup'
            }]
        });

        await shipping.save();

        await OrderTimeline.create({
            order: orderId,
            event: 'processing_started',
            title: 'Shipping Label Created',
            description: `Shipping created via ${courierPartner}`,
            actorType: 'system',
            metadata: { trackingNumber: shipping.trackingNumber }
        });

        return shipping;
    }

    async assignCourier(district, shippingMethod) {

        const zone = await ShippingZone.findOne({
            'districts.name': district,
            isActive: true
        });

        if (!zone || !zone.availableCouriers || zone.availableCouriers.length === 0) {
            return 'pronto';
        }

        const availableCouriers = zone.availableCouriers
            .filter(c => c.available)
            .sort((a, b) => a.priority - b.priority);

        // Special handling for same-day delivery
        if (shippingMethod === 'same_day') {
            const sameDayCouriers = ['uber', 'pickme_flash'];
            const courier = availableCouriers.find(c => sameDayCouriers.includes(c.courier));
            return courier?.courier || 'pickme_flash';
        }

        return availableCouriers[0]?.courier || 'pronto';
    }

    async calculateDeliveryDate(district, shippingMethod) {

        const zone = await this.getShippingZone(district);
        if (!zone) {
            const defaultDays = {
                'standard': 5,
                'express': 2,
                'same_day': 0
            };

            const days = defaultDays[shippingMethod] || 5;
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + days);
            return deliveryDate;
        }

        const estimatedDays = zone.estimatedDelivery[shippingMethod];
        const deliveryDate = new Date();

        if (shippingMethod === 'same_day') {
            return deliveryDate;
        }

        const maxDays = estimatedDays?.max || 5;
        deliveryDate.setDate(deliveryDate.getDate() + maxDays);

        return deliveryDate;
    }

    async schedulePickup(shippingId, pickupData) {

        const shipping = await Shipping.findById(shippingId);
        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.pickupAddress = pickupData.pickupAddress;
        shipping.estimatedPickupDate = pickupData.pickupDate;
        shipping.status = 'pickup_scheduled';

        shipping.trackingEvents = shipping.trackingEvents || [];
        shipping.trackingEvents.push({
            status: 'pickup_scheduled',
            timestamp: new Date(),
            description: `Pickup scheduled for ${pickupData.pickupDate.toLocaleDateString()}`,
            location: {
                district: pickupData.pickupAddress.district
            }
        });

        await shipping.save();

        return shipping;
    }

    async updateStatus(shippingId, statusData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        const { status, location, note, updatedBy, scanType } = statusData;
        const nextStatus = this.normalizeShippingStatus(status);
        const currentStatus = this.normalizeShippingStatus(shipping.status);

        if (!this.isValidStatusTransition(currentStatus, nextStatus)) {
            throw new Error(`Invalid status transition from ${currentStatus} to ${nextStatus}`);
        }

        shipping.status = nextStatus;

        if (location) {
            shipping.currentLocation = {
                ...location,
                lastUpdated: new Date()
            };
        }

        shipping.trackingEvents = shipping.trackingEvents || [];
        shipping.trackingEvents.push({
            status: nextStatus,
            location,
            timestamp: new Date(),
            description: note || `Shipment ${nextStatus}`,
            scannedBy: updatedBy || scanType || 'system'
        });

        // Update specific dates
        switch (nextStatus) {
            case 'picked_up':
                shipping.actualPickupDate = new Date();
                break;
            case 'delivered':
                shipping.actualDeliveryDate = new Date();
                break;
        }

        await shipping.save();

        await OrderTimeline.create({
            order: shipping.order,
            event: this.mapStatusToEvent(nextStatus),
            title: this.getStatusTitle(nextStatus),
            description: note || `Shipment ${nextStatus}`,
            actorType: 'courier',
            location: location
        });

        return shipping;
    }

    normalizeShippingStatus(status) {
        const value = String(status || '').toLowerCase();
        const aliases = {
            pending: 'label_created',
            reached_hub: 'in_transit',
            failed_delivery: 'failed',
            returned_to_vendor: 'returned_to_sender',
        };
        return aliases[value] || value;
    }

    //statsus of shipping
    isValidStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'label_created': ['pickup_scheduled', 'picked_up', 'cancelled', 'on_hold'],
            'pickup_scheduled': ['picked_up', 'cancelled'],
            'picked_up': ['in_transit', 'cancelled', 'on_hold'],
            'in_transit': ['out_for_delivery', 'failed', 'lost', 'damaged', 'on_hold'],
            'out_for_delivery': ['delivered', 'failed', 'on_hold'],
            'failed': ['out_for_delivery', 'returned_to_sender', 'cancelled'],
            'on_hold': ['in_transit', 'out_for_delivery', 'cancelled'],
            'delivered': [],
            'returned_to_sender': [],
            'lost': [],
            'damaged': [],
            'cancelled': []
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    }

    mapStatusToEvent(status) {
        const mapping = {
            'label_created': 'ready_to_ship',
            'pickup_scheduled': 'ready_to_ship',
            'picked_up': 'picked_up',
            'in_transit': 'in_transit',
            'out_for_delivery': 'out_for_delivery',
            'delivered': 'delivered',
            'failed': 'delivery_failed',
            'returned_to_sender': 'return_received',
            'on_hold': 'in_transit',
            'lost': 'delivery_failed',
            'damaged': 'delivery_failed'
        };
        return mapping[status] || 'in_transit';
    }

    getStatusTitle(status) {
        const titles = {
            'label_created': 'Label Created',
            'pickup_scheduled': 'Pickup Scheduled',
            'picked_up': 'Package Picked Up',
            'in_transit': 'In Transit',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'failed': 'Delivery Failed',
            'returned_to_sender': 'Returned to Sender',
            'on_hold': 'Shipment On Hold',
            'lost': 'Shipment Lost',
            'damaged': 'Shipment Damaged'
        };
        return titles[status] || status;
    }


    async recordDeliveryAttempt(shippingId, attemptData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        const attemptNumber = shipping.deliveryAttempts.length + 1;

        shipping.deliveryAttempts.push({
            attemptNumber,
            attemptDate: new Date(),
            status: attemptData.status,
            reason: attemptData.reason,
            nextAttemptDate: attemptData.nextAttemptDate,
            deliveryAgentNotes: attemptData.notes,
            customerContact: attemptData.customerContact,
            photo: attemptData.photo
        });

        if (attemptData.status === 'delivered') {
            shipping.status = 'delivered';
            shipping.actualDeliveryDate = new Date();
        } else if (attemptNumber >= 3 && attemptData.status === 'failed') {
            shipping.status = 'returned_to_vendor';
        } else {
            shipping.status = 'failed_delivery';
        }

        await shipping.save();

        return shipping;
    }

    async confirmDelivery(shippingId, deliveryData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.proofOfDelivery = {
            signature: deliveryData.signature,
            photo: deliveryData.photo,
            recipientName: deliveryData.recipientName,
            recipientNIC: deliveryData.recipientNIC,
            recipientRelation: deliveryData.recipientRelation,
            deliveryNotes: deliveryData.notes,
            timestamp: new Date(),
            location: deliveryData.location
        };

        shipping.deliveryAgent = deliveryData.deliveryAgent;
        shipping.status = 'delivered';
        shipping.actualDeliveryDate = new Date();

        shipping.statusHistory.push({
            status: 'delivered',
            timestamp: new Date(),
            note: `Delivered to ${deliveryData.recipientName}`,
            updatedBy: deliveryData.deliveryAgent.name,
            location: {
                city: shipping.deliveryAddress.city,
                coordinates: deliveryData.location
            }
        });

        await shipping.save();

        // Update order status
        const order = await Order.findById(shipping.order);
        const allItemsDelivered = order.items.every(item => 
            item.status === 'delivered'
        );

        if (allItemsDelivered) {
            order.overallStatus = 'delivered';
            await order.save();
        }

        await OrderTimeline.create({
            order: shipping.order,
            event: 'delivered',
            title: 'Order Delivered',
            description: `Package delivered to ${deliveryData.recipientName}`,
            actorType: 'courier',
            metadata: {
                recipientName: deliveryData.recipientName,
                deliveryAgent: deliveryData.deliveryAgent.name
            }
        });

        return shipping;
    }

    async trackShipment(trackingNumber) {

        const shipping = await Shipping.findOne({ trackingNumber })
            .populate('order', 'orderNumber');

        if (!shipping) {
            throw new Error('Tracking number not found');
        }

        return {
            trackingNumber: shipping.trackingNumber,
            status: shipping.status,
            estimatedDelivery: shipping.estimatedDeliveryDate,
            currentLocation: shipping.currentLocation,
            statusHistory: shipping.statusHistory,
            deliveryAddress: shipping.deliveryAddress,
            deliveryAgent: shipping.deliveryAgent,
            deliveryAttempts: shipping.deliveryAttempts,
            proofOfDelivery: shipping.proofOfDelivery
        };
    }

    async reportIssue(shippingId, issueData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.issues.push({
            type: issueData.type,
            severity: issueData.severity,
            description: issueData.description,
            reportedBy: issueData.reportedBy,
            reportedAt: new Date(),
            photos: issueData.photos || []
        });

        if (issueData.severity === 'critical') {
            shipping.status = 'on_hold';
        }

        await shipping.save();

        return shipping;
    }

    async submitRating(shippingId, ratingData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        if (shipping.status !== 'delivered') {
            throw new Error('Can only rate delivered shipments');
        }

        const overall = Math.round(
            (ratingData.deliverySpeed + ratingData.courierBehavior + ratingData.packaging) / 3
        );

        shipping.rating = {
            deliverySpeed: ratingData.deliverySpeed,
            courierBehavior: ratingData.courierBehavior,
            packaging: ratingData.packaging,
            overall,
            feedback: ratingData.feedback,
            ratedAt: new Date()
        };

        await shipping.save();

        return shipping;
    }

    async generateShippingLabel(shippingId) {
        const shipping = await Shipping.findById(shippingId).populate('order', 'orderNumber');

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        const labelsDir = this.ensureLabelDirectory();
        const safeTracking = this.sanitizeFileName(shipping.trackingNumber || `SHIP-${shipping._id}`);
        const fileName = `${safeTracking}.pdf`;
        const absoluteFilePath = path.join(labelsDir, fileName);

        if (!fs.existsSync(absoluteFilePath)) {
            await this.createLabelPdf(shipping, absoluteFilePath);
        }

        if (!shipping.documents) {
            shipping.documents = {};
        }

        if (!shipping.documents.shippingLabel) {
            const baseUrl = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
            const tracking = shipping.trackingNumber || `SHIP-${shipping._id}`;
            shipping.documents.shippingLabel = `${baseUrl}/labels/${fileName}`;

            shipping.statusHistory = shipping.statusHistory || [];
            shipping.statusHistory.push({
                status: shipping.status,
                timestamp: new Date(),
                note: 'Shipping label generated',
                scanType: 'label_created'
            });

            await shipping.save();

            await OrderTimeline.create({
                order: shipping.order?._id || shipping.order,
                event: 'label_created',
                title: 'Shipping Label Created',
                description: `Label generated for tracking ${tracking}`,
                actorType: 'system',
                metadata: {
                    trackingNumber: tracking,
                    labelUrl: shipping.documents.shippingLabel,
                }
            });
        }

        return {
            shippingId: shipping._id,
            orderNumber: shipping.order?.orderNumber,
            trackingNumber: shipping.trackingNumber,
            labelUrl: shipping.documents.shippingLabel,
            fileName,
        };
    }
}
module.exports = new ShippingService();