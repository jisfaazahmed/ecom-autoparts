/**
 * Background Jobs for E-commerce Platform
 * Handles periodic tasks like releasing expired reservations
 */

const InventoryReservationService = require('../services/inventoryReservation.service');
const Order = require('../models/order.model');
const Payment = require('../models/payment.model');
const OrderTimeline = require('../models/timeline.model');

// Card/wallet orders that never completed payment are released after this long.
const UNPAID_ORDER_TTL_MINUTES = Number(process.env.UNPAID_ORDER_TTL_MINUTES || 60);
// A COD order awaiting phone verification is chased again after this long.
const COD_FOLLOWUP_HOURS = Number(process.env.COD_FOLLOWUP_HOURS || 12);

class BackgroundJobs {
    /**
     * Initialize background jobs
     */
    static initializeJobs() {
        console.log('🔄 Initializing background jobs...');

        // Release expired reservations every 5 minutes
        this.startReleaseExpiredReservations();

        // Release stock held by orders that were never paid for
        this.startCancelUnpaidOrders();

        // Chase COD orders still waiting on phone verification
        this.startCODVerificationFollowUp();
    }

    static schedule(name, intervalMs, task) {
        console.log(`✓ Scheduled ${name} every ${Math.round(intervalMs / 60000)} minutes`);

        const timer = setInterval(async () => {
            try {
                await task();
            } catch (error) {
                console.error(`❌ Error in ${name}:`, error.message);
            }
        }, intervalMs);

        // Don't hold the event loop open on shutdown.
        if (typeof timer.unref === 'function') {
            timer.unref();
        }

        return timer;
    }

    /**
     * Release expired inventory reservations
     * Run every 5 minutes to clean up old reservations
     */
    static startReleaseExpiredReservations() {
        return this.schedule(
            'inventory cleanup job',
            5 * 60 * 1000,
            () => InventoryReservationService.releaseExpiredReservations()
        );
    }

    /**
     * Cancel card/wallet orders that never completed payment so their stock
     * goes back on sale. COD is excluded - it is unpaid by design.
     */
    static startCancelUnpaidOrders() {
        return this.schedule('unpaid order cleanup', 15 * 60 * 1000, async () => {
            const cutoff = new Date(Date.now() - UNPAID_ORDER_TTL_MINUTES * 60 * 1000);

            const staleOrders = await Order.find({
                paymentMethod: { $in: ['card', 'wallet'] },
                paymentStatus: { $in: ['pending', 'processing', 'failed'] },
                overallStatus: 'pending',
                createdAt: { $lte: cutoff },
            }).select('_id orderNumber').limit(100);

            if (staleOrders.length === 0) {
                return;
            }

            // Required lazily: order.service pulls in Stripe via payment.service.
            const orderService = require('../services/order.service');

            for (const order of staleOrders) {
                try {
                    await orderService.cancelOrder(
                        order._id,
                        null,
                        `Payment not completed within ${UNPAID_ORDER_TTL_MINUTES} minutes`,
                        'system'
                    );
                    console.log(`↩️  Cancelled unpaid order ${order.orderNumber}`);
                } catch (error) {
                    console.error(`Failed to cancel unpaid order ${order.orderNumber}:`, error.message);
                }
            }
        });
    }

    /**
     * Records a follow-up timeline entry for COD orders still stuck awaiting
     * verification, so staff have a queue to work rather than silent stalls.
     */
    static startCODVerificationFollowUp() {
        return this.schedule('COD verification follow-up', 60 * 60 * 1000, async () => {
            const cutoff = new Date(Date.now() - COD_FOLLOWUP_HOURS * 60 * 60 * 1000);

            const pending = await Payment.find({
                paymentMethod: 'cod',
                status: 'pending',
                'codDetails.verificationStatus': 'pending',
                updatedAt: { $lte: cutoff },
            }).select('_id order paymentNumber codDetails').limit(100);

            for (const payment of pending) {
                const attempts = (payment.codDetails?.verificationAttempts || []).length;

                if (attempts >= 3) {
                    continue;
                }

                try {
                    const paymentService = require('../services/payment.service');
                    await paymentService.initiateCODVerification(payment._id);

                    await OrderTimeline.create({
                        order: payment.order,
                        event: 'cod_verification_initiated',
                        title: 'COD Verification Follow-up',
                        description: `Verification re-attempted (attempt ${attempts + 1})`,
                        actorType: 'system',
                    });
                } catch (error) {
                    console.error(`COD follow-up failed for ${payment.paymentNumber}:`, error.message);
                }
            }
        });
    }
}

module.exports = BackgroundJobs;
