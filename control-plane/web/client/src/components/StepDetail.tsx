import { useState } from "react";
import { useStepDetail } from "@/hooks/queries";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "@/components/ui/icon-bridge";
import { Copy, Check } from "lucide-react";
import { formatDuration } from "./RunTrace";

// ─── Simple JSON syntax highlighter ──────────────────────────────────────────

function JsonHighlight({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const highlighted = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Keys
    .replace(/"([^"]+)":/g, '<span class="text-blue-400 dark:text-blue-300">"$1"</span>:')
    // String values
    .replace(/: "([^"]*)"(,?)/g, ': <span class="text-green-500 dark:text-green-400">"$1"</span>$2')
    // Number values
    .replace(/: (-?\d+\.?\d*)(,?)/g, ': <span class="text-amber-500 dark:text-amber-400">$1</span>$2')
    // Boolean values
    .replace(/: (true|false)(,?)/g, ': <span class="text-purple-500 dark:text-purple-400">$1</span>$2')
    // Null values
    .replace(/: (null)(,?)/g, ': <span class="text-red-400 dark:text-red-300">$1</span>$2');

  return (
    <pre
      className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ─── Copy button with transient check icon ────────────────────────────────────

function CopyBtn({
  label,
  getText,
  disabled,
}: {
  label: string;
  getText: () => string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const text = getText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px] text-muted-foreground"
      onClick={handleClick}
      disabled={disabled}
    >
      {copied ? (
        <Check className="size-2.5 mr-1" />
      ) : (
        <Copy className="size-2.5 mr-1" />
      )}
      {label}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepDetail({ executionId }: { executionId: string }) {
  const { data: execution, isLoading } = useStepDetail(executionId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-60" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        Step not found
      </div>
    );
  }

  const hasError = Boolean(execution.error_message);
  const hasOutput = execution.output_data != null;
  const hasInput = execution.input_data != null;
  const notes = execution.notes ?? [];

  const buildCurl = () => {
    const origin = window.location.origin;
    return (
      `curl -X POST '${origin}/api/v1/execute/${execution.agent_node_id}.${execution.reasoner_id}' \\\n` +
      `  -H 'Content-Type: application/json' \\\n` +
      `  -H 'X-API-Key: YOUR_API_KEY' \\\n` +
      `  -d '${JSON.stringify({ input: execution.input_data })}'`
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {/* Step header */}
        <div>
          <h3 className="text-sm font-semibold font-mono">
            {execution.reasoner_id}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent: {execution.agent_node_id}
            {" · "}
            Duration: {formatDuration(execution.duration_ms)}
            {execution.workflow_depth != null && (
              <> · Depth: {execution.workflow_depth}</>
            )}
          </p>

          {/* Copy action row */}
          <div className="flex flex-wrap items-center gap-0.5 mt-2">
            <CopyBtn label="Copy cURL" getText={buildCurl} />
            <CopyBtn
              label="Copy Input"
              getText={() => JSON.stringify(execution.input_data, null, 2)}
              disabled={!hasInput}
            />
            <CopyBtn
              label="Copy Output"
              getText={() => JSON.stringify(execution.output_data, null, 2)}
              disabled={!hasOutput}
            />
          </div>
        </div>

        {/* Input section */}
        {hasInput && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Input
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md bg-muted p-3 overflow-auto max-h-64">
                <JsonHighlight data={execution.input_data} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Output or Error */}
        {hasError ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-xs font-medium text-destructive">Error</p>
            <p className="text-xs mt-1 font-mono whitespace-pre-wrap break-all">
              {execution.error_message}
            </p>
          </div>
        ) : hasOutput ? (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Output
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md bg-muted p-3 overflow-auto max-h-64">
                <JsonHighlight data={execution.output_data} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            No output
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Notes ({notes.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-2">
                {notes.map((note, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted p-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(note.timestamp).toLocaleTimeString()}
                    </span>{" "}
                    {note.message}
                    {note.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="ml-1 text-[10px] py-0 h-4"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  );
}
