export type Provider = "codex" | "claude-code" | "cursor";
export type Scope = "user" | "project" | "local";

export type OutputFormat = "text" | "json";

export interface SkillDocument {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface OpenAiSkillConfig {
  interface?: Record<string, unknown>;
  policy?: {
    allow_implicit_invocation?: boolean;
    [key: string]: unknown;
  };
  dependencies?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CanonicalSkill {
  name: string;
  description: string;
  body: string;
  frontmatter: Record<string, unknown>;
  sourceProvider: Provider;
  policy: {
    disableModelInvocation?: boolean;
    userInvocable?: boolean;
    allowImplicitInvocation?: boolean;
  };
  openai?: OpenAiSkillConfig;
}

export interface ReportIssue {
  code: string;
  message: string;
  field?: string;
  path?: string;
}

export interface ReportMapping {
  from: string;
  to: string;
  action: "copied" | "transformed" | "generated" | "preserved" | "removed";
  note?: string;
}

export interface ConversionReport {
  sourceProvider: Provider;
  targetProvider: Provider;
  mappings: ReportMapping[];
  warnings: ReportIssue[];
  dropped: ReportIssue[];
  conflicts: ReportIssue[];
  summary: {
    warningCount: number;
    droppedCount: number;
    conflictCount: number;
    strictFailed: boolean;
  };
}

export interface ConvertOptions {
  input: string;
  to: Provider;
  from?: Provider | "auto";
  out?: string;
  report?: string;
  strict?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface ScopedConvertOptions {
  skill: string;
  to: Provider;
  from?: Provider | "auto";
  scope?: Scope;
  targetScope?: Scope;
  out?: string;
  report?: string;
  strict?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface ListedSkill {
  provider: Provider;
  scope: Scope;
  name: string;
  path: string;
}

export interface ConvertResult {
  outputDir: string;
  report: ConversionReport;
  sourceProvider: Provider;
  targetProvider: Provider;
  wroteFiles: boolean;
}
