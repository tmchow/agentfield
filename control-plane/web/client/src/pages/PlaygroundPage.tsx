import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Play, InProgress, ArrowRight, Upload } from "../components/ui/icon-bridge";
import { reasonersApi } from "../services/reasonersApi";
import type { ReasonerWithNode, ReasonersResponse } from "../types/reasoners";
import { normalizeExecutionStatus } from "../utils/status";

interface RecentRun {
  id: string;
  duration_ms?: number;
  status: string;
  input_preview: string;
  output_preview: string;
  created_at: string;
  input_data?: unknown;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function extractPreview(data: unknown, maxLen = 40): string {
  if (data === null || data === undefined) return "—";
  try {
    const str =
      typeof data === "string" ? data : JSON.stringify(data);
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  } catch {
    return "—";
  }
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const s = normalizeExecutionStatus(status);
  if (s === "succeeded") return "default";
  if (s === "failed") return "destructive";
  return "secondary";
}

export function PlaygroundPage() {
  const { reasonerId: paramReasonerId } = useParams<{ reasonerId?: string }>();
  const navigate = useNavigate();

  // ── reasoner list ─────────────────────────────────────────────────────────
  const [reasonersData, setReasoners] = useState<ReasonersResponse | null>(null);
  const [loadingReasoners, setLoadingReasoners] = useState(true);

  // ── selected reasoner ─────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(
    paramReasonerId ?? null
  );
  const [selectedReasoner, setSelectedReasoner] =
    useState<ReasonerWithNode | null>(null);
  const [loadingReasonerDetails, setLoadingReasonerDetails] = useState(false);

