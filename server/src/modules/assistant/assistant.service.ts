import {
  Agent,
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
  run,
  type InputGuardrail,
  type OutputGuardrail,
} from "@openai/agents";
import type { AssistantChatInput } from "./assistant.validation.js";
import {
  createAssistantTools,
  type AssistantContext,
} from "./assistant.tools.js";
import { MongoAssistantSession } from "./assistant.session.js";
import "dotenv/config";

const destructiveIntent =
  /(?:\b(?:create|insert|edit|modify|delete|remove|drop|approve|reject|assign|promote|suspend|disable)\b|\bupdate\b(?!\s+me\b)|\badd\b(?!\s+up\b)|\b(?:deleteMany|deleteOne|updateMany|updateOne|findOneAndUpdate|findByIdAndUpdate|save)\s*\(|\b(?:POST|PUT|PATCH|DELETE)\s+\/)/i;
const restrictedHrIntent =
  /\b(employee|employees|user|users|staff|team|company|department|workforce|payroll|salary|attendance|absent|on leave|leave today|headcount)\b/i;
const personalIntent = /\b(my|mine|me|i am|i'm)\b/i;
const restrictedMarketingIntent =
  /\b(marketing|campaigns?|channel performance|attribution|marketing budget|marketing roi)\b/i;
const websiteBuildIntent =
  /\b(?:how\s+(?:do\s+i|can\s+i|to)\s+(?:make|build|create|design|develop)|(?:make|build|create|design|develop)\s+(?:a|an|the)\s+(?:website|web site|web app|web application|online store|e-?commerce site)|website\s+(?:plan|architecture|requirements))\b/i;

export function isWebsiteBuildQuestion(message: string) {
  return (
    /\b(website|web site|web app|web application|online store|e-?commerce site)\b/i.test(
      message,
    ) && websiteBuildIntent.test(message)
  );
}

export function wordLimited(text: string, maximum: number) {
  const matches = [...text.matchAll(/\S+/g)];
  if (matches.length <= maximum) return text;
  const last = matches[maximum - 1];
  return last ? text.slice(0, last.index! + last[0].length) : "";
}

const inputGuardrail: InputGuardrail = {
  name: "read_only_role_access",
  runInParallel: false,
  execute: async ({ input, context }) => {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const actor = context.context as AssistantContext;
    const destructive =
      destructiveIntent.test(text) && !isWebsiteBuildQuestion(text);
    const unauthorizedHr =
      !actor.canReadHr &&
      !isWebsiteBuildQuestion(text) &&
      restrictedHrIntent.test(text) &&
      !personalIntent.test(text);
    const unauthorizedMarketing =
      actor.marketingScope === "NONE" &&
      !isWebsiteBuildQuestion(text) &&
      restrictedMarketingIntent.test(text);
    return {
      tripwireTriggered: destructive || unauthorizedHr || unauthorizedMarketing,
      outputInfo: {
        reason: destructive
          ? "read_only"
          : unauthorizedHr
            ? "role_denied"
            : unauthorizedMarketing
              ? "marketing_role_denied"
              : null,
      },
    };
  },
};

const outputGuardrail: OutputGuardrail = {
  name: "sensitive_data_output",
  execute: async ({ agentOutput, context }) => {
    const text = String(agentOutput ?? "");
    const actor = context.context as AssistantContext;
    const secrets =
      /\b(password|access[_ -]?token|refresh[_ -]?token|secret key|api key)\b/i.test(
        text,
      );
    const unauthorizedEmail =
      !actor.canReadHr &&
      [...text.matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)].some(
        (match) => match[0].toLowerCase() !== actor.email.toLowerCase(),
      );
    return {
      tripwireTriggered: secrets || unauthorizedEmail,
      outputInfo: {
        reason: secrets
          ? "sensitive_data"
          : unauthorizedEmail
            ? "unauthorized_identity"
            : null,
      },
    };
  },
};

function refusal(input: AssistantChatInput, context: AssistantContext) {
  if (
    destructiveIntent.test(input.message) &&
    !isWebsiteBuildQuestion(input.message)
  )
    return "I can only read and summarize authorized workspace data. I cannot create, update, approve, assign, or delete records.";
  const websiteGuide = isWebsiteBuildQuestion(input.message);
  if (
    !context.canReadHr &&
    !websiteGuide &&
    restrictedHrIntent.test(input.message) &&
    !personalIntent.test(input.message)
  )
    return "You do not have permission to access organization-wide HR data. You can ask about your own tasks, your own leave requests, or public openings.";
  if (
    context.marketingScope === "NONE" &&
    !websiteGuide &&
    restrictedMarketingIntent.test(input.message)
  )
    return "You do not have permission to access Marketing workspace data.";
  return "The AI service is unavailable right now. You can ask about your own tasks, leave requests, or open positions.";
}

export async function streamAssistant(
  context: AssistantContext,
  input: AssistantChatInput,
  onText: (text: string) => void,
) {
  const denied = refusal(input, context);
  const websiteGuide = isWebsiteBuildQuestion(input.message);
  if (
    (destructiveIntent.test(input.message) && !websiteGuide) ||
    (!context.canReadHr &&
      !websiteGuide &&
      restrictedHrIntent.test(input.message) &&
      !personalIntent.test(input.message)) ||
    (context.marketingScope === "NONE" &&
      !websiteGuide &&
      restrictedMarketingIntent.test(input.message))
  ) {
    onText(denied);
    return denied;
  }
  if (!process.env.OPENAI_API_KEY) {
    onText(denied);
    return denied;
  }
  const session = new MongoAssistantSession(
    context.userId,
    input.sessionId ?? "default",
  );
  const agent = new Agent<AssistantContext>({
    name: "Ricoz Read-Only Workspace Assistant",
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    instructions: [
      "Answer using the read-only tools. Never claim to create, update, delete, approve, reject, assign, or modify workspace data. Never reveal data outside the caller's available tools. Use a tool whenever the answer depends on company data. If no authorized tool can answer, explain that access is unavailable. Keep answers concise and grounded. Use Markdown headings, bullets, and code formatting when they make a multi-part answer easier to scan.",
      ...(websiteGuide
        ? [
            "The user is asking for educational website-building guidance, not asking you to modify Ricoz workspace data. Give a practical, well-formatted Markdown guide with these sections: What it is, How it works, Pages and user flows, APIs and data model, Security, and Suggested build plan. Tailor examples to the requested website type; name concrete endpoints and page responsibilities. Keep the entire answer under 800 words, aiming for 500-700 words. Do not claim to have built or deployed anything.",
          ]
        : []),
    ].join(" "),
    tools: createAssistantTools(context),
    inputGuardrails: [inputGuardrail],
    outputGuardrails: [outputGuardrail],
  });
  try {
    const result = await run(agent, input.message, {
      context,
      session,
      maxTurns: 8,
      stream: true,
    });
    let streamedOutput = "";
    let sentLength = 0;
    let blockedOutput = false;
    for await (const chunk of result.toTextStream({
      compatibleWithNodeStreams: true,
    })) {
      streamedOutput += String(chunk);
      const unauthorizedEmail =
        !context.canReadHr &&
        [...streamedOutput.matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)].some(
          (match) => match[0].toLowerCase() !== context.email.toLowerCase(),
        );
      if (
        /\b(password|access[_ -]?token|refresh[_ -]?token|secret key|api key)\b/i.test(
          streamedOutput,
        ) ||
        unauthorizedEmail
      ) {
        blockedOutput = true;
        continue;
      }
      const words = [...streamedOutput.matchAll(/\S+/g)];
      const releasableEnd =
        words.length > 2 ? words.at(-2)!.index! : sentLength;
      const bounded = websiteGuide
        ? wordLimited(streamedOutput.slice(0, releasableEnd), 800)
        : streamedOutput.slice(0, releasableEnd);
      const delta = bounded.slice(sentLength);
      if (delta) onText(delta);
      sentLength += delta.length;
    }
    await result.completed;
    if (blockedOutput) {
      const guardedMessage =
        "I cannot provide that response because it may contain restricted or sensitive data.";
      onText(guardedMessage);
      return guardedMessage;
    }
    const answer =
      streamedOutput ||
      String(
        result.finalOutput ||
          "I could not find authorized data for that request.",
      );
    const limitedAnswer = websiteGuide ? wordLimited(answer, 800) : answer;
    const remaining = limitedAnswer.slice(sentLength);
    if (remaining) onText(remaining);
    return limitedAnswer;
  } catch (error) {
    const answer =
      error instanceof InputGuardrailTripwireTriggered
        ? denied
        : error instanceof OutputGuardrailTripwireTriggered
          ? "I cannot provide that response because it may contain restricted or sensitive data."
          : "The assistant could not complete this request. Please try again.";
    if (
      !(
        error instanceof InputGuardrailTripwireTriggered ||
        error instanceof OutputGuardrailTripwireTriggered
      )
    )
      console.error(
        "Assistant agent failed:",
        error instanceof Error ? error.message : error,
      );
    onText(answer);
    return answer;
  }
}
