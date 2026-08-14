import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';

const NotificationToast = () => {
  const { isAuthenticated, user } = useAuth();
  const { notifications, loading } = useNotifications({ pageSize: 10, pollIntervalMs: 45000 });
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !user || loading) return;

    const unread = notifications.filter((n) => !n.isRead);

    unread.forEach((notification) => {
      if (seenIds.current.has(notification._id)) return;

      seenIds.current.add(notification._id);
      toast.info(notification.title, {
        description: notification.message,
        duration: 5000,
      });
    });
  }, [isAuthenticated, loading, notifications, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      seenIds.current.clear();
    }
  }, [isAuthenticated, user]);

  return null;
};

export default NotificationToast;
