# opencode-attribution

An [OpenCode](https://opencode.ai) plugin that adds a `commit` tool, so every
commit an agent makes says who co-wrote it and which model produced it.

> [!WARNING]
> **Requires OpenCode 2 or newer.** This plugin is built on the V2 plugin API
> (tool transforms, session context, the V2 permission shape). It will not load
> or work on OpenCode 1.

## The rule

Attribution follows **who launched the shell**, never what a prompt said:

| Launched by | Commit |
| --- | --- |
| An unattended agent (an [aivi](https://github.com/aivi-hq) worker) | the agent is the sole author and committer — **no trailers** |
| An agent with a person attending | the person is the author, the agent a `Co-authored-by`, plus a `Harness:` line |
| A person in their own terminal | **untouched** — the plugin never sees these commits |

## How it works

The plugin registers one tool, `commit`, which is thin over `git commit`: you
stage with `git add` as usual, then call the tool with a message (and optional
extra git commit arguments). The decision:

1. It reads `git config --get agent.autonomous` **in the session's working
   directory**. If true, it commits with no trailers — the per-worktree git
   config already made the agent the author and committer.
2. Otherwise it appends two trailers via `git commit --trailer` (git ≥ 2.22):

   ```text
   Co-authored-by: aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>
   Harness: OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next
   ```

   The `Harness:` line is one line of debug metadata: the OpenCode version and
   the session's `providerID/modelID`. GitHub renders both trailer lines as
   plain text; only `Co-authored-by` gets special treatment (the avatar and
   profile link come from the email inside the commit).

## aivi and `agent.autonomous`

This plugin supports the `agent.autonomous` git config, which is **the default
in [aivi](https://github.com/aivi-hq) worker worktrees**: when aivi launches an
unattended worker, it sets `user.name`/`user.email` to the bot and
`agent.autonomous = true` in that worktree's git config. The plugin reads that
flag and leaves such commits alone — the bot identity is already in the
commit, and adding a co-author trailer to the bot's own work would be wrong.

## Configuring the co-author

The co-author is git config, not a plugin option:

```sh
git config --global opencode.coauthor "aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>"
```

A repository may override it locally. When unset, the default is
`OpenCode <noreply@opencode.ai>` (a plain name, no avatar).

## Installing

Globally, on every machine where agents should commit with attribution:

```sh
opencode plugin add opencode-attribution
```

Or add `"plugins": ["opencode-attribution"]` to `~/.config/opencode/opencode.json`.

## Redirecting agents to the tool

A global permission deny makes agents use the tool instead of the shell:

```jsonc
// ~/.config/opencode/opencode.json
{
  "permissions": [
    { "action": "shell", "resource": "git *", "effect": "allow" },
    { "action": "shell", "resource": "git commit *", "effect": "deny" }
  ]
}
```

The V2 permission scanner splits chained commands, so `git add x && git commit`
is denied too, and a configured deny never prompts — agents get redirected,
never stuck.

## Known gaps, stated not hidden

- `bash -c 'git commit'` and env-prefixed forms can slip past the deny. The
  plugin only sees commits that come through it; that is by design.
- A machine without the plugin gets no attribution — correct: nothing there
  launched an agent either.
- An attended session inside a worker worktree (`agent.autonomous=true`) gets
  no trailers, even though a person is attending.

## Development

Node ≥ 26 (the source is type-stripped TypeScript, run directly), git ≥ 2.22.

```sh
npm install
npm test
```

## License

MIT
