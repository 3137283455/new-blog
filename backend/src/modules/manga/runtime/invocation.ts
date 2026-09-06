import vm from "node:vm";

let sequence = 0;

/** Capture each invocation's arguments lexically before an async source can yield. */
export async function invokeSource(
  context: vm.Context,
  expression: string,
  args: unknown[],
  name: string,
  timeoutMs = 30000,
  argumentName = "__venera_args__",
): Promise<any> {
  const slot = `__boke_invocation_${++sequence}`;
  context[slot] = args;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = new vm.Script(
      `(( ${argumentName} ) => (${expression}))(globalThis[${JSON.stringify(slot)}])`,
    ).runInContext(context, { timeout: Math.min(3000, timeoutMs) });
    // The function above captured the array; no shared globals survive suspension.
    delete context[slot];
    return await Promise.race([
      Promise.resolve(result),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} 执行超时`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    delete context[slot];
    if (timer) clearTimeout(timer);
  }
}
