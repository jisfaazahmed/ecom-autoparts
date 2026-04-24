import React, { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteOne,
    clearAll,
  } = useNotifications();

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)} aria-label="Open notifications">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] rounded-full bg-primary px-1 text-primary-foreground text-[10px] leading-5 text-center font-bold"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </Button>

      <NotificationCenter
        open={open}
        onOpenChange={setOpen}
        notifications={notifications}
        loading={loading}
        refreshing={refreshing}
        unreadCount={unreadCount}
        error={error}
        onRefresh={refresh}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDeleteOne={deleteOne}
        onClearAll={clearAll}
      />
    </>
  );
};

export default NotificationBell;
