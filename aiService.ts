/**
 * AI service — client side.
 *
 * Talks to our own server-side proxy, never to an AI provider directly. The
 * provider credential lives only in the proxy's server environment, so nothing
 * secret is needed here and nothing secret ends up in the bundle.
 *
 * This module names a *task* and passes input. It deliberately knows nothing
 * about which provider or model answers, so swapping providers server-side
 * requires no change here.
 *
 * The four exported functions keep the exact signatures and fallback values the
 * previous direct-to-provider implementation had, so callers are unaffected.
 */

/** Where our proxy lives. Public URL, not a secret. */
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

/**
 * Supabase publishable (anon) key. This ships in the client by design and is
 * NOT a secret: it only satisfies the gateway's "has a key" check. It grants no
 * privileges beyond calling the function. Real spend protection is the quota cap
 * on the provider side.
 */
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Client-side call budget. Slightly above the proxy's own 60s provider timeout,
 * so a proxy-reported timeout surfaces as PROVIDER_TIMEOUT rather than being
 * masked by the client giving up first.
 */
const REQUEST_TIMEOUT_MS = 75_000;

/**
 * Largest resume file we will upload, in original bytes.
 *
 * Base64 inflates by ~4/3, and the proxy caps the encoded payload at 6 MB, so
 * 4 MB of original bytes encodes to ~5.5 MB and stays safely under. Checking
 * here means an oversized file fails instantly and locally instead of after a
 * long upload.
 */
export const MAX_RESUME_FILE_BYTES = 4 * 1024 * 1024;

/**
 * File types the proxy accepts. Kept in sync with SUPPORTED_MIME_TYPES in
 * supabase/functions/ai-proxy/tasks.ts — if these drift, the user gets an opaque
 * 415 after uploading instead of an instant local message.
 */
export const SUPPORTED_RESUME_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const isSupportedResumeType = (mimeType: string): boolean =>
  (SUPPORTED_RESUME_MIME_TYPES as readonly string[]).includes(mimeType);

// --- shared response types ----------------------------------------------------

export interface JDAnalysis {
  skills: string[];
  painPoints: string;
  evaluationTips: string[];
}

export interface InterviewQuestion {
  question: string;
  purpose: string;
}

export interface TalentMatchResult {
  candidateId: string;
  matchScore: number;
  reason: string;
}

export interface ParsedResume {
  name: string;
  contactInfo: string;
}

/**
 * Error codes. The first group mirrors the proxy's neutral codes; the last two
 * are raised only on this side. Callers switch on these rather than on messages,
 * so provider changes never affect error handling.
 */
export type AiErrorCode =
  | 'BAD_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_TASK'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SERVER_MISCONFIGURED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'INVALID_PROVIDER_OUTPUT'
  | 'NOT_CONFIGURED'
  | 'NETWORK_ERROR';

export class AiServiceError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    /** Absent when the request never reached the proxy. */
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

// --- transport ----------------------------------------------------------------

type TaskName =
  | 'parseResume'
  | 'analyzeJD'
  | 'matchTalentToJob'
  | 'generateInterviewQuestions';

/**
 * Posts one task to the proxy and returns its `data` payload.
 *
 * Throws AiServiceError on any failure. Callers decide whether to surface it or
 * fall back; see the note on silent failure at the bottom of this file.
 */
const callTask = async <T>(
  task: TaskName,
  input: Record<string, unknown>,
): Promise<T> => {
  if (!PROXY_URL || !PUBLISHABLE_KEY) {
    throw new AiServiceError(
      'NOT_CONFIGURED',
      'AI proxy is not configured. Set VITE_AI_PROXY_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Both headers are required: Supabase's gateway reads `apikey`, and
        // `Authorization` satisfies the function's JWT check.
        'apikey': PUBLISHABLE_KEY,
        'Authorization': `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ task, input }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Offline, DNS failure, CORS rejection, or our own timeout. Deliberately
    // does not include the original message: it varies by browser and can
    // embed the request URL.
    throw new AiServiceError(
      'NETWORK_ERROR',
      'Could not reach the AI service.',
    );
  }

  let payload: {
    data?: unknown;
    error?: { code?: string; message?: string };
  };
  try {
    payload = await response.json();
  } catch {
    throw new AiServiceError(
      'INVALID_PROVIDER_OUTPUT',
      'AI service returned a malformed response.',
      response.status,
    );
  }

  if (!response.ok) {
    // The gateway can reject before our function runs, in which case the body
    // is its own shape rather than ours.
    throw new AiServiceError(
      (payload.error?.code as AiErrorCode) ?? 'PROVIDER_ERROR',
      payload.error?.message ?? 'AI service request failed.',
      response.status,
    );
  }

  if (payload.data === undefined || payload.data === null) {
    throw new AiServiceError(
      'INVALID_PROVIDER_OUTPUT',
      'AI service returned no data.',
      response.status,
    );
  }

  return payload.data as T;
};

// --- tasks --------------------------------------------------------------------
//
// Each function preserves the previous fallback-on-error behaviour so this
// change is behaviour-neutral for callers. That fallback is a known gap, not a
// design choice: failures are invisible to the user, and switching to a proxy
// adds a second thing that can fail. Surfacing these is tracked as its own task.

/** Analyzes a job description and extracts hiring insights. */
export const analyzeJD = async (jdText: string): Promise<JDAnalysis> => {
  try {
    return await callTask<JDAnalysis>('analyzeJD', { jdText });
  } catch (error) {
    console.error('AI analyzeJD failed:', errorCodeOf(error));
    return { skills: [], painPoints: '', evaluationTips: [] };
  }
};

/** Ranks talent-pool candidates against one job. */
export const matchTalentToJob = async (
  jobTitle: string,
  jdText: string,
  candidates: { id: string; name: string; notes: string }[],
): Promise<TalentMatchResult[]> => {
  try {
    if (candidates.length === 0) return [];
    return await callTask<TalentMatchResult[]>('matchTalentToJob', {
      jobTitle,
      jdText,
      candidates,
    });
  } catch (error) {
    console.error('AI matchTalentToJob failed:', errorCodeOf(error));
    return [];
  }
};

/** Extracts name and contact details from a resume file. */
export const parseResumeData = async (
  fileBase64: string,
  mimeType: string,
): Promise<ParsedResume | null> => {
  try {
    return await callTask<ParsedResume>('parseResume', {
      fileBase64,
      mimeType,
    });
  } catch (error) {
    console.error('AI parseResume failed:', errorCodeOf(error));
    return null;
  }
};

/** Generates stage-appropriate interview questions. */
export const generateInterviewQuestions = async (
  jdTitle: string,
  stage: string,
): Promise<InterviewQuestion[]> => {
  try {
    return await callTask<InterviewQuestion[]>('generateInterviewQuestions', {
      jobTitle: jdTitle,
      stage,
    });
  } catch (error) {
    console.error('AI generateInterviewQuestions failed:', errorCodeOf(error));
    return [];
  }
};

/**
 * Logs the code only, never the message. Messages from the proxy are safe, but
 * a browser-generated network error can embed the request URL, and this keeps
 * the console free of anything resembling request content.
 */
const errorCodeOf = (error: unknown): string =>
  error instanceof AiServiceError ? error.code : 'UNKNOWN';
