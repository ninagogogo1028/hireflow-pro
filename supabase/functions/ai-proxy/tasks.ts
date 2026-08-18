/**
 * Task layer — the four recruiting capabilities the product exposes.
 *
 * A task owns: what we ask for, and what shape we want back. It must not know
 * which provider answers, which model runs, or how that provider spells its
 * schema. Everything here is expressed in the neutral vocabulary from
 * ./provider.ts.
 *
 * Note on envelopes: every schema is a top-level object, even when the caller
 * ultimately wants an array. Gemini accepts a top-level array, but several
 * other providers (notably OpenAI structured outputs) do not. Wrapping now and
 * unwrapping in `pick` keeps the client contract identical to today's while
 * staying portable. This costs nothing now and avoids rewriting all four tasks
 * later.
 */

import { type JsonSchema, type Part, ProxyError } from "./provider.ts";

/** Base64 payload ceiling for an uploaded file (~4.5 MB of original bytes). */
const MAX_FILE_BASE64_BYTES = 6 * 1024 * 1024;

/**
 * Explicit allowlist rather than a wildcard. The client currently accepts any
 * `image/*`, so exotic types (gif, bmp) will now be refused here with a clear
 * code instead of failing opaquely at the provider.
 */
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Bounds the assembled prompt so one caller cannot mint an enormous request. */
const MAX_CANDIDATES = 300;
const MAX_TEXT_CHARS = 20_000;
const MAX_SHORT_TEXT_CHARS = 500;

export interface TaskDefinition {
  /** Turns validated client input into provider-neutral prompt parts. */
  buildParts(input: Record<string, unknown>): Part[];
  /** Shape the provider must return. Always a top-level object. */
  schema: JsonSchema;
  /** Unwraps the envelope into the value the client expects. */
  pick(raw: Record<string, unknown>): unknown;
}

// --- input validation helpers -------------------------------------------------
// These throw BAD_REQUEST with field names only. Never echo values: inputs carry
// candidate PII (names, phone numbers, resume text).

const bad = (message: string): never => {
  throw new ProxyError("BAD_REQUEST", message, 400);
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
  maxChars: number,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value.trim() === "") {
    bad(`Field "${field}" must be a non-empty string.`);
  }
  const text = value as string;
  if (text.length > maxChars) {
    bad(`Field "${field}" exceeds ${maxChars} characters.`);
  }
  return text;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
  maxChars: number,
): string => {
  const value = input[field];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") bad(`Field "${field}" must be a string.`);
  const text = value as string;
  if (text.length > maxChars) {
    bad(`Field "${field}" exceeds ${maxChars} characters.`);
  }
  return text;
};

const requireArray = (
  raw: Record<string, unknown>,
  field: string,
): unknown[] => {
  const value = raw[field];
  if (!Array.isArray(value)) {
    throw new ProxyError(
      "INVALID_PROVIDER_OUTPUT",
      `AI provider response was missing the "${field}" list.`,
      502,
    );
  }
  return value;
};

// --- task definitions ---------------------------------------------------------

/** Extracts name and contact details from an uploaded resume file. */
const parseResume: TaskDefinition = {
  buildParts(input) {
    const mimeType = requireString(input, "mimeType", 128);
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new ProxyError(
        "UNSUPPORTED_MEDIA_TYPE",
        `Unsupported file type "${mimeType}".`,
        415,
      );
    }

    const dataBase64 = input["fileBase64"];
    if (typeof dataBase64 !== "string" || dataBase64 === "") {
      bad('Field "fileBase64" must be a non-empty string.');
    }
    const data = dataBase64 as string;
    if (data.length > MAX_FILE_BASE64_BYTES) {
      throw new ProxyError(
        "PAYLOAD_TOO_LARGE",
        "Uploaded file is too large.",
        413,
      );
    }

    return [
      { kind: "file", mimeType, dataBase64: data },
      {
        kind: "text",
        text:
          "请从这份简历中提取候选人的姓名和联系方式（电话或邮箱）。如果找不到，请返回空字符串。",
      },
    ];
  },
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "候选人姓名" },
      contactInfo: { type: "string", description: "联系方式" },
    },
    order: ["name", "contactInfo"],
    required: ["name", "contactInfo"],
  },
  pick: (raw) => raw,
};

