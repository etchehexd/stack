/**
 * Put the contents of supabase/schema.sql on the clipboard.
 *
 *   npm run schema:copy
 *
 * Exists because the schema is applied by pasting it into the Supabase SQL
 * editor, and "paste schema.sql" is easy to misread as pasting the filename.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform } from "node:os";

const PATH = "supabase/schema.sql";

function clipboardCommand(): { cmd: string; args: string[] } | null {
  switch (platform()) {
    case "win32":
      // powershell's Set-Clipboard handles UTF-8 and large payloads; clip.exe
      // mangles non-ASCII, and the schema has em dashes in its comments.
      return {
        cmd: "powershell.exe",
        args: ["-NoProfile", "-Command", "$input | Set-Clipboard"],
      };
    case "darwin":
      return { cmd: "pbcopy", args: [] };
    default:
      return { cmd: "xclip", args: ["-selection", "clipboard"] };
  }
}

const sql = readFileSync(PATH, "utf8");
const lines = sql.split("\n").length;
const target = clipboardCommand();

if (!target) {
  console.error(`Unsupported platform. Open ${PATH} and copy it by hand.`);
  process.exit(1);
}

const child = spawn(target.cmd, target.args, { stdio: ["pipe", "inherit", "inherit"] });

child.on("error", () => {
  console.error(
    `\nCouldn't reach the clipboard (${target.cmd} not available).\n` +
      `Open ${PATH} in your editor and copy it manually instead.\n`,
  );
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`\nClipboard command exited ${code}. Copy ${PATH} by hand.\n`);
    process.exit(1);
  }

  console.log(
    `\n\x1b[32m✓\x1b[0m Copied ${PATH} to your clipboard ` +
      `(${lines} lines, ${Math.round(sql.length / 1024)} KB)\n\n` +
      `  Now, in the Supabase dashboard:\n` +
      `    1. SQL Editor  →  New query\n` +
      `    2. Paste  (Ctrl+V / Cmd+V)  — this should fill the editor with SQL,\n` +
      `       starting with a long line of "=" characters\n` +
      `    3. Run\n\n` +
      `  Expect: "Success. No rows returned."\n` +
      `  Then:   npm run doctor\n`,
  );
});

child.stdin.write(sql);
child.stdin.end();
