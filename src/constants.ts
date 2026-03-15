export const ISSUE_CODES = {
  DETECT_FALLBACK: "SP001",
  INVALID_SKILL_NAME: "SP002",
  POLICY_CONFLICT: "SP101",
  OPENAI_YAML_INVALID: "SP102",
  OPENAI_CONFIG_DROPPED: "SP201",
  OPENAI_FIELD_DROPPED: "SP202",
  NAME_DERIVED: "SP301",
  DESCRIPTION_DERIVED: "SP302",
  PLUGIN_FILE_MISSING: "SP401",
  PLUGIN_FILE_INVALID: "SP402",
  PLUGIN_WRITE_BLOCKED: "SP403",
  STRICT_BLOCKED: "SP900"
} as const;

export const FRONTMATTER_KEY_ORDER = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "argument-hint",
  "disable-model-invocation",
  "user-invocable",
  "model",
  "context",
  "agent",
  "hooks"
] as const;
