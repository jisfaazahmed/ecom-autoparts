import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import PolicyManager from '@/components/admin/PolicyManager';

const SuperAdminPolicies: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Navbar />

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-2">
              Policy Management
            </h1>
            <p className="text-slate-400">
              Create and manage store policies including returns, shipping, cancellations, and more.
            </p>
          </div>

          <PolicyManager />
        </motion.div>
      </div>
    </div>
  );
};

export default SuperAdminPolicies;
