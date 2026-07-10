export class TerminalDisplay {
  private firstRun = true;
  private lineCount: number = 0;

  update(lines: string[]) {
    const moveUp = this.firstRun ? "" : `\x1b[${this.lineCount}A`;
    const output = lines.map((line) => `\x1b[K${line}`).join("\n");
    process.stdout.write(moveUp + output + "\n");
    this.lineCount = lines.length;
    if (this.firstRun) this.firstRun = false;
  }
}
