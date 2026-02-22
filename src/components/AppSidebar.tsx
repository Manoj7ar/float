import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Phone, AlertTriangle, Settings, RefreshCw, PanelLeftClose, PanelLeft } from "lucide-react";
import { FloatLogo } from "./FloatLogo";
import { useAccount } from "@/hooks/useAccount";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/incidents", label: "Incidents", icon: AlertTriangle },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { account } = useAccount();
  const showTextLogo = location.pathname !== "/dashboard";

  return (
    <aside
      className={`m-3 flex h-[calc(100vh-1.5rem)] flex-col rounded-2xl border border-border/70 bg-card/95 shadow-lg backdrop-blur transition-all duration-300 ${
        collapsed ? "w-14" : "w-52"
      }`}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center ${collapsed ? "justify-center p-3" : "justify-between px-4 pb-3 pt-4"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <FloatLogo showText={showTextLogo} />
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-2.5"}`}>
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          const link = (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center rounded-lg font-medium transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5 text-sm"
              } ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon size={18} />
              {!collapsed && label}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={to} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-border/70 ${collapsed ? "p-2" : "p-3.5"}`}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1">
                <div className={`h-2.5 w-2.5 rounded-full ${account?.monzo_connected ? "bg-float-green" : "bg-float-red"}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {account?.monzo_connected ? "Monzo Connected" : "Reconnect Monzo"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${account?.monzo_connected ? "bg-float-green" : "bg-float-red"}`} />
              <span className="text-xs text-muted-foreground">
                {account?.monzo_connected ? "Monzo Connected" : "Reconnect Monzo"}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Synced 2m ago</span>
              <button className="ml-auto rounded p-0.5 hover:bg-accent">
                <RefreshCw size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
