import {
  Activity,
  Server,
  CircleAlert,
  CircleCheck,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useLLMHealth, useQueueStatus, useAgents } from "@/hooks/queries";
import { useSSE } from "@/hooks/useSSE";
import { cn } from "@/lib/utils";
import type { AgentNodeSummary } from "@/types/agentfield";

type HealthStripProps = {
  className?: string;
};

export function HealthStrip({ className }: HealthStripProps) {
  const llmHealth = useLLMHealth();
  const queueStatus = useQueueStatus();
  const agents = useAgents();

  const { connected: sseConnected, reconnecting: sseReconnecting } = useSSE(
    "/api/ui/v1/executions/events",
    {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelayMs: 2000,
      exponentialBackoff: true,
    },
  );

  const llmOk = llmHealth.data
    ? !llmHealth.data.endpoints?.some((ep) => !ep.healthy)
    : true;

  const nodes: AgentNodeSummary[] = agents.data?.nodes ?? [];
  const totalAgents = agents.data?.count ?? nodes.length;
  const onlineCount = nodes.filter(
    (n) =>
      n.health_status === "ready" ||
      n.health_status === "active" ||
      n.lifecycle_status === "running",
  ).length;

  const totalRunning = Object.values(queueStatus.data?.agents ?? {}).reduce(
    (sum, a) => sum + (a.running || 0),
    0,
  );

  const sseLabel = sseConnected
    ? "Live"
    : sseReconnecting
      ? "Reconnecting"
      : "Disconnected";

  const sseDetail = sseConnected
    ? "Real-time updates active"
    : sseReconnecting
      ? "Attempting to restore live updates"
      : "Live updates unavailable — pages will not auto-refresh";

  const compactTriggerClass = cn(
    "h-8 gap-1.5 px-2 text-xs",
    !llmOk && "border-destructive/50 text-destructive",
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center", className)}>
        {/* Viewports where the header competes with breadcrumbs: single control + popover */}
        <div className="xl:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={compactTriggerClass}
                aria-label={`System status: LLM ${llmOk ? "healthy" : "degraded"}, ${onlineCount} of ${totalAgents} agents online, ${totalRunning} running, ${sseLabel}`}
              >
                <Activity className="size-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums text-muted-foreground">
                  {onlineCount}/{totalAgents}
                </span>
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    sseConnected
                      ? "bg-green-500"
                      : sseReconnecting
                        ? "animate-pulse bg-amber-500"
                        : "bg-muted-foreground",
                  )}
                  aria-hidden
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                System status
              </p>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2">
                  {llmOk ? (
                    <CircleCheck
                      className="mt-0.5 size-4 shrink-0 text-green-500"
                      aria-hidden
                    />
                  ) : (
                    <CircleAlert
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                  )}
                  <div>
                    <div className="font-medium">LLM</div>
                    <div className="text-xs text-muted-foreground">
                      {llmOk
                        ? "All LLM endpoints responding"
                        : "One or more LLM endpoints are unhealthy"}
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Server
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      onlineCount > 0
                        ? "text-green-500"
                        : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <div>
                    <div className="font-medium">Agents</div>
                    <div className="text-xs text-muted-foreground">
                      {onlineCount} of {totalAgents} online
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Layers
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      totalRunning > 0
                        ? "text-blue-500"
                        : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <div>
                    <div className="font-medium">Queue</div>
                    <div className="text-xs text-muted-foreground">
                      {totalRunning} execution{totalRunning === 1 ? "" : "s"}{" "}
                      running
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      sseConnected
                        ? "bg-green-500"
                        : sseReconnecting
                          ? "animate-pulse bg-amber-500"
                          : "bg-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <div>
                    <div className="font-medium">Live updates</div>
                    <div className="text-xs text-muted-foreground">
                      {sseDetail}
                    </div>
                  </div>
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <div className="hidden items-center gap-2 text-xs sm:gap-3 xl:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-1.5">
                {llmOk ? (
                  <CircleCheck
                    className="size-3.5 shrink-0 text-green-500"
                    aria-hidden
                  />
                ) : (
                  <CircleAlert
                    className="size-3.5 shrink-0 text-destructive"
                    aria-hidden
                  />
                )}
                <span className="hidden text-muted-foreground lg:inline">
                  LLM
                </span>
                <Badge
                  variant={llmOk ? "secondary" : "destructive"}
                  className="h-5 px-1.5 text-micro"
                >
                  {llmOk ? "Healthy" : "Degraded"}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {llmOk
                ? "All LLM endpoints responding"
                : "One or more LLM endpoints are unhealthy"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Server
                  className={cn(
                    "size-3.5 shrink-0",
                    onlineCount > 0
                      ? "text-green-500"
                      : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="hidden text-muted-foreground lg:inline">
                  Agents
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-micro">
                  {onlineCount}/{totalAgents} online
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>Agent fleet status</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Layers
                  className={cn(
                    "size-3.5 shrink-0",
                    totalRunning > 0
                      ? "text-blue-500"
                      : "text-muted-foreground",
                  )}
                />
                <span className="hidden text-muted-foreground lg:inline">
                  Queue
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-micro">
                  {totalRunning} running
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>Execution queue status</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    sseConnected
                      ? "bg-green-500"
                      : sseReconnecting
                        ? "animate-pulse bg-amber-500"
                        : "bg-muted-foreground",
                  )}
                />
                <span className="hidden text-micro text-muted-foreground sm:inline">
                  {sseLabel}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{sseDetail}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
