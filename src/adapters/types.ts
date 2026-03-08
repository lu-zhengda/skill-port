import type { CanonicalSkill, ReportIssue, ReportMapping } from "../types.js";

export interface AdapterReadResult {
  canonical: CanonicalSkill;
  mappings: ReportMapping[];
  warnings: ReportIssue[];
  dropped: ReportIssue[];
  conflicts: ReportIssue[];
}

export interface AdapterWriteResult {
  frontmatter: Record<string, unknown>;
  body: string;
  openaiYaml?: Record<string, unknown>;
  mappings: ReportMapping[];
  warnings: ReportIssue[];
  dropped: ReportIssue[];
  conflicts: ReportIssue[];
}
