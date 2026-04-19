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

const ShippingPolicy: React.FC = () => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicy('shipping');
        setPolicy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shipping policy');
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
        {error ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-red-500/50 bg-red-500/10">
              <CardContent className="flex items-start gap-4 pt-6">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-500">Error</h3>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : policy ? (
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
