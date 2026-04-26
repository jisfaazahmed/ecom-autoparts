import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Truck, MapPin, Clock } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { formatLKR } from '@/lib/currency';

interface Policy {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  sections?: Array<{ title: string; content: string; order?: number }>;
  faqItems?: Array<{ question: string; answer: string; category: string }>;
  metadata?: {
    freeShippingThreshold?: number;
    shippingChargePolicy?: string;
    [key: string]: any;
  };
}

const SHIPPING_POLICY_FALLBACK: Policy = {
  title: 'Shipping Policy',
  description: 'Delivery timelines, shipping charges, and tracking rules for your orders.',
  content: `
    <p>We ship automotive parts across the country using reliable courier partners. Shipping cost, delivery time, and carrier availability can vary depending on your delivery zone and package weight.</p>
    <ul>
      <li><strong>Metro/major cities:</strong> typically delivered in 1-3 business days.</li>
      <li><strong>Other regions:</strong> typically delivered in 3-7 business days.</li>
      <li><strong>Tracking:</strong> every dispatched order receives a tracking number.</li>
      <li><strong>Free shipping:</strong> may apply for eligible orders above the minimum threshold.</li>
    </ul>
  `,
  sections: [
    {
      title: 'Shipping Charges',
      order: 1,
      content: `
        <p>Shipping charges are calculated at checkout based on package weight, delivery location, and selected service level. Express or same-day delivery, where available, will incur an additional charge.</p>
      `,
    },
    {
      title: 'Delivery Timeframes',
      order: 2,
      content: `
        <p>Orders are usually processed within 24 hours on business days. Delivery estimates are provided at checkout and are subject to stock availability, courier capacity, and public holidays.</p>
      `,
    },
    {
      title: 'Tracking Your Order',
      order: 3,
      content: `
        <p>Once your order ships, we send tracking details by email and/or in-app notification. You can use the tracking number on the carrier website or your order details page to monitor progress.</p>
      `,
    },
    {
      title: 'Delivery Issues',
      order: 4,
      content: `
        <p>If your parcel arrives damaged, incomplete, or delayed beyond the expected window, contact our support team with your order number and photos if applicable. We will help resolve the issue as quickly as possible.</p>
      `,
    },
  ],
  faqItems: [
    {
      question: 'Do you offer free shipping?',
      answer: 'Yes, eligible orders may qualify for free shipping once the minimum order threshold is met.',
      category: 'shipping',
    },
    {
      question: 'Can I change my delivery address after placing an order?',
      answer: 'Address changes may be possible before dispatch. Contact support immediately if you need to update your address.',
      category: 'shipping',
    },
    {
      question: 'What if my package is delayed?',
      answer: 'Check tracking first. If there is no update for a long time, contact support and we will coordinate with the courier.',
      category: 'shipping',
    },
  ],
  metadata: {
    freeShippingThreshold: 15000,
    shippingChargePolicy: 'Calculated by weight and delivery zone',
  },
};

const ShippingPolicy: React.FC = () => {
  const [policy, setPolicy] = useState<Policy | null>(SHIPPING_POLICY_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicy('shipping');
        setPolicy(data || SHIPPING_POLICY_FALLBACK);
      } catch (err) {
        setPolicy(SHIPPING_POLICY_FALLBACK);
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Navbar />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {policy ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4">
                {policy.title}
              </h1>
              <p className="text-slate-400 text-lg">{policy.description}</p>
            </div>

            {/* Shipping Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <Truck className="w-10 h-10 text-blue-400 mb-4" />
                  <h3 className="font-semibold text-center text-blue-400 mb-2">Fast Delivery</h3>
                  <p className="text-sm text-slate-400 text-center">
                    Nationwide delivery network for quick shipping
                  </p>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <MapPin className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="font-semibold text-center text-cyan-400 mb-2">Zone-Based Pricing</h3>
                  <p className="text-sm text-slate-400 text-center">
                    Transparent rates based on delivery location
                  </p>
                </CardContent>
              </Card>

              <Card className="border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-cyan-500/10">
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <Clock className="w-10 h-10 text-teal-400 mb-4" />
                  <h3 className="font-semibold text-center text-teal-400 mb-2">Real-Time Tracking</h3>
                  <p className="text-sm text-slate-400 text-center">
                    Track your order status at every step
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Free Shipping Info */}
            {policy.metadata?.freeShippingThreshold && (
              <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-blue-400">Free Shipping Offer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg text-slate-300 mb-4">
                    Get free shipping on orders above{' '}
                    <span className="font-bold text-blue-400">
                      {formatLKR(policy.metadata.freeShippingThreshold)}
                    </span>
                  </p>
                  <div className="bg-slate-800/50 rounded p-4 text-slate-300 text-sm">
                    This offer applies to selected areas. Checkout to see if your delivery address is eligible.
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content */}
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: policy.content }}
            />

            {/* Sections */}
            {policy.sections && policy.sections.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-2xl font-bold text-blue-400">Shipping Details</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.sections
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((section, index) => (
                      <AccordionItem
                        key={index}
                        value={String(index)}
                        className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:text-blue-400">
                          {section.title}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-300 pt-4">
                          <div
                            className="prose prose-sm prose-invert"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </div>
            )}

            {/* FAQ */}
            {policy.faqItems && policy.faqItems.length > 0 && (
              <div className="space-y-4 mt-12 pt-12 border-t border-slate-700">
                <h2 className="text-2xl font-bold text-blue-400">Frequently Asked Questions</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.faqItems.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:text-blue-400">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 pt-4">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-blue-400 mb-3">Need Shipping Help?</h3>
              <p className="text-slate-400 mb-6">
                Contact our logistics team for any shipping-related questions or concerns.
              </p>
              <Button
                onClick={() => {
                  window.location.href = 'mailto:logistics@ecom-autoparts.com';
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                Contact Logistics Team
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default ShippingPolicy;
