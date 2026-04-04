import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "@/components/ui/icon-bridge";
import type { WorkflowDAGLightweightNode } from "@/types/workflows";

// ─── Tree node type (runtime-constructed) ────────────────────────────────────

export interface TraceTreeNode extends WorkflowDAGLightweightNode {
  children: TraceTreeNode[];
}

// ─── Build tree from flat timeline ───────────────────────────────────────────

export function buildTraceTree(
  timeline: WorkflowDAGLightweightNode[],
): TraceTreeNode | null {
  if (!timeline || timeline.length === 0) return null;

  const nodeMap = new Map<string, TraceTreeNode>();
  const orphans: TraceTreeNode[] = [];

  for (const node of timeline) {
    nodeMap.set(node.execution_id, { ...node, children: [] });
  }

  for (const node of nodeMap.values()) {
    if (node.parent_execution_id) {
      const parent = nodeMap.get(node.parent_execution_id);
      if (parent) {
        parent.children.push(node);
      } else {
        orphans.push(node);
      }
    } else {
      orphans.push(node);
    }
  }

  // Return the root (depth 0 node) or first orphan
  const root =
    orphans.find((n) => n.workflow_depth === 0) ?? orphans[0] ?? null;

  if (root && orphans.length > 1) {
    // Attach remaining orphans as children of root
    for (const orphan of orphans) {
      if (orphan !== root) {
        root.children.push(orphan);
      }
    }
  }

  return root;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
    case "failed":
    case "timeout":
      return <XCircle className="size-3.5 shrink-0 text-destructive" />;
    case "running":
      return (
        <Loader2 className="size-3.5 shrink-0 text-blue-500 animate-spin" />
      );
    default:
      return (
        <Circle className="size-3.5 shrink-0 text-muted-foreground" />
      );
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RunTraceProps {
  node: TraceTreeNode;
  maxDuration: number;
  selectedId: string | null;
  onSelect: (executionId: string) => void;
  depth?: number;
}

export function RunTrace({
  node,
  maxDuration,
  selectedId,
  onSelect,
  depth = 0,
}: RunTraceProps) {
  const barWidth =
    node.duration_ms != null
      ? Math.max(4, (node.duration_ms / Math.max(maxDuration, 1)) * 100)
      : 4;
  const isSelected = node.execution_id === selectedId;

  const barColor =
    node.status === "succeeded"
      ? "bg-green-500"
      : node.status === "failed" || node.status === "timeout"
        ? "bg-destructive"
        : node.status === "running"
          ? "bg-blue-500"
          : "bg-muted-foreground/40";

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.execution_id)}
        className={cn(
          "flex items-center gap-2 w-full rounded-md text-sm transition-colors",
          "hover:bg-accent text-left",
          isSelected && "bg-accent",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: "8px", paddingTop: "6px", paddingBottom: "6px" }}
      >
        {/* Tree connector */}
        {depth > 0 && (
          <span className="text-muted-foreground/50 text-xs shrink-0 font-mono">
            └─
          </span>
        )}

        {/* Reasoner name */}
        <span className="truncate font-mono text-xs min-w-0 flex-shrink">
          {node.reasoner_id}
        </span>

        {/* Duration bar */}
        <div className="flex-1 flex items-center min-w-[40px]">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Duration text */}
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatDuration(node.duration_ms)}
        </span>

        {/* Status icon */}
        <StatusIcon status={node.status} />
      </button>

      {/* Children */}
      {node.children?.map((child) => (
        <RunTrace
          key={child.execution_id}
          node={child}
          maxDuration={maxDuration}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
