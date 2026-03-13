#!/usr/bin/env node
/**
 * AGENTS.md Compliance Audit Script
 * Scans src/ for violations of the project design system rules.
 *
 * Usage: node scripts/audit-agents.mjs
 *
 * Severity levels:
 *   🚫 BLOQUEANTE — must be fixed before merge
 *   ⚠️  ALTO       — should be fixed in current sprint
 *   💡 MÉDIO      — fix when touching the file
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const SRC = "src";
const EXCLUDE_DIRS = ["node_modules", ".git", "dist", "integrations/supabase/types.ts"];
const INCLUDE_EXT = [".tsx", ".ts"];

// ─── Rules ────────────────────────────────────────────────

const rules = [
  // BLOQUEANTE
  {
    id: "hardcoded-color",
    severity: "bloqueante",
    desc: "Hardcoded color class (orange-*, blue-*, green-* etc.) in UI",
    pattern: /(?:text|bg|border|ring)-(?:orange|blue|red|green|purple|pink|yellow|indigo|cyan|teal|violet|fuchsia|rose|emerald|lime|sky|amber)-\d{2,3}/g,
    exclude: [
      /\.test\./,
      /types\.ts$/,
      /changelog\.ts$/,
      // §34 exception: WhatsApp green in action columns
      /text-green-600\s+hover:text-green-700/,
    ],
  },
  {
    id: "hex-color",
    severity: "bloqueante",
    desc: "Hex color in component (use semantic tokens)",
    pattern: /(?:className|style).*?#[0-9a-fA-F]{3,8}/g,
    exclude: [/\.test\./, /types\.ts$/, /Recharts|chart|gradient|stopColor|foreColor/i],
  },
  {
    id: "native-button",
    severity: "bloqueante",
    desc: "<button> HTML nativo (use Button do shadcn)",
    pattern: /<button[\s>]/g,
    exclude: [
      /src\/components\/ui\//,
      /ToolbarButton/, // rich text toolbar internal
    ],
  },
  {
    id: "bg-white",
    severity: "bloqueante",
    desc: "bg-white hardcoded (use bg-card ou bg-background)",
    pattern: /\bbg-white\b/g,
    exclude: [
      /SignaturePad|SignatureCanvas|canvas/i,
      /src\/components\/ui\//,
      /bg-white\/\d/, // bg-white/XX with opacity is allowed per §24
    ],
  },
  {
    id: "query-in-component",
    severity: "alto",
    desc: "useQuery() in component file (should be in src/hooks/)",
    pattern: /useQuery\s*\(\s*\{/g,
    fileFilter: (path) =>
      path.includes("/components/") && !path.includes("/hooks/"),
    exclude: [],
  },
  {
    id: "missing-staletime",
    severity: "bloqueante",
    desc: "useQuery without staleTime",
    // Matches useQuery({ ... }) blocks without staleTime
    // Heuristic: find useQuery calls and check next 10 lines for staleTime
    custom: true,
  },
  {
    id: "supabase-in-component",
    severity: "alto",
    desc: "Direct supabase query in component (move to hook/service)",
    pattern: /supabase\s*\.\s*from\s*\(/g,
    fileFilter: (path) =>
      path.includes("/components/") &&
      !path.includes("/hooks/") &&
      !path.includes("PropostaPublica"),
    exclude: [],
  },
  // MÉDIO
  {
    id: "max-w-admin",
    severity: "medio",
    desc: "max-w-* restriction in admin page (use w-full)",
    pattern: /\bmax-w-(?:3xl|4xl|5xl|6xl|7xl|screen-lg|screen-xl)\b/g,
    fileFilter: (path) => path.includes("/admin/") && !path.includes("Dialog") && !path.includes("Modal") && !path.includes("Drawer"),
    exclude: [],
  },
  {
    id: "container-admin",
    severity: "medio",
    desc: "container mx-auto in admin page",
    pattern: /\bcontainer\s+mx-auto\b/g,
    fileFilter: (path) => path.includes("/admin/"),
    exclude: [],
  },
];

// ─── Scanner ──────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDE_DIRS.some((ex) => full.includes(ex))) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (INCLUDE_EXT.some((ext) => full.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function checkStaleTime(content, filePath) {
  const findings = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/useQuery\s*\(\s*\{/.test(lines[i])) {
      // Look ahead 15 lines for staleTime
      const block = lines.slice(i, i + 15).join("\n");
      if (!block.includes("staleTime")) {
        findings.push({
          line: i + 1,
          match: lines[i].trim().substring(0, 80),
        });
      }
    }
  }
  return findings;
}

function runAudit() {
  const files = walkDir(SRC);
  const results = { bloqueante: [], alto: [], medio: [] };
  let totalFindings = 0;

  for (const file of files) {
    const rel = relative(".", file);
    const content = readFileSync(file, "utf8");

    for (const rule of rules) {
      if (rule.custom) {
        // staleTime check
        if (!file.includes("/hooks/") && !file.includes("/components/")) continue;
        const findings = checkStaleTime(content, rel);
        for (const f of findings) {
          results[rule.severity].push({
            rule: rule.id,
            file: rel,
            line: f.line,
            match: f.match,
            desc: rule.desc,
          });
          totalFindings++;
        }
        continue;
      }

      if (rule.fileFilter && !rule.fileFilter(rel)) continue;

      const matches = [...content.matchAll(rule.pattern)];
      for (const m of matches) {
        const lineNum = content.substring(0, m.index).split("\n").length;
        const lineText = content.split("\n")[lineNum - 1]?.trim() || "";

        // Check exclusions
        const excluded = rule.exclude.some((ex) => {
          if (ex instanceof RegExp) {
            return ex.test(rel) || ex.test(lineText);
          }
          return false;
        });
        if (excluded) continue;

        results[rule.severity].push({
          rule: rule.id,
          file: rel,
          line: lineNum,
          match: lineText.substring(0, 100),
          desc: rule.desc,
        });
        totalFindings++;
      }
    }
  }

  // ─── Output ─────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log("  AGENTS.md Compliance Audit Report");
  console.log("  Date:", new Date().toISOString().split("T")[0]);
  console.log("  Files scanned:", files.length);
  console.log("  Total findings:", totalFindings);
  console.log("══════════════════════════════════════════════\n");

  for (const [severity, findings] of Object.entries(results)) {
    const icon =
      severity === "bloqueante" ? "🚫" : severity === "alto" ? "⚠️ " : "💡";
    console.log(`${icon} ${severity.toUpperCase()} (${findings.length} findings)`);
    console.log("─".repeat(50));

    // Group by rule
    const byRule = {};
    for (const f of findings) {
      if (!byRule[f.rule]) byRule[f.rule] = [];
      byRule[f.rule].push(f);
    }

    for (const [ruleId, items] of Object.entries(byRule)) {
      console.log(`\n  [${ruleId}] ${items[0].desc}`);
      for (const item of items.slice(0, 10)) {
        console.log(`    ${item.file}:${item.line} — ${item.match}`);
      }
      if (items.length > 10) {
        console.log(`    ... and ${items.length - 10} more`);
      }
    }
    console.log("");
  }

  // Summary
  console.log("═══ SUMMARY ═══");
  console.log(`🚫 Bloqueante: ${results.bloqueante.length}`);
  console.log(`⚠️  Alto:       ${results.alto.length}`);
  console.log(`💡 Médio:      ${results.medio.length}`);
  console.log(`   Total:      ${totalFindings}`);

  return { results, totalFindings };
}

runAudit();
