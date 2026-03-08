import type { ConversionReport, Provider, ReportIssue, ReportMapping } from "../types.js";

export class ReportBuilder {
  private readonly mappings: ReportMapping[] = [];

  private readonly warnings: ReportIssue[] = [];

  private readonly dropped: ReportIssue[] = [];

  private readonly conflicts: ReportIssue[] = [];

  public constructor(
    private readonly sourceProvider: Provider,
    private readonly targetProvider: Provider
  ) {}

  public addMapping(mapping: ReportMapping): void {
    this.mappings.push(mapping);
  }

  public addMappings(mappings: ReportMapping[]): void {
    for (const mapping of mappings) {
      this.addMapping(mapping);
    }
  }

  public warn(issue: ReportIssue): void {
    this.warnings.push(issue);
  }

  public drop(issue: ReportIssue): void {
    this.dropped.push(issue);
  }

  public conflict(issue: ReportIssue): void {
    this.conflicts.push(issue);
  }

  public getDroppedCount(): number {
    return this.dropped.length;
  }

  public getConflictCount(): number {
    return this.conflicts.length;
  }

  public build(strictFailed: boolean): ConversionReport {
    return {
      sourceProvider: this.sourceProvider,
      targetProvider: this.targetProvider,
      mappings: this.mappings,
      warnings: this.warnings,
      dropped: this.dropped,
      conflicts: this.conflicts,
      summary: {
        warningCount: this.warnings.length,
        droppedCount: this.dropped.length,
        conflictCount: this.conflicts.length,
        strictFailed
      }
    };
  }
}