/** Extracts hiring insights from a job description. */
const analyzeJD: TaskDefinition = {
  buildParts(input) {
    const jdText = requireString(input, "jdText", MAX_TEXT_CHARS);
    return [{
      kind: "text",
      text: `分析以下职位描述(JD)，并提取出：
      1. 核心技能关键词
      2. 岗位难点
      3. 筛选简历时的关键评估点
      JD内容：${jdText}`,
    }];
  },
  schema: {
    type: "object",
    properties: {
      skills: {
        type: "array",
        description: "核心技能关键词",
        items: { type: "string" },
      },
      painPoints: { type: "string", description: "岗位难点" },
      evaluationTips: {
        type: "array",
        description: "筛选简历时的关键评估点",
        items: { type: "string" },
      },
    },
    order: ["skills", "painPoints", "evaluationTips"],
    required: ["skills", "painPoints", "evaluationTips"],
  },
  pick: (raw) => raw,
};

/**
 * Ranks an already-filtered candidate set against one job.
 *
 * The caller supplies the shortlist; this task does not retrieve it. That keeps
 * the door open for a retrieval step in front of the model later without
 * changing this contract.
 */
const matchTalentToJob: TaskDefinition = {
  buildParts(input) {
    const jobTitle = requireString(input, "jobTitle", MAX_SHORT_TEXT_CHARS);
    const jdText = requireString(input, "jdText", MAX_TEXT_CHARS);

    const candidates = input["candidates"];
    if (!Array.isArray(candidates)) {
      bad('Field "candidates" must be an array.');
    }
    const list = candidates as unknown[];
    if (list.length === 0) bad('Field "candidates" must not be empty.');
    if (list.length > MAX_CANDIDATES) {
      // Refuse loudly rather than truncating: a silently shortened pool would
      // return confidently wrong rankings.
      throw new ProxyError(
        "PAYLOAD_TOO_LARGE",
        `Too many candidates in one request (limit ${MAX_CANDIDATES}).`,
        413,
      );
    }

    const rendered = list.map((entry, index) => {
      if (typeof entry !== "object" || entry === null) {
        bad(`Candidate at index ${index} must be an object.`);
      }
      const candidate = entry as Record<string, unknown>;
      const id = requireString(candidate, "id", 128);
      const name = requireString(candidate, "name", MAX_SHORT_TEXT_CHARS);
      const notes = optionalString(candidate, "notes", MAX_TEXT_CHARS);
      return `ID: ${id}, 姓名: ${name}, 备注: ${notes}`;
    }).join("\n");

    return [{
      kind: "text",
      text:
        `你是一个资深HR。请根据以下职位信息和人才储备库中的候选人信息，选出最匹配的3位候选人。

      职位名称: ${jobTitle}
      职位描述: ${jdText}

      候选人列表:
      ${rendered}

      请给出每个人的匹配分数(0-100)和简短的匹配理由。`,
    }];
  },
  schema: {
    type: "object",
    properties: {
      matches: {
        type: "array",
        description: "最匹配的候选人，按匹配度从高到低",
        items: {
          type: "object",
          properties: {
            candidateId: { type: "string" },
            matchScore: { type: "number" },
            reason: { type: "string" },
          },
          order: ["candidateId", "matchScore", "reason"],
          required: ["candidateId", "matchScore", "reason"],
        },
      },
    },
    order: ["matches"],
    required: ["matches"],
  },
  pick: (raw) => requireArray(raw, "matches"),
};

/** Generates stage-appropriate interview questions for a job. */
const generateInterviewQuestions: TaskDefinition = {
  buildParts(input) {
    const jobTitle = requireString(input, "jobTitle", MAX_SHORT_TEXT_CHARS);
    const stage = requireString(input, "stage", MAX_SHORT_TEXT_CHARS);
    return [{
      kind: "text",
      text: `针对职位 "${jobTitle}" 的 ${stage} 面试，请生成5个高质量的问题及其考核重点。`,
    }];
  },
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            purpose: { type: "string" },
          },
          order: ["question", "purpose"],
          required: ["question", "purpose"],
        },
      },
    },
    order: ["questions"],
    required: ["questions"],
  },
  pick: (raw) => requireArray(raw, "questions"),
};

/**
 * The only callable surface. Clients name a task; they cannot supply a free-form
 * prompt. This is why the proxy cannot be repurposed as a general chat endpoint.
 */
export const TASKS: Record<string, TaskDefinition> = {
  parseResume,
  analyzeJD,
  matchTalentToJob,
  generateInterviewQuestions,
};

export const isTaskName = (value: unknown): value is keyof typeof TASKS =>
  typeof value === "string" && Object.hasOwn(TASKS, value);
