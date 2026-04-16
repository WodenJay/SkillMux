export type TtyLike = {
  isTTY?: boolean;
};

export function isInteractiveTerminal(stdin: TtyLike, stdout: TtyLike): boolean {
  return stdin.isTTY === true && stdout.isTTY === true;
}
