import { RefreshCw } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NlQueryBar } from "@/components/dashboard/NlQueryBar";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { account } = useAccount();

  return (
    <header className="sticky top-3 z-30 mx-4 mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/85 px-4 py-2 shadow-lg shadow-black/5 backdrop-blur-xl lg:mx-6 lg:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h1>
          <span className="hidden items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-float-green" />
            Live workspace
          </span>
        </div>
        {subtitle && <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p>}
      </div>

      <NlQueryBar />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl border border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground"
            >
              <RefreshCw size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>

        <NotificationsDropdown />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/80 p-1 shadow-sm transition-transform hover:scale-105"
              aria-label="Float logo"
            >
              <img src="/float-logo.png" alt="Float" className="h-full w-full object-contain" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{account?.business_name ?? "Account"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
