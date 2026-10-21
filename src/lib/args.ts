export type Parsed = { command: string | undefined; positionals: string[]; flags: Record<string, string | boolean> };

export function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      positionals.push(...argv.slice(index));
      break;
    }
    if (arg.startsWith("--")) {
      const [name, value] = arg.slice(2).split(/=(.*)/s, 2);
      if (name.startsWith("no-")) flags[name.slice(3)] = false;
      else if (value !== undefined) flags[name] = value;
      else if (
        ["key", "api-url", "days", "agent"].includes(name) &&
        argv[index + 1] &&
        !argv[index + 1].startsWith("-")
      )
        flags[name] = argv[++index];
      else flags[name] = true;
      continue;
    }
    if (arg === "-h") flags.help = true;
    else if (arg === "-v") flags.version = true;
    else if (arg === "-y") flags.yes = true;
    else if (command === undefined) command = arg;
    else positionals.push(arg);
  }
  return { command, positionals, flags };
}
