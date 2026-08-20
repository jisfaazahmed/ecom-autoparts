import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useSeo } from '@/hooks/useSeo';

interface Policy {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  sections?: Array<{ title: string; content: string; order?: number }>;
  faqItems?: Array<{ question: string; answer: string; category: string }>;
  updatedAt?: string;
}

const TERMS_POLICY_FALLBACK: Policy = {
  title: 'Terms & Conditions',
  description: 'The rules that govern use of the Ecom Auto Parts platform and services.',
  content: `
    <p>These terms explain how you may use our website, place orders, and interact with our services. By using the platform, you agree to follow these terms and all applicable laws.</p>
    <ul>
      <li><strong>Account use:</strong> keep your login details secure and accurate.</li>
      <li><strong>Order accuracy:</strong> review fitment, part numbers, and shipping details before confirming.</li>
      <li><strong>Payments:</strong> all payments must be authorized by the cardholder or account owner.</li>
      <li><strong>Prohibited use:</strong> fraud, abuse, and reverse engineering of the platform are not allowed.</li>
    </ul>
  `,
  sections: [
    {
      title: 'Using the Platform',
      order: 1,
      content: `
        <p>You may browse and purchase products for personal or business use, provided you do not misuse the site or interfere with other users, vendors, or platform operations.</p>
      `,
    },
    {
      title: 'User Accounts',
      order: 2,
      content: `
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately if you suspect unauthorized access.</p>
      `,
    },
    {
      title: 'Orders, Pricing, and Availability',
      order: 3,
      content: `
        <p>Product information, pricing, and availability may change without notice. We reserve the right to correct errors, cancel suspicious transactions, or refuse service where necessary.</p>
      `,
    },
    {
      title: 'Intellectual Property',
      order: 4,
      content: `
        <p>All content, branding, product data, and design elements on the platform remain the property of Ecom Auto Parts or its licensors and may not be copied or reused without permission.</p>
      `,
    },
  ],
  faqItems: [
    {
      question: 'Do I need an account to place an order?',
      answer: 'Some checkout flows may require an account to track orders and manage returns. Guest browsing may still be available.',
      category: 'accounts',
    },
    {
      question: 'Can terms change without notice?',
      answer: 'Yes. We may update the terms from time to time, so we recommend reviewing this page periodically.',
      category: 'legal',
    },
    {
      question: 'What happens if a listing has an error?',
      answer: 'If we discover an obvious pricing or listing error, we may correct it, cancel the order, or contact you before proceeding.',
      category: 'orders',
    },
  ],
  updatedAt: new Date().toISOString(),
};

const TermsConditions: React.FC = () => {
  useSeo({
    title: 'Terms & Conditions',
    description:
      'The terms governing use of the AutoMatrix marketplace by buyers and sellers, including orders, payments and liability.',
    path: '/policy/terms',
  });
  const [policy, setPolicy] = useState<Policy | null>(TERMS_POLICY_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicy('terms_conditions');
        setPolicy(data || TERMS_POLICY_FALLBACK);
      } catch (err) {
        setPolicy(TERMS_POLICY_FALLBACK);
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
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                {policy.title}
              </h1>
              <p className="text-slate-400 text-lg">{policy.description}</p>
              {policy.updatedAt && (
                <p className="text-slate-500 text-sm mt-4">
                  Last Updated: {new Date(policy.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>

            {/* Acceptance Notice */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
              <h3 className="font-semibold text-indigo-400 mb-3">Terms of Service Agreement</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                By accessing and using this platform, you accept and agree to be bound by the terms and provision of this
                agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            {/* Main Content */}
            <div
              className="prose prose-invert max-w-none text-slate-300"
              dangerouslySetInnerHTML={{ __html: policy.content }}
            />

            {/* Sections */}
            {policy.sections && policy.sections.length > 0 && (
              <div className="space-y-4 mt-12">
                <h2 className="text-2xl font-bold text-indigo-400">Full Terms & Conditions</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.sections
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((section, index) => (
                      <AccordionItem
                        key={index}
                        value={String(index)}
                        className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:text-indigo-400 text-left">
                          <span className="font-medium">{index + 1}. {section.title}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-300 pt-4">
                          <div
                            className="prose prose-sm prose-invert space-y-3"
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
                <h2 className="text-2xl font-bold text-indigo-400">Frequently Asked Questions</h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {policy.faqItems.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="border-slate-700 data-[state=open]:bg-slate-700/50 rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:text-indigo-400">
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

            {/* Acceptance Checkbox (Visual) */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mt-12">
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-200">User Responsibilities</h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <p>✓ You must be at least 18 years old to use this platform</p>
                  <p>✓ You must provide accurate and complete information</p>
                  <p>✓ You are responsible for maintaining the confidentiality of your account</p>
                  <p>✓ You agree not to engage in illegal or unauthorized activities</p>
                  <p>✓ You understand we reserve the right to suspend or terminate your account</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-indigo-400 mb-3">Questions About Our Terms?</h3>
              <p className="text-slate-400 mb-6">
                If you have any questions or concerns about these terms and conditions, please don't hesitate to contact us.
              </p>
              <Button
                onClick={() => {
                  window.location.href = 'mailto:legal@ecom-autoparts.com';
                }}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
              >
                Contact Legal Team
              </Button>
            </div>

            {/* Disclaimer */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">
                These terms and conditions are subject to change at any time without notice. We recommend reviewing this
                page periodically for updates.
              </p>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default TermsConditions;