  // ── playground state ──────────────────────────────────────────────────────
  const [input, setInput] = useState("{}");
  const [inputError, setInputError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  // ── recent runs ───────────────────────────────────────────────────────────
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // ── load reasoners ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingReasoners(true);
    reasonersApi
      .getAllReasoners({ status: "all", limit: 200 })
      .then((data) => {
        if (!cancelled) setReasoners(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingReasoners(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── grouped reasoners for the Select ──────────────────────────────────────
  const groupedReasoners = useMemo(() => {
    if (!reasonersData?.reasoners) return {} as Record<string, ReasonerWithNode[]>;
    return reasonersData.reasoners.reduce<Record<string, ReasonerWithNode[]>>(
      (acc, r) => {
        const key = r.node_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      },
      {}
    );
  }, [reasonersData]);

  // ── load selected reasoner details ───────────────────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setSelectedReasoner(null);
      return;
    }
    let cancelled = false;
    setLoadingReasonerDetails(true);
    reasonersApi
      .getReasonerDetails(selectedId)
      .then((data) => {
        if (!cancelled) {
          setSelectedReasoner(data);
          // Seed input textarea with schema example
          if (data.input_schema?.properties) {
            const example: Record<string, string> = {};
            for (const key of Object.keys(data.input_schema.properties)) {
              example[key] = "";
            }
            setInput(JSON.stringify(example, null, 2));
          } else {
            setInput("{}");
          }
          setResult(null);
          setResultError(null);
          setLastRunId(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load reasoner details:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReasonerDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ── load recent runs ──────────────────────────────────────────────────────
  const loadRecentRuns = useCallback(async (reasonerId: string) => {
    setLoadingRuns(true);
    try {
      const history = await reasonersApi.getExecutionHistory(reasonerId, 1, 5);
      const runs: RecentRun[] = (history.executions ?? []).map((ex: any) => ({
        id: ex.execution_id ?? ex.id ?? "—",
        duration_ms: ex.duration_ms,
        status: ex.status ?? "unknown",
        input_preview: extractPreview(ex.input_data ?? ex.input),
        output_preview: extractPreview(ex.output_data ?? ex.result ?? ex.output),
        created_at: ex.started_at ?? ex.created_at ?? "",
        input_data: ex.input_data ?? ex.input,
      }));
      setRecentRuns(runs);
    } catch (err) {
      console.error("Failed to load recent runs:", err);
      setRecentRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadRecentRuns(selectedId);
    } else {
      setRecentRuns([]);
    }
  }, [selectedId, loadRecentRuns]);

  // ── execute ───────────────────────────────────────────────────────────────
  async function handleExecute() {
    if (!selectedId) return;

    // Validate JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      setInputError("Invalid JSON — please fix before executing.");
      return;
    }
    setInputError(null);
    setExecuting(true);
    setResult(null);
    setResultError(null);
    setLastRunId(null);

    try {
      const data = await reasonersApi.executeReasoner(selectedId, {
        input: parsed as Record<string, unknown>,
      });
      setResult(data.result ?? data);
      const runId =
        (data as any).execution_id ??
        (data as any).run_id ??
        null;
      setLastRunId(runId);
      // Refresh recent runs after successful execution
      loadRecentRuns(selectedId);
    } catch (err) {
      setResultError(
        err instanceof Error ? err.message : "Execution failed."
      );
    } finally {
      setExecuting(false);
    }
  }

  // ── route sync ────────────────────────────────────────────────────────────
  function handleReasonerChange(value: string) {
    setSelectedId(value);
    navigate(`/playground/${encodeURIComponent(value)}`, { replace: true });
  }

  // ── load input from recent run ────────────────────────────────────────────
  function handleLoadInput(run: RecentRun) {
    if (run.input_data !== undefined && run.input_data !== null) {
      try {
        setInput(JSON.stringify(run.input_data, null, 2));
        setInputError(null);
      } catch {
        // ignore
      }
    }
  }

  // ── result display helpers ────────────────────────────────────────────────
  const resultJson = useMemo(() => {
    if (result === null || result === undefined) return null;
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }, [result]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedReasoner?.input_schema?.properties) return '{\n  \n}';
    const keys = Object.keys(selectedReasoner.input_schema.properties);
    const example: Record<string, string> = {};
    keys.forEach((k) => (example[k] = ""));
    return JSON.stringify(example, null, 2);
  }, [selectedReasoner]);

  return (
    <div className="space-y-6">
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a reasoner, provide input, execute it and inspect the result.
          </p>
        </div>
      </div>

      {/* ── Reasoner selector ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Reasoner:
        </span>
        <Select
          value={selectedId ?? ""}
          onValueChange={handleReasonerChange}
          disabled={loadingReasoners}
        >
          <SelectTrigger className="w-[320px]">
            <SelectValue
              placeholder={
                loadingReasoners ? "Loading reasoners…" : "Select a reasoner"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(groupedReasoners).map(([nodeId, reasoners]) => (
              <SelectGroup key={nodeId}>
                <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  {nodeId}
                </SelectLabel>
                {reasoners.map((r) => (
                  <SelectItem key={r.reasoner_id} value={r.reasoner_id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {!loadingReasoners &&
              Object.keys(groupedReasoners).length === 0 && (
                <SelectItem value="__none__" disabled>
                  No reasoners available
                </SelectItem>
              )}
          </SelectContent>
        </Select>

        {selectedReasoner && (
          <Badge variant="secondary" className="text-xs font-mono">
            {selectedId}
          </Badge>
        )}

        {loadingReasonerDetails && (
          <InProgress className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* ── Input / Result split ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* INPUT */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Input
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            <textarea
              className="flex-1 min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm resize-vertical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder={inputPlaceholder}
              spellCheck={false}
            />
            {inputError && (
              <p className="text-xs text-destructive">{inputError}</p>
            )}
            <Button
              onClick={handleExecute}
              disabled={executing || !selectedId}
              className="w-full"
            >
              {executing ? (
                <>
                  <InProgress className="h-4 w-4 mr-2 animate-spin" />
                  Executing…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* RESULT */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Result
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            <div className="flex-1 min-h-[200px] rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm whitespace-pre-wrap overflow-auto">
              {executing ? (
                <span className="text-muted-foreground flex items-center gap-2 mt-1">
                  <InProgress className="h-4 w-4 animate-spin" />
                  Running…
                </span>
              ) : resultError ? (
                <span className="text-destructive">{resultError}</span>
              ) : resultJson ? (
                resultJson
              ) : (
                <span className="text-muted-foreground">
                  (waiting for execution…)
                </span>
              )}
            </div>

            {lastRunId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() =>
                  navigate(`/executions/${encodeURIComponent(lastRunId)}`)
                }
              >
                View as Execution
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Runs ──────────────────────────────────────────────────── */}
      {selectedId && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Runs of this Reasoner
            </h2>

            {loadingRuns ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <InProgress className="h-4 w-4 animate-spin" />
                Loading runs…
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No runs recorded yet.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Run</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Input preview</TableHead>
                      <TableHead className="text-xs">Output preview</TableHead>
                      <TableHead className="text-xs w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => (
                      <TableRow key={run.id} className="text-sm">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {run.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDuration(run.duration_ms)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVariant(run.status)}
                            className="text-xs"
                          >
                            {normalizeExecutionStatus(run.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[160px] truncate">
                          {run.input_preview}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[160px] truncate">
                          {run.output_preview}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleLoadInput(run)}
                            title="Load this run's input into the editor"
                          >
                            <Upload className="h-3 w-3" />
                            Load Input
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
