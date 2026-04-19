import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, ChevronDown } from 'lucide-react';
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

interface PolicySection {
  title: string;
  content: string;
  order?: number;
}

interface Policy {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  sections?: PolicySection[];
  faqItems?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

const ReturnPolicy: React.FC = () => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('0');

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicy('return');
        setPolicy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load return policy');
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
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent mb-4">
                {policy.title}
              </h1>
              <p className="text-slate-400 text-lg">{policy.description}</p>
            </div>

            {/* Key Info Card */}
            {policy.metadata && (
              <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <CardHeader>
                  <CardTitle className="text-amber-400">Quick Facts</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {policy.metadata.returnDays && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-400 mb-2">
                        {policy.metadata.returnDays}
                      </div>
                      <div className="text-sm text-slate-400">Days to Return</div>
                    </div>
                  )}
                  {policy.metadata.restockingFeePercentage !== undefined && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-400 mb-2">
                        {policy.metadata.restockingFeePercentage}%
                      </div>
                      <div className="text-sm text-slate-400">Restocking Fee</div>
                    </div>
                  )}
                  {policy.metadata.extendedForDefects && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-400 mb-2">
                        {policy.metadata.extendedForDefects}
                      </div>
                      <div className="text-sm text-slate-400">Days for Defects</div>
                    </div>
                  )}
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
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-amber-400">Policy Details</h2>
                <Accordion type="single" collapsible value={activeSection} onValueChange={setActiveSection}>
                  {policy.sections
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((section, index) => (
                      <AccordionItem
                        key={index}
                        value={String(index)}
                        className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:text-amber-400 text-left">
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
                <h2 className="text-2xl font-bold text-amber-400">Frequently Asked Questions</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.faqItems.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:text-amber-400">
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
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-amber-400 mb-3">Have Questions?</h3>
              <p className="text-slate-400 mb-6">
                Our support team is here to help you with any queries about our return policy.
              </p>
              <Button
                onClick={() => {
                  window.location.href = 'mailto:support@ecom-autoparts.com';
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Contact Support
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default ReturnPolicy;
