import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { createUserSkill } from "./lib/create-skill.ts";

const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  provider: z.string().nullable(),
  scope: z.string(),
  pluginId: z.string().nullable(),
  filePath: z.string(),
  manageable: z.boolean(),
  registrySkillId: z.string().nullable(),
});

const registrySkillSchema = z.object({
  id: z.string(),
  source: z.string(),
  skillId: z.string(),
  name: z.string(),
  installs: z.number(),
  stars: z.number().nullable(),
  installUrl: z.string().nullable(),
  url: z.string(),
  topic: z.string().nullable(),
  summary: z.string().nullable(),
});

const workspaceInput = z.object({
  projectId: z.string().optional(),
  environmentId: z.string().nullable().optional(),
});

export const rpcContract = defineRpcContract({
  listSkills: {
    input: workspaceInput,
    output: z.object({ skills: z.array(skillSchema) }),
  },
  getSkillContent: {
    input: workspaceInput.extend({
      skillId: z.string().min(1),
      path: z.string().default("SKILL.md"),
    }),
    output: z.object({ content: z.string(), revision: z.string() }),
  },
  listSkillFiles: {
    input: workspaceInput.extend({ skillId: z.string().min(1) }),
    output: z.object({
      files: z.array(z.string()),
      truncated: z.boolean(),
    }),
  },
  saveSkill: {
    input: workspaceInput.extend({
      skillId: z.string().min(1),
      content: z.string(),
      revision: z.string().min(1),
    }),
    output: z.object({ filePath: z.string(), revision: z.string() }),
  },
  deleteSkill: {
    input: workspaceInput.extend({ skillId: z.string().min(1) }),
    output: z.object({ deletedPath: z.string() }),
  },
  createSkill: {
    input: z.object({
      name: z.string().min(1).max(64),
      description: z.string().max(1024),
      body: z.string().optional(),
    }),
    output: z.object({ name: z.string(), filePath: z.string() }),
  },
  searchRegistry: {
    input: z.object({
      query: z.string().optional(),
      page: z.number().int().min(0).optional(),
      perPage: z.number().int().min(1).max(48).optional(),
    }),
    output: z.object({
      skills: z.array(registrySkillSchema),
      pagination: z.object({
        page: z.number(),
        perPage: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
      ranking: z.string(),
    }),
  },
  installRegistrySkill: {
    input: z.object({ registrySkillId: z.string().min(1) }),
    output: z.object({ ok: z.literal(true), filePath: z.string() }),
  },
});

const SKILLS_CHANGED = "skills-changed";

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");

  async function workspace(args: {
    projectId?: string;
    environmentId?: string | null;
  }) {
    if (args.projectId) {
      return {
        projectId: args.projectId,
        environmentId: args.environmentId ?? null,
      };
    }
    const projects = await bb.sdk.projects.list({ includePersonal: true });
    const personal = projects.find((p) => p.kind === "personal");
    if (!personal) throw new Error("Personal project not found.");
    return { projectId: personal.id, environmentId: null as string | null };
  }

  function publishChanged() {
    bb.realtime.publish(SKILLS_CHANGED, { at: Date.now() });
  }

  bb.rpc.register(rpcContract, {
    listSkills: async (input) => {
      const ws = await workspace(input);
      return bb.sdk.skills.list(ws);
    },
    getSkillContent: async (input) => {
      const ws = await workspace(input);
      return bb.sdk.skills.getContent({
        ...ws,
        skillId: input.skillId,
        path: input.path,
      });
    },
    listSkillFiles: async (input) => {
      const ws = await workspace(input);
      return bb.sdk.skills.listFiles({ ...ws, skillId: input.skillId });
    },
    saveSkill: async (input) => {
      const ws = await workspace(input);
      const result = await bb.sdk.skills.update({
        ...ws,
        skillId: input.skillId,
        content: input.content,
        revision: input.revision,
      });
      publishChanged();
      return result;
    },
    deleteSkill: async (input) => {
      const ws = await workspace(input);
      const result = await bb.sdk.skills.remove({
        ...ws,
        skillId: input.skillId,
      });
      publishChanged();
      return result;
    },
    createSkill: async (input) => {
      const result = await createUserSkill({
        dataDir: bb.server.experimental_dataDir,
        name: input.name,
        description: input.description,
        body: input.body,
      });
      publishChanged();
      return result;
    },
    searchRegistry: async (input) => bb.sdk.skills.registry.search(input),
    installRegistrySkill: async (input) => {
      const result = await bb.sdk.skills.registry.install({
        registrySkillId: input.registrySkillId,
      });
      publishChanged();
      return result;
    },
  });

  const usage = [
    "Usage:",
    "  bb skill-library list [--json]",
    "  bb skill-library create <name> --description <text> [--json]",
  ].join("\n");

  bb.cli.register({
    name: "skill-library",
    summary: "Browse and create skills for the Skill Library plugin",
    commands: [
      {
        name: "list",
        summary: "List discovered skills",
        usage: "bb skill-library list [--json]",
      },
      {
        name: "create",
        summary: "Create a bb user skill under ~/.bb/skills",
        usage:
          "bb skill-library create <name> --description <text> [--json]",
      },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const args = argv.filter((a) => a !== "--json");
      const [command, ...rest] = args;
      const reply = (value: unknown, text: string) => ({
        exitCode: 0,
        stdout: json ? JSON.stringify(value) : text,
      });
      switch (command) {
        case undefined:
        case "help":
        case "--help":
          return { exitCode: 0, stdout: usage };
        case "list": {
          const ws = await workspace({});
          const { skills } = await bb.sdk.skills.list(ws);
          return reply(
            skills,
            skills.length === 0
              ? "No skills."
              : skills
                  .map(
                    (s) =>
                      `${s.manageable ? "edit" : "ro  "}  ${s.name}  ${s.scope}  ${s.id}`,
                  )
                  .join("\n"),
          );
        }
        case "create": {
          const name = rest[0];
          const descIdx = rest.indexOf("--description");
          const description =
            descIdx >= 0 ? rest.slice(descIdx + 1).join(" ").trim() : "";
          if (!name || description === "") break;
          const created = await createUserSkill({
            dataDir: bb.server.experimental_dataDir,
            name,
            description,
          });
          publishChanged();
          return reply(created, `Created ${created.filePath}`);
        }
      }
      return { exitCode: 1, stderr: usage };
    },
  });

  bb.onDispose(() => {
    bb.log.info("disposed");
  });
}
