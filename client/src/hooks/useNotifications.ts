import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiNotification } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface UseNotificationsResult {
  notifications: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteOne: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

interface UseNotificationsOptions {
  pageSize?: number;
  pollIntervalMs?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsResult {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const pageSize = options.pageSize ?? 20;
  const pollIntervalMs = options.pollIntervalMs ?? 30000;

  const extractErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message) {
      return err.message;
    }

    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return 'Failed to load notifications';
  };

  const loadNotifications = useCallback(async (isBackground = false) => {
    if (!isAuthenticated || !user) {
      if (isMounted.current) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      }
      return;
    }

    try {
      if (!isBackground && isMounted.current) {
        setLoading(true);
      }
      if (isBackground && isMounted.current) {
        setRefreshing(true);
      }

      const [listResponse, countResponse] = await Promise.all([
        api.getNotifications({ page: 1, limit: pageSize }),
        api.getUnreadNotificationCount(),
      ]);

      if (!isMounted.current) return;

      setNotifications(listResponse.notifications || []);
      setUnreadCount(countResponse);
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current) {
        return;
      }

      setError(extractErrorMessage(err));
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAuthenticated, pageSize, user]);

  useEffect(() => {
    isMounted.current = true;
    loadNotifications();

    return () => {
      isMounted.current = false;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const interval = window.setInterval(() => {
      loadNotifications(true);
    }, pollIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthenticated, loadNotifications, pollIntervalMs, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await api.markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await api.markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  const deleteOne = useCallback(async (notificationId: string) => {
    await api.deleteNotification(notificationId);
    setNotifications((prev) => {
      const target = prev.find((n) => n._id === notificationId);
      if (target && !target.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return prev.filter((n) => n._id !== notificationId);
    });
  }, []);

  const clearAll = useCallback(async () => {
    await api.deleteAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh: () => loadNotifications(true),
    markAsRead,
    markAllAsRead,
    deleteOne,
    clearAll,
  }), [clearAll, deleteOne, error, loadNotifications, loading, markAllAsRead, markAsRead, notifications, refreshing, unreadCount]);

  return value;
}
