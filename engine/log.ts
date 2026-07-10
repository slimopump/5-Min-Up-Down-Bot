import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

export type LogColor = "green" | "yellow" | "red" | "cyan" | "dim";

const ANSI: Record<LogColor, string> = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};
const RESET = "\x1b[0m";

function nowIso(): string {
  return new Date().toISOString();
}

class Log {
  private readonly _filePath: string;
  private _buffer: string[] = [];

  constructor() {
    mkdirSync("logs", { recursive: true });
    const tag = new Date()
      .toISOString()
      .replace("T", "-")
      .replace(/:/g, "-")
      .slice(0, 19);
    this._filePath = join("logs", `early-bird-${tag}.log`);
  }

  write(msg: string, color?: LogColor): void {
    const plain = `[${nowIso()}] ${msg}`;
    const console_line = color ? `${ANSI[color]}${plain}${RESET}` : plain;
    console.log(console_line);
    this._buffer.push(plain + "\n");
  }

  flush(): void {
    if (this._buffer.length === 0) return;
    mkdirSync("logs", { recursive: true });
    appendFileSync(this._filePath, this._buffer.join(""), "utf8");
    this._buffer = [];
  }
}

export const log = new Log();
