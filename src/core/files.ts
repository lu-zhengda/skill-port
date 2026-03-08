import { cp, mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { isObject } from "../utils/object.js";

export async function ensureOutputDirectory(outputDir: string, overwrite: boolean): Promise<void> {
  const resolvedOutput = path.resolve(outputDir);
  let outputExists = false;
  try {
    await stat(resolvedOutput);
    outputExists = true;
  } catch {
    outputExists = false;
  }

  if (outputExists) {
    if (!overwrite) {
      throw new Error(`Output directory already exists: ${resolvedOutput}. Use --overwrite to replace it.`);
    }

    if (isFilesystemRoot(resolvedOutput)) {
      throw new Error(`Refusing to overwrite filesystem root: ${resolvedOutput}.`);
    }

    await rm(resolvedOutput, { recursive: true, force: true });
  }

  await mkdir(resolvedOutput, { recursive: true });
}

export async function copySkillDirectory(sourceDir: string, outputDir: string): Promise<void> {
  await cp(sourceDir, outputDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    dereference: false
  });
}

export interface YamlReadResult {
  data?: Record<string, unknown>;
  error?: string;
}

export async function readYamlFile(filePath: string): Promise<YamlReadResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return {};
    }

    return {
      error: `Failed to read YAML file '${filePath}': ${nodeError.message}`
    };
  }

  try {
    const parsed = yaml.load(raw);
    if (!isObject(parsed)) {
      return {
        error: `YAML file '${filePath}' must contain a top-level object.`
      };
    }

    return { data: parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: `Failed to parse YAML file '${filePath}': ${message}`
    };
  }
}

export async function writeYamlFile(filePath: string, data: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
  await writeFile(filePath, text, "utf8");
}

export async function removeFileIfExists(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

function isFilesystemRoot(targetPath: string): boolean {
  const parsed = path.parse(targetPath);
  return parsed.root === targetPath;
}
