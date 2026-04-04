import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgents } from "@/hooks/queries";
import { getNodeDetails } from "@/services/api";
import { startAgent } from "@/services/configurationApi";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  Restart,
  ArrowRight,
  Settings,
} from "@/components/ui/icon-bridge";
import type { AgentNodeSummary, ReasonerDefinition, SkillDefinition, LifecycleStatus } from "@/types/agentfield";
import { useQuery } from "@tanstack/react-query";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "unknown";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "just now";
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

type StatusVariant = "success" | "destructive" | "pending" | "secondary" | "default";

function getStatusVariant(
  lifecycleStatus: LifecycleStatus | undefined
): StatusVariant {
  switch (lifecycleStatus) {
    case "ready":
    case "running":
      return "success";
    case "starting":
      return "pending";
    case "stopped":
    case "error":
    case "offline":
      return "destructive";
    case "degraded":
      return "degraded" as StatusVariant;
    default:
      return "secondary";
  }
}

function getStatusLabel(lifecycleStatus: LifecycleStatus | undefined): string {
  if (!lifecycleStatus) return "unknown";
  return lifecycleStatus;
}

function getHealthColor(score: number | undefined): string {
  if (score === undefined) return "text-muted-foreground";
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

// ─── NodeReasonerList ────────────────────────────────────────────────────────

interface NodeReasonerListProps {
  nodeId: string;
  reasonerCount: number;
  skillCount: number;
}

function NodeReasonerList({ nodeId, reasonerCount, skillCount }: NodeReasonerListProps) {
  const navigate = useNavigate();

  // Fetch full node details for reasoner names only when expanded
  const { data: nodeDetails, isLoading } = useQuery({
    queryKey: ["node-details", nodeId],
    queryFn: () => getNodeDetails(nodeId),
    staleTime: 30_000,
  });

  const reasoners: ReasonerDefinition[] = nodeDetails?.reasoners ?? [];
  const skills: SkillDefinition[] = nodeDetails?.skills ?? [];
  const allItems = [...reasoners, ...skills];
  const total = reasonerCount + skillCount;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: Math.min(total, 3) }).map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-md bg-muted/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-1">
        No reasoners registered
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {reasoners.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground/50 font-mono text-xs select-none flex-shrink-0">
              ├──
            </span>
            <span className="text-sm font-mono truncate">{r.name || r.id}</span>
            {r.description && (
              <span className="text-xs text-muted-foreground truncate hidden sm:block">
                {r.description}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={() => navigate(`/playground/${nodeId}.${r.id}`)}
          >
            Playground
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </li>
      ))}
      {skills.map((s, idx) => (
        <li
          key={s.id}
          className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground/50 font-mono text-xs select-none flex-shrink-0">
              {idx === skills.length - 1 && reasoners.length === 0 ? "└──" : "├──"}
            </span>
            <span className="text-sm font-mono truncate">{s.name || s.id}</span>
            <Badge variant="secondary" size="sm" className="flex-shrink-0">
              skill
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={() => navigate(`/playground/${nodeId}.${s.id}`)}
          >
            Playground
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ─── AgentCard ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  node: AgentNodeSummary;
}

function AgentCard({ node }: AgentCardProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [restarting, setRestarting] = useState(false);

  const statusVariant = getStatusVariant(node.lifecycle_status);
  const statusLabel = getStatusLabel(node.lifecycle_status);
  const totalItems = node.reasoner_count + node.skill_count;

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await startAgent(node.id);
    } catch (err) {
      console.error("Failed to restart agent:", node.id, err);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          {/* Left: name + status */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold font-mono truncate">
                {node.id}
              </span>
              <Badge variant={statusVariant} size="sm" showIcon={false}>
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    statusVariant === "success"
                      ? "bg-green-400"
                      : statusVariant === "pending"
                        ? "bg-yellow-400"
                        : statusVariant === "destructive"
                          ? "bg-red-400"
                          : "bg-muted-foreground"
                  }`}
                />
                {statusLabel}
              </Badge>
              {node.mcp_summary && (
                <span
                  className={`text-xs font-mono font-medium ${getHealthColor(
                    node.mcp_summary.overall_health_score
                  )}`}
                >
                  health: {node.mcp_summary.overall_health_score ?? "—"}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>
                Last heartbeat:{" "}
                <span className="text-foreground">
                  {formatRelativeTime(node.last_heartbeat)}
                </span>
              </span>
              {totalItems > 0 && (
                <span>
                  {node.reasoner_count} reasoner
                  {node.reasoner_count !== 1 ? "s" : ""}
                  {node.skill_count > 0 && `, ${node.skill_count} skill${node.skill_count !== 1 ? "s" : ""}`}
                </span>
              )}
              {node.version && (
                <span className="font-mono">v{node.version}</span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              disabled={restarting}
              className="h-7 px-2 text-xs"
            >
              <Restart className={`h-3.5 w-3.5 mr-1 ${restarting ? "animate-spin" : ""}`} />
              {restarting ? "Restarting…" : "Restart"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/nodes/${node.id}`)}
              className="h-7 px-2 text-xs"
            >
              <Settings className="h-3.5 w-3.5 mr-1" />
              Config
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              className="h-7 w-7 p-0"
              aria-label={open ? "Collapse reasoners" : "Expand reasoners"}
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <Separator className="mb-3" />
            <div className="px-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Reasoners
              </p>
              <NodeReasonerList
                nodeId={node.id}
                reasonerCount={node.reasoner_count}
                skillCount={node.skill_count}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── AgentsPage ──────────────────────────────────────────────────────────────

export function AgentsPage() {
  const { data, isLoading, isError, error } = useAgents();
  const nodes = data?.nodes ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading
              ? "Loading agents…"
              : nodes.length === 0
                ? "No agents registered"
                : `${nodes.length} agent node${nodes.length !== 1 ? "s" : ""} registered`}
          </p>
        </div>
        {data?.count !== undefined && (
          <Badge variant="count" size="sm">
            {data.count} total
          </Badge>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load agents:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && nodes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No agent nodes found
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start an agent to see it here. Run{" "}
            <code className="font-mono bg-muted px-1 rounded">af run</code> in
            your agent directory.
          </p>
        </div>
      )}

      {/* Agent cards */}
      {!isLoading && nodes.length > 0 && (
        <div className="space-y-4">
          {nodes.map((node) => (
            <AgentCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}
