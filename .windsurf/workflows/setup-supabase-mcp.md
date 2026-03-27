---
description: Set up Windsurf Supabase MCP and agent skills for this project on any development machine
---
# Setup Supabase MCP and Agent Skills

Use this workflow when moving development to a new machine or when Windsurf does not yet have the Supabase MCP connection configured.

## 1. Confirm prerequisites

Make sure the machine has:

- Node.js and npm installed
- Windsurf version `0.1.37` or newer
- Access to the project repository

## 2. Configure Windsurf MCP

Open or create the file `~/.codeium/windsurf/mcp_config.json` on the current machine.

If the file already contains other MCP servers, keep them and merge in the `supabase` entry below.

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.supabase.com/mcp?project_ref=tvnhholicwjtxdhlxfqs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cbranching%2Cfunctions%2Cdevelopment%2Cstorage"
      ]
    }
  }
}
```

Windsurf does not currently support remote MCP servers over HTTP transport directly, so `mcp-remote` is required as the proxy.

## 3. Install Supabase agent skills

Run this command from the project root:

```bash
npx skills add supabase/agent-skills
```

On this project, the installed skill is placed under `.agents/skills` in the repository.

## 4. Restart Windsurf if needed

If Windsurf does not immediately detect the MCP server or the new skills, restart the IDE and reopen this project.

## 5. Verify setup

After setup is complete, confirm that:

- Windsurf can see the `supabase` MCP server
- The repository contains the installed Supabase skills under `.agents/skills`
- You can continue development on this machine with the same Supabase-aware tooling as other machines
