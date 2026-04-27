import React from 'react';
import { Bell, CheckCheck, Clock3, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { ApiNotification } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: ApiNotification[];
  loading: boolean;
  refreshing: boolean;
  unreadCount: number;
  error: string | null;
  onRefresh: () => Promise<void>;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDeleteOne: (notificationId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

const typeBadgeColor: Record<string, string> = {
  order_placed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  order_confirmed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  order_shipped: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  order_delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  refund_initiated: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  refund_completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  payment_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  payment_success: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
};

function formatType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRelativeTime(iso: string) {
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  onOpenChange,
  notifications,
  loading,
  refreshing,
  unreadCount,
  error,
  onRefresh,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteOne,
  onClearAll,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 text-primary">
                {unreadCount} unread
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => void onRefresh()} disabled={refreshing || loading}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => void onMarkAllAsRead()} disabled={unreadCount === 0 || loading}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onClearAll()} disabled={notifications.length === 0 || loading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          <div className="p-4 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading notifications...
              </div>
            )}

            {!loading && error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-60" />
                <p className="font-medium">No notifications yet</p>
                <p className="text-sm">Order and refund updates will appear here.</p>
              </div>
            )}

            {!loading && !error && notifications.map((notification) => (
              <div
                key={notification._id}
                className={`rounded-lg border p-4 transition-colors ${notification.isRead ? 'border-border/40 bg-secondary/20' : 'border-primary/40 bg-primary/5'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={typeBadgeColor[notification.type] || 'bg-secondary text-secondary-foreground'}>
                        {formatType(notification.type)}
                      </Badge>
                      {!notification.isRead && <Badge className="bg-primary text-primary-foreground">New</Badge>}
                    </div>
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-sm text-muted-foreground break-words">{notification.message}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {getRelativeTime(notification.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void onMarkAsRead(notification._id)}
                        className="text-primary"
                      >
                        Read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void onDeleteOne(notification._id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationCenter;
