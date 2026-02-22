import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Info, Lightbulb, TrendingUp, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getDemoInsights, isDemoId } from "@/lib/demo-content";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_label?: string | null;
  action_type?: string | null;
  dismissed: boolean;
  created_at: string;
}

type NotificationBadgeVariant = "destructive" | "secondary" | "outline";

const typeConfig: Record<string, { icon: typeof Bell; color: string; badge: NotificationBadgeVariant }> = {
  critical: { icon: AlertTriangle, color: "text-destructive", badge: "destructive" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", badge: "secondary" },
  info: { icon: Info, color: "text-blue-500", badge: "secondary" },
  opportunity: { icon: TrendingUp, color: "text-emerald-500", badge: "secondary" },
  anomaly: { icon: Lightbulb, color: "text-purple-500", badge: "secondary" },
  digest: { icon: TrendingUp, color: "text-primary", badge: "outline" },
};

export function NotificationsDropdown() {
  const { account } = useAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!account?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("account_id", account.id)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setNotifications(data as Notification[]);
        return;
      }

      setNotifications(getDemoInsights(account.id) as Notification[]);
    };
    fetch();
  }, [account?.id, open]);

  const dismiss = async (id: string) => {
    if (isDemoId(id)) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    await supabase.from("ai_insights").update({ dismissed: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissAll = async () => {
    if (!account?.id) return;
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    if (ids.every((id) => isDemoId(id))) {
      setNotifications([]);
      return;
    }
    await supabase.from("ai_insights").update({ dismissed: true }).in("id", ids);
    setNotifications([]);
  };

  const undismissedCount = notifications.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell size={15} />
          {undismissedCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {undismissedCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {undismissedCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={dismissAll}>
              Dismiss all
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell size={24} className="mb-2 opacity-40" />
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const config = typeConfig[n.type] || typeConfig.info;
                const Icon = config.icon;
                return (
                  <div key={n.id} className="group relative flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className={`mt-0.5 shrink-0 ${config.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium text-foreground leading-tight">{n.title}</p>
                        <Badge variant={config.badge} className="shrink-0 text-[10px] px-1.5 py-0">
                          {n.type}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
