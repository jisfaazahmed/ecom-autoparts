import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
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

interface Policy {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  sections?: Array<{ title: string; content: string; order?: number }>;
  faqItems?: Array<{ question: string; answer: string; category: string }>;
  metadata?: {
    cancellationWindow?: number;
    refundProcessingDays?: number;
    [key: string]: any;
  };
}

const CancellationPolicy: React.FC = () => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicy('cancellation');
        setPolicy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cancellation policy');
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
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-pink-400 bg-clip-text text-transparent mb-4">
                {policy.title}
              </h1>
              <p className="text-slate-400 text-lg">{policy.description}</p>
            </div>

            {/* Key Timeframes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policy.metadata?.cancellationWindow && (
                <Card className="border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/10">
                  <CardContent className="flex flex-col items-center justify-center pt-6">
                    <RotateCcw className="w-10 h-10 text-red-400 mb-4" />
                    <h3 className="font-semibold text-center text-red-400 mb-2">Cancellation Window</h3>
                    <p className="text-2xl font-bold text-red-300 mb-2">
                      {policy.metadata.cancellationWindow} hours
                    </p>
                    <p className="text-xs text-slate-400 text-center">
                      Time to cancel after order placement
                    </p>
                  </CardContent>
                </Card>
              )}

              {policy.metadata?.refundProcessingDays && (
                <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-red-500/10">
                  <CardContent className="flex flex-col items-center justify-center pt-6">
                    <AlertTriangle className="w-10 h-10 text-orange-400 mb-4" />
                    <h3 className="font-semibold text-center text-orange-400 mb-2">Refund Processing</h3>
                    <p className="text-2xl font-bold text-orange-300 mb-2">
                      {policy.metadata.refundProcessingDays} days
                    </p>
                    <p className="text-xs text-slate-400 text-center">
                      Time to process your refund
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Important Notice */}
            <Card className="border-yellow-500/30 bg-yellow-500/10">
              <CardHeader>
                <CardTitle className="text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Important Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                <ul className="list-disc list-inside space-y-2">
                  <li>Orders can only be cancelled before they are confirmed for shipment</li>
                  <li>Shipped orders cannot be cancelled but can be returned after delivery</li>
                  <li>Cash-on-Delivery (COD) orders cannot be cancelled after confirmation</li>
                  <li>Refunds will be credited to the original payment method</li>
                </ul>
              </CardContent>
            </Card>

            {/* Main Content */}
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: policy.content }}
            />

            {/* Sections */}
            {policy.sections && policy.sections.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-2xl font-bold text-red-400">Cancellation Process</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.sections
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((section, index) => (
                      <AccordionItem
                        key={index}
                        value={String(index)}
                        className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:text-red-400">
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
                <h2 className="text-2xl font-bold text-red-400">Frequently Asked Questions</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.faqItems.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:text-red-400">
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
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-red-400 mb-3">Need to Cancel Your Order?</h3>
              <p className="text-slate-400 mb-6">
                Visit your orders page to check cancellation eligibility and process your cancellation.
              </p>
              <Button
                onClick={() => {
                  window.location.href = '/pages/orders';
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Go to My Orders
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default CancellationPolicy;
