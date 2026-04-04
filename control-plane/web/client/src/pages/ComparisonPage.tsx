import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useRunDAG } from "@/hooks/queries";
import { formatDuration } from "@/components/RunTrace";
import { normalizeExecutionStatus } from "@/utils/status";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { WorkflowDAGLightweightNode } from "@/types/workflows";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" {
  const canonical = normalizeExecutionStatus(status);
  switch (canonical) {
    case "succeeded":
      return "default";
    case "failed":
    case "timeout":
      return "destructive";
    default:
      return "secondary";
  }
}

function StatusDot({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground text-[11px]">—</span>;
  const canonical = normalizeExecutionStatus(status);
  const color =
    canonical === "succeeded"
      ? "bg-green-500"
      : canonical === "failed" || canonical === "timeout"
        ? "bg-red-500"
        : canonical === "running"
          ? "bg-blue-500"
          : "bg-muted-foreground";

  const symbol =
    canonical === "succeeded"
      ? "✓"
      : canonical === "failed" || canonical === "timeout"
        ? "✗"
        : "·";

  return (
    <div className="flex items-center gap-1">
      <div className={cn("size-1.5 rounded-full shrink-0", color)} />
      <span className={cn(
        "text-[11px] font-mono",
        canonical === "succeeded" ? "text-green-500" : canonical === "failed" || canonical === "timeout" ? "text-red-500" : "text-muted-foreground",
      )}>
        {symbol}
      </span>
    </div>
  );
}

function durationDeltaLabel(msA?: number, msB?: number): string | null {
  if (msA == null || msB == null) return null;
  if (msA === 0) return null;
  const delta = ((msB - msA) / msA) * 100;
  if (Math.abs(delta) < 1) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}

// ─── Output diff section ───────────────────────────────────────────────────────

function OutputDiff({
  stepA,
  stepB,
  indexA,
  indexB,
}: {
  stepA?: WorkflowDAGLightweightNode;
  stepB?: WorkflowDAGLightweightNode;
  indexA: number;
  indexB: number;
}) {
  const label = stepA?.reasoner_id ?? stepB?.reasoner_id ?? "—";
  const stepNum = indexA + 1;

  return (
    <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
      <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2">
        Output Diff — Step #{stepNum} · {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">Run A</p>
          <pre className="font-mono text-[10px] text-muted-foreground bg-background/50 rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto">
            {stepA
              ? stepA.status === "failed"
                ? `ERROR: step failed`
                : stepA.status
              : "— (no step)"}
          </pre>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">Run B</p>
          <pre className="font-mono text-[10px] text-muted-foreground bg-background/50 rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto">
            {stepB
              ? stepB.status === "failed"
                ? `ERROR: step failed`
                : stepB.status
              : "— (no step)"}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Run summary card ──────────────────────────────────────────────────────────

function RunSummaryCard({
  runId,
  label,
  status,
  stepCount,
  failureCount,
  durationMs,
  deltaLabel,
  isB,
}: {
  runId: string;
  label: "A" | "B";
  status: string;
  stepCount: number;
  failureCount: number;
  durationMs?: number;
  deltaLabel?: string | null;
  isB?: boolean;
}) {
  const navigate = useNavigate();
  const shortId = runId.slice(0, 12);

  return (
    <Card className={cn(
      "flex-1",
      isB && deltaLabel && deltaLabel.startsWith("+") && "border-amber-500/20",
    )}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Run {label}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground gap-1 px-1.5"
            onClick={() => navigate(`/runs/${runId}`)}
          >
            <ExternalLink className="size-3" />
            Detail
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={statusVariant(status)} className="text-[10px] px-1.5 h-5">
            {normalizeExecutionStatus(status)}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">{shortId}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Steps</p>
            <p className="text-sm font-semibold">{stepCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Failures</p>
            <p className={cn("text-sm font-semibold", failureCount > 0 && "text-destructive")}>
              {failureCount > 0 ? failureCount : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-sm font-semibold">
                {durationMs != null ? formatDuration(durationMs) : "—"}
              </p>
              {deltaLabel && (
                <span className={cn(
                  "text-[10px] font-medium",
                  deltaLabel.startsWith("+") ? "text-amber-400" : "text-green-500",
                )}>
                  ({deltaLabel})
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ComparisonPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const runIdA = searchParams.get("a") ?? undefined;
  const runIdB = searchParams.get("b") ?? undefined;

  const dagA = useRunDAG(runIdA);
  const dagB = useRunDAG(runIdB);

  const [selectedDivergedIndex, setSelectedDivergedIndex] = useState<number | null>(null);

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (dagA.isLoading || dagB.isLoading) {
    return (
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between flex-shrink-0">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  // ─── Missing IDs ──────────────────────────────────────────────────────────

  if (!runIdA || !runIdB) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Compare Runs</h1>
        <p className="text-sm text-muted-foreground">
          Select two runs from the Runs page to compare them.
        </p>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate("/runs")}>
          <ArrowLeft className="size-3 mr-1.5" />
          Back to Runs
        </Button>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (dagA.isError || dagB.isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Compare Runs</h1>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {dagA.isError
            ? `Failed to load Run A: ${dagA.error instanceof Error ? dagA.error.message : "Unknown error"}`
            : `Failed to load Run B: ${dagB.error instanceof Error ? dagB.error.message : "Unknown error"}`}
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate("/runs")}>
          <ArrowLeft className="size-3 mr-1.5" />
          Back to Runs
        </Button>
      </div>
    );
  }

  const dataA = dagA.data!;
  const dataB = dagB.data!;

  const stepsA = dataA.timeline ?? [];
  const stepsB = dataB.timeline ?? [];
  const maxLen = Math.max(stepsA.length, stepsB.length);

  const rootA = stepsA.find((n) => n.workflow_depth === 0) ?? stepsA[0];
  const rootB = stepsB.find((n) => n.workflow_depth === 0) ?? stepsB[0];

  const durationMsA = rootA?.duration_ms;
  const durationMsB = rootB?.duration_ms;

  const failureCountA = stepsA.filter((s) => normalizeExecutionStatus(s.status) === "failed" || normalizeExecutionStatus(s.status) === "timeout").length;
  const failureCountB = stepsB.filter((s) => normalizeExecutionStatus(s.status) === "failed" || normalizeExecutionStatus(s.status) === "timeout").length;

  const deltaLabel = durationDeltaLabel(durationMsA, durationMsB);

  const divergedStep =
    selectedDivergedIndex != null
      ? { a: stepsA[selectedDivergedIndex], b: stepsB[selectedDivergedIndex], index: selectedDivergedIndex }
      : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Compare Runs</h1>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => navigate("/runs")}
        >
          <ArrowLeft className="size-3 mr-1.5" />
          Back
        </Button>
      </div>

      {/* ─── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        <RunSummaryCard
          runId={runIdA}
          label="A"
          status={dataA.workflow_status}
          stepCount={stepsA.length}
          failureCount={failureCountA}
          durationMs={durationMsA}
        />
        <RunSummaryCard
          runId={runIdB}
          label="B"
          status={dataB.workflow_status}
          stepCount={stepsB.length}
          failureCount={failureCountB}
          durationMs={durationMsB}
          deltaLabel={deltaLabel}
          isB
        />
      </div>

      <Separator className="flex-shrink-0" />

      {/* ─── Step comparison + diff ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex-shrink-0">
          Step Comparison
          {maxLen > 0 && (
            <span className="ml-2 normal-case text-muted-foreground/60 font-normal">
              — click a diverged row to inspect output diff
            </span>
          )}
        </p>

        <div className="flex-1 min-h-0 rounded-md border border-border overflow-hidden">
          <ScrollArea className="h-full">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="px-2 text-[10px] w-8">#</TableHead>
                  {/* Run A columns */}
                  <TableHead className="px-2 text-[10px] w-[22%]">
                    <span className="text-muted-foreground">A ·</span>{" "}
                    <span className="font-mono text-[10px]">{runIdA.slice(0, 8)}</span>
                  </TableHead>
                  <TableHead className="px-2 text-[10px] w-16">Status</TableHead>
                  {/* Run B columns */}
                  <TableHead className="px-2 text-[10px] w-[22%]">
                    <span className="text-muted-foreground">B ·</span>{" "}
                    <span className="font-mono text-[10px]">{runIdB.slice(0, 8)}</span>
                  </TableHead>
                  <TableHead className="px-2 text-[10px] w-16">Status</TableHead>
                  {/* Delta */}
                  <TableHead className="px-2 text-[10px] w-24">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maxLen === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-8">
                      No steps available for comparison
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.from({ length: maxLen }).map((_, i) => {
                    const a = stepsA[i];
                    const b = stepsB[i];

                    const statusA = normalizeExecutionStatus(a?.status);
                    const statusB = normalizeExecutionStatus(b?.status);

                    const bothPresent = !!a && !!b;
                    const diverged = bothPresent && statusA !== statusB;
                    const extra = !a || !b;

                    const isSelected = selectedDivergedIndex === i;

                    return (
                      <TableRow
                        key={i}
                        className={cn(
                          "h-8 transition-colors",
                          diverged && "bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer",
                          isSelected && "bg-amber-500/10 ring-inset ring-1 ring-amber-500/30",
                          extra && "opacity-60",
                          !diverged && !extra && "hover:bg-muted/30",
                        )}
                        onClick={() => {
                          if (diverged || extra) {
                            setSelectedDivergedIndex(isSelected ? null : i);
                          }
                        }}
                      >
                        {/* Index */}
                        <TableCell className="px-2 py-1 text-[11px] text-muted-foreground/60 tabular-nums">
                          {i + 1}
                        </TableCell>

                        {/* Reasoner A */}
                        <TableCell className="px-2 py-1 text-xs font-mono max-w-0 truncate">
                          <span className="truncate block" title={a?.reasoner_id}>
                            {a?.reasoner_id ?? <span className="text-muted-foreground/40 italic">—</span>}
                          </span>
                        </TableCell>

                        {/* Status A */}
                        <TableCell className="px-2 py-1">
                          <StatusDot status={a?.status} />
                        </TableCell>

                        {/* Reasoner B */}
                        <TableCell className="px-2 py-1 text-xs font-mono max-w-0 truncate">
                          <span className="truncate block" title={b?.reasoner_id}>
                            {b?.reasoner_id ?? <span className="text-muted-foreground/40 italic">—</span>}
                          </span>
                        </TableCell>

                        {/* Status B */}
                        <TableCell className="px-2 py-1">
                          <StatusDot status={b?.status} />
                        </TableCell>

                        {/* Diff label */}
                        <TableCell className="px-2 py-1">
                          {diverged ? (
                            <span className="text-[10px] text-amber-400 font-medium">
                              {isSelected ? "▼ diverged" : "◀ diverged"}
                            </span>
                          ) : extra ? (
                            <span className="text-[10px] text-muted-foreground/50 italic">
                              {!a ? "extra (B)" : "extra (A)"}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">same</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* ─── Output diff panel ─────────────────────────────────────── */}
            {divergedStep != null && (
              <div className="px-3 pb-3">
                <OutputDiff
                  stepA={divergedStep.a}
                  stepB={divergedStep.b}
                  indexA={divergedStep.index}
                  indexB={divergedStep.index}
                />
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
