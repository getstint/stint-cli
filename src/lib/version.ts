import manifest from "../../package.json" with { type: "json" };

export const version: string = manifest.version;

export const userAgent = (client = "stint-cli") =>
  `${client}/${version} (${process.platform}-${process.arch}) node/${process.versions.node}`;
