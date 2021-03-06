#!/usr/bin/env -S deno run --allow-run --allow-net --allow-read --allow-write=./

import {
  meta_url, match, values, not_found,
  sh,
  glob, join,
  pgrep_f, pstree_p, keep_alive,
} from "../src/Shell.ts";
import {path} from "../src/da.ts";

import {build_www, build_app} from "../src/Build_WWW.ts";

import {create_from_template} from "./_.template.ts";
import {split_whitespace} from "../src/da.ts";
import {install_latest as nodejs_install_latest} from "../src/NodeJS.ts";
import {start} from "./_.file_server.ts";

meta_url(import.meta.url);

if (match(".gitignore")) {
  await create_from_template("gitignore", ".gitignore");
} // if

if (match("sh <bin/upgrade|sh/upgrade>")) {
  const [file] = values() as string[];
  await create_from_template("bin_update.sh", file);
} // if

if (match("ts bin/test")) {
  await create_from_template("spec_run.ts", "bin/test");
  await create_from_template("spec___.ts", "spec/__.ts");
} // if

if (match("spec <Name.ts>")) {
  const [raw_name] = values() as string[];
  const name = (path.extname(raw_name) === ".ts") ? raw_name : `${raw_name}.ts`;
  create_from_template("spec.ts", `spec/${name}`);
} // if

if (match("src <Name>")) {
  const [raw_name] = values() as string[];
  const name = (path.extname(raw_name) === ".ts") ? raw_name : `${raw_name}.ts`;
  create_from_template("src.ts", `src/${name}`);
} // if

if (match("<zsh|sh|ts> <relative/path/to/file>")) {
  let [extension, fpath] = values() as string[];
  if (["bin", "src", "spec"].includes(path.basename(fpath))) {
    const PROJECT_NAME = path.basename(Deno.cwd());
    fpath = path.join(fpath, PROJECT_NAME)
  }

  create_from_template(`bin.${extension}`, fpath);
} // if

if (match("keep alive this: <...args>")) {
  const [cmd] = values() as string[][];
  await keep_alive(cmd);
} // if

if (match("keep alive these: <...args>")) {
  const [cmds] = values() as string[][];
  await keep_alive(...cmds);
} // if

// # =============================================================================
// # === File Server related:
// # =============================================================================
if (match(
  "file server start <PORT> <Render CMD>",
  `Be sure to 'cd' into the public directory. The render CMD is relative to the public directory.`
)) {
  const [port, raw_cmd] = values() as string[];
  await start(parseInt(port), split_whitespace(raw_cmd));
} // if

if (match("file server stop")) {
  await sh(
    split_whitespace(`pkill -INT -f`).concat(['^deno run .+ file-server start .+']),
    "exit"
  );
} // if

if (match("file server reload www-browser")) {
  const pattern = 'file server start';
  await Promise.all([
    sh(['pgrep', '-a', '-f', pattern], 'inherit', 'inherit', true),
    sh(['pkill', '-USR1', '-f', pattern], "exit")
  ]);
} // if

// =============================================================================
// === Downlaod related:
// =============================================================================
if (match("latest release <repo/name> <substring>")) {
  const [repo, substring] = values() as string[];
  let url = repo
  if (url.indexOf("http") === -1) {
    url = `https://api.github.com/repos/${repo}/releases/latest`
  }
  let resp = await fetch(url as string);
  let json = await resp.json();
  for (const x of json.assets) {
    let download = (x as any)['browser_download_url'] as string | null;
    if (download && download.indexOf(substring) > -1)
      console.log(download)
  }
}

// # =============================================================================
// # === Build related:
// # =============================================================================
if (match("build [css|js|html] <url_path> <json_config>")) {
  const [group, filepath, config] = values();
  await build_www(
    group as "css" | "js" | "html",
    filepath as string, JSON.parse(config as string)
  );
} // if

if (match("build [app|public|worker|update] <json_config>")) {
  const [group, config] = values();
  await build_app(
    group as "app" | "public" | "worker" | "update",
    JSON.parse(config as string)
  );
} // if

if (match("cache reload [...args]", `default: src bin`)) {
  let [dirs] = values() as string[][];
  if (!dirs || dirs.length === 0)
    dirs = ['src', 'bin']
  let proms = [] as Promise<any>[];
  for (const d of dirs) {
    proms = proms.concat(
      glob(join(d, '**/*.ts'))
      .map(f => sh(`deno cache --reload ${f}`))
    )
  }
  await Promise.all(proms);
} // if

// # =============================================================================
// # === NodeJS related:
// # =============================================================================
if (match("nodejs install latest")) {
  nodejs_install_latest();
} // if

// # =============================================================================
// # === Process related:
// # =============================================================================
if (match("ls child pids <pattern>")) {
  const [pattern] = values();
  let pids = await pgrep_f(pattern as string);
  (
    await Promise.all(pids.map(x => pstree_p(x)))
  ).flat().forEach(x => console.log(x));
} // if


// =============================================================================
// Finish:
// =============================================================================
not_found();
// =============================================================================

