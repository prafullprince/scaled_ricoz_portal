import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  MarketingSocialAccount,
  MarketingSocialConversation,
  MarketingSocialMessage,
  MarketingSocialOAuthState,
  MarketingSocialPost,
  SalesClientCampaignRecipient,
  SalesLead,
  SalesLeadSource,
  type MarketingSocialProvider,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope, runWithCompany, scopeFor } from "../company/company.context.js";
import { encryptSecret, decryptSecret } from "../integrations/integration.security.js";

type OAuthProvider = "LINKEDIN" | "META" | "WHATSAPP";
type JsonObject = Record<string, unknown>;
const graphVersion = () => process.env.META_GRAPH_VERSION || "v24.0";
const clientUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0]!.trim().replace(/\/+$/, "");
const linkedinVersion = () => process.env.LINKEDIN_API_VERSION || "202610";
const text = (value: unknown) => typeof value === "string" ? value : "";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(503, `${name} must be configured before connecting this provider`);
  return value;
}

async function fetchJson(url: URL, init: RequestInit = {}): Promise<JsonObject> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(502, "Social provider could not be reached");
  }
  const result: unknown = await response.json().catch(() => null);
  const payload = result && typeof result === "object" ? result as JsonObject : {};
  const providerError = payload.error && typeof payload.error === "object" ? payload.error as JsonObject : {};
  if (!response.ok || payload.error) {
    const message = text(providerError.message);
    throw new ApiError(502, message ? `Social provider: ${message.slice(0, 250)}` : `Social provider returned HTTP ${response.status}`);
  }
  return payload;
}

async function metaRequest(path: string, accessToken: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET") {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path.replace(/^\/+/, "")}`);
  const values = new URLSearchParams({ ...params, access_token: accessToken });
  if (method === "GET") url.search = values.toString();
  return fetchJson(url, method === "GET" ? {} : {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: values,
  });
}

export async function getApprovedWhatsAppTemplates(accountId: string) {
  const account = await MarketingSocialAccount.findOne({
    _id: accountId,
    provider: "WHATSAPP",
    status: "CONNECTED",
  }).select("+encryptedAccessToken").lean();
  if (!account?.encryptedAccessToken || !account.businessAccountId) {
    throw new ApiError(409, "Connect a WhatsApp Business account before using campaign templates");
  }
  const response = await metaRequest(
    `${account.businessAccountId}/message_templates`,
    decryptSecret(account.encryptedAccessToken),
    { fields: "name,status,language,category,components", limit: "100" },
  );
  const rows = Array.isArray(response.data) ? response.data as JsonObject[] : [];
  return rows
    .filter((row) => text(row.status) === "APPROVED")
    .map((row) => {
      const components = Array.isArray(row.components) ? row.components as JsonObject[] : [];
      const body = components.find((component) => text(component.type) === "BODY");
      const templateText = text(body?.text);
      const variables = [...templateText.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1]!.trim());
      return {
        name: text(row.name),
        language: text(row.language),
        category: text(row.category),
        body: templateText,
        variables,
      };
    })
    .filter((template) => template.name && template.language);
}

export async function sendWhatsAppTemplateMessage(input: {
  accountId: string;
  phone: string;
  name: string;
  language: string;
  body: string;
  variables: string[];
}) {
  const account = await MarketingSocialAccount.findOne({
    _id: input.accountId,
    provider: "WHATSAPP",
    status: "CONNECTED",
  }).select("+encryptedAccessToken").lean();
  if (!account?.encryptedAccessToken) {
    throw new ApiError(409, "Reconnect the WhatsApp Business account before sending");
  }
  const parameters = input.variables.map((value, index) => {
    const placeholder = [...input.body.matchAll(/\{\{([^{}]+)\}\}/g)][index]?.[1]?.trim();
    return {
      type: "text",
      ...(placeholder && !/^\d+$/.test(placeholder) ? { parameter_name: placeholder } : {}),
      text: value,
    };
  });
  const template: JsonObject = {
    name: input.name,
    language: { code: input.language },
    ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}),
  };
  const result = await metaRequest(`${account.providerAccountId}/messages`, decryptSecret(account.encryptedAccessToken), {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.phone,
    type: "template",
    template: JSON.stringify(template),
  }, "POST");
  const messages = Array.isArray(result.messages) ? result.messages as JsonObject[] : [];
  const messageId = text(messages[0]?.id);
  if (!messageId) throw new ApiError(502, "WhatsApp did not confirm the campaign message");
  return messageId;
}

async function linkedinRequest(path: string, accessToken: string, body?: JsonObject) {
  const url = new URL(`https://api.linkedin.com${path}`);
  return fetchJson(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": linkedinVersion(),
      "X-Restli-Protocol-Version": "2.0.0",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function callbackUrl(provider: OAuthProvider) {
  const envName = provider === "LINKEDIN"
    ? "LINKEDIN_REDIRECT_URI"
    : provider === "WHATSAPP"
      ? "WHATSAPP_REDIRECT_URI"
      : "META_REDIRECT_URI";
  return requiredEnv(envName);
}

function providerScopes(provider: OAuthProvider) {
  if (provider === "LINKEDIN") return ["openid", "profile", "w_member_social"];
  if (provider === "WHATSAPP") return ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"];
  return [
    "pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_messaging",
    "instagram_basic", "instagram_content_publish", "instagram_manage_messages",
  ];
}

function publicAccount(account: {
  _id: Types.ObjectId;
  provider: MarketingSocialProvider;
  providerAccountId: string;
  name: string;
  avatarUrl: string;
  tokenExpiresAt: Date | null;
  scopes: string[];
  pageId: string;
  businessAccountId: string;
  status: string;
  lastError: string;
  createdAt: Date;
}) {
  return {
    _id: account._id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    name: account.name,
    avatarUrl: account.avatarUrl,
    tokenExpiresAt: account.tokenExpiresAt,
    scopes: account.scopes,
    pageId: account.pageId,
    businessAccountId: account.businessAccountId,
    status: account.status,
    lastError: account.lastError,
    createdAt: account.createdAt,
  };
}

async function saveSocialAccount(input: {
  provider: MarketingSocialProvider;
  providerAccountId: string;
  name: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  scopes: string[];
  pageId?: string;
  businessAccountId?: string;
  userId: Types.ObjectId;
}) {
  return MarketingSocialAccount.findOneAndUpdate(
    { provider: input.provider, providerAccountId: input.providerAccountId },
    {
      $set: {
        name: input.name.slice(0, 160),
        encryptedAccessToken: encryptSecret(input.accessToken),
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        pageId: input.pageId ?? "",
        businessAccountId: input.businessAccountId ?? "",
        connectedBy: input.userId,
        status: "CONNECTED",
        lastError: "",
      },
      $setOnInsert: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select("+encryptedAccessToken").lean();
}

async function exchangeOAuthCode(provider: OAuthProvider, code: string, userId: Types.ObjectId) {
  const redirectUri = callbackUrl(provider);
  if (provider === "LINKEDIN") {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: requiredEnv("LINKEDIN_CLIENT_ID"),
      client_secret: requiredEnv("LINKEDIN_CLIENT_SECRET"),
    });
    const token = await fetchJson(new URL("https://www.linkedin.com/oauth/v2/accessToken"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const accessToken = text(token.access_token);
    if (!accessToken) throw new ApiError(502, "LinkedIn did not return an access token");
    const profile = await linkedinRequest("/v2/userinfo", accessToken);
    const id = text(profile.sub);
    if (!id) throw new ApiError(502, "LinkedIn did not return the connected profile identifier");
    await saveSocialAccount({
      provider: "LINKEDIN",
      providerAccountId: id,
      name: text(profile.name) || "LinkedIn member",
      accessToken,
      tokenExpiresAt: typeof token.expires_in === "number" ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: providerScopes(provider),
      userId,
    });
    return;
  }

  const clientId = requiredEnv("META_APP_ID");
  const clientSecret = requiredEnv("META_APP_SECRET");
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  }).toString();
  const shortToken = await fetchJson(tokenUrl);
  const rawToken = text(shortToken.access_token);
  if (!rawToken) throw new ApiError(502, "Meta did not return an access token");
  const longTokenUrl = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
  longTokenUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: rawToken,
  }).toString();
  const longToken = await fetchJson(longTokenUrl);
  const accessToken = text(longToken.access_token) || rawToken;
  const expiresAt = typeof longToken.expires_in === "number" ? new Date(Date.now() + longToken.expires_in * 1000) : null;
  if (provider === "META") {
    const pages = await metaRequest("me/accounts", accessToken, {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "100",
    });
    const pageRows = Array.isArray(pages.data) ? pages.data as JsonObject[] : [];
    if (!pageRows.length) throw new ApiError(400, "No Facebook Pages were returned. Grant Pages access and try again.");
    for (const page of pageRows) {
      const pageId = text(page.id);
      const pageToken = text(page.access_token);
      if (!pageId || !pageToken) continue;
      const pageName = text(page.name) || "Facebook Page";
      await saveSocialAccount({
        provider: "FACEBOOK", providerAccountId: pageId, name: pageName,
        accessToken: pageToken, tokenExpiresAt: expiresAt, scopes: providerScopes(provider),
        pageId, userId,
      });
      const ig = page.instagram_business_account && typeof page.instagram_business_account === "object"
        ? page.instagram_business_account as JsonObject : null;
      if (ig && text(ig.id)) {
        await saveSocialAccount({
          provider: "INSTAGRAM", providerAccountId: text(ig.id), name: text(ig.username) || `${pageName} · Instagram`,
          accessToken: pageToken, tokenExpiresAt: expiresAt, scopes: providerScopes(provider),
          pageId, userId,
        });
      }
    }
    return;
  }

  const businesses = await metaRequest("me/businesses", accessToken, {
    fields: "id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}",
    limit: "100",
  });
  const businessRows = Array.isArray(businesses.data) ? businesses.data as JsonObject[] : [];
  let count = 0;
  for (const business of businessRows) {
    const businessId = text(business.id);
    const owned = business.owned_whatsapp_business_accounts && typeof business.owned_whatsapp_business_accounts === "object"
      ? business.owned_whatsapp_business_accounts as JsonObject : {};
    const client = business.client_whatsapp_business_accounts && typeof business.client_whatsapp_business_accounts === "object"
      ? business.client_whatsapp_business_accounts as JsonObject : {};
    const wabaRows = [
      ...(Array.isArray(owned.data) ? owned.data as JsonObject[] : []),
      ...(Array.isArray(client.data) ? client.data as JsonObject[] : []),
    ];
    for (const waba of wabaRows) {
      const wabaId = text(waba.id);
      const phones = waba.phone_numbers && typeof waba.phone_numbers === "object" ? waba.phone_numbers as JsonObject : {};
      const phoneRows = Array.isArray(phones.data) ? phones.data as JsonObject[] : [];
      for (const phone of phoneRows) {
        const phoneId = text(phone.id);
        if (!phoneId) continue;
        await saveSocialAccount({
          provider: "WHATSAPP",
          providerAccountId: phoneId,
          name: text(phone.verified_name) || text(phone.display_phone_number) || "WhatsApp Business",
          accessToken,
          tokenExpiresAt: expiresAt,
          scopes: providerScopes(provider),
          businessAccountId: wabaId || businessId,
          userId,
        });
        count += 1;
      }
    }
  }
  if (!count) throw new ApiError(400, "No WhatsApp Business phone numbers were returned. Assign a WhatsApp Business account and grant WhatsApp permissions.");
}

export async function startSocialOAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = String(req.params.provider).toUpperCase() as OAuthProvider;
    if (!["LINKEDIN", "META", "WHATSAPP"].includes(provider)) throw new ApiError(400, "Unsupported social provider");
    const scope = currentScope();
    if (!scope) throw new ApiError(500, "Company scope is unavailable for this request");
    const state = cryptoRandomToken();
    await MarketingSocialOAuthState.create({
      companyId: scope.companyId,
      stateHash: createHash("sha256").update(state).digest("hex"),
      provider,
      userId: req.authUser!._id,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const redirectUri = callbackUrl(provider);
    let authorizationUrl: URL;
    if (provider === "LINKEDIN") {
      authorizationUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
      authorizationUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: requiredEnv("LINKEDIN_CLIENT_ID"),
        redirect_uri: redirectUri,
        scope: providerScopes(provider).join(" "),
        state,
      }).toString();
    } else {
      authorizationUrl = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
      authorizationUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: requiredEnv("META_APP_ID"),
        redirect_uri: redirectUri,
        scope: providerScopes(provider).join(","),
        state,
      }).toString();
    }
    res.json({ success: true, authorizationUrl: authorizationUrl.toString() });
  } catch (error) { next(error); }
}

function cryptoRandomToken() {
  return randomBytes(32).toString("hex");
}

export async function completeSocialOAuth(req: Request, res: Response) {
  const provider = String(req.params.provider).toUpperCase() as OAuthProvider;
  const state = text(req.query.state);
  const client = `${clientUrl()}/dashboard/marketing/social`;
  if (!["LINKEDIN", "META", "WHATSAPP"].includes(provider) || !state) {
    res.redirect(`${client}?social=error&reason=invalid_callback`);
    return;
  }
  const attempt = await runWithCompany(null, () => MarketingSocialOAuthState.findOneAndDelete({
    provider,
    stateHash: createHash("sha256").update(state).digest("hex"),
    expiresAt: { $gt: new Date() },
  }).lean());
  if (!attempt) {
    res.redirect(`${client}?social=error&reason=expired_authorization`);
    return;
  }
  if (req.query.error) {
    res.redirect(`${client}?social=error&reason=authorization_declined`);
    return;
  }
  try {
    const code = text(req.query.code);
    if (!code) throw new ApiError(400, "Provider did not return an authorization code");
    await runWithCompany(scopeFor(attempt.companyId), () => exchangeOAuthCode(provider, code, attempt.userId));
    res.redirect(`${client}?social=connected&provider=${provider.toLowerCase()}`);
  } catch (error) {
    const reason = error instanceof ApiError ? error.message : "Provider connection failed";
    res.redirect(`${client}?social=error&reason=${encodeURIComponent(reason.slice(0, 180))}`);
  }
}

export async function getSocialAccounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await MarketingSocialAccount.find().sort({ provider: 1, name: 1 }).limit(100).lean();
    res.json({ success: true, accounts: accounts.map(publicAccount) });
  } catch (error) { next(error); }
}

export async function disconnectSocialAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await MarketingSocialAccount.findByIdAndUpdate(req.params.accountId, {
      $set: { status: "DISCONNECTED", encryptedAccessToken: "", lastError: "" },
    }, { new: true }).lean();
    if (!account) throw new ApiError(404, "Social account was not found");
    res.json({ success: true, account: publicAccount(account) });
  } catch (error) { next(error); }
}

async function publishPost(postId: Types.ObjectId) {
  const post = await MarketingSocialPost.findById(postId).lean();
  if (!post) throw new ApiError(404, "Social post was not found");
  const account = await MarketingSocialAccount.findOne({ _id: post.accountId, status: "CONNECTED" })
    .select("+encryptedAccessToken").lean();
  if (!account?.encryptedAccessToken) throw new ApiError(409, "Reconnect this social account before publishing");
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now()) throw new ApiError(409, "Social authorization has expired; reconnect the account");
  const accessToken = decryptSecret(account.encryptedAccessToken);
  try {
    let externalPostId = "";
    if (post.provider === "LINKEDIN") {
      if (post.mediaUrl) throw new ApiError(400, "LinkedIn image uploads are not enabled yet; publish a text post");
      const result = await linkedinRequest("/rest/posts", accessToken, {
        author: `urn:li:person:${account.providerAccountId}`,
        commentary: post.text,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      });
      externalPostId = text(result.id) || text(result["x-restli-id"]);
    } else if (post.provider === "FACEBOOK") {
      const result = await metaRequest(`${account.pageId || account.providerAccountId}/feed`, accessToken, {
        message: post.text,
        ...(post.mediaUrl ? { link: post.mediaUrl } : {}),
      }, "POST");
      externalPostId = text(result.id);
    } else if (post.provider === "INSTAGRAM") {
      if (!post.mediaUrl) throw new ApiError(400, "Instagram publishing needs an HTTPS image URL hosted publicly");
      const container = await metaRequest(`${account.providerAccountId}/media`, accessToken, {
        image_url: post.mediaUrl,
        caption: post.text,
      }, "POST");
      const containerId = text(container.id);
      if (!containerId) throw new ApiError(502, "Instagram did not create a media container");
      const published = await metaRequest(`${account.providerAccountId}/media_publish`, accessToken, {
        creation_id: containerId,
      }, "POST");
      externalPostId = text(published.id);
    } else {
      throw new ApiError(400, "WhatsApp is a messaging channel; send messages from the unified inbox");
    }
    return MarketingSocialPost.findByIdAndUpdate(postId, {
      $set: { status: "PUBLISHED", externalPostId, publishedAt: new Date(), error: "" },
    }, { new: true }).populate("accountId", "provider name providerAccountId").lean();
  } catch (error) {
    await MarketingSocialPost.findByIdAndUpdate(postId, {
      $set: {
        status: "FAILED",
        error: error instanceof ApiError ? error.message : "Publishing failed; reconnect the account or check its permissions",
      },
    });
    throw error;
  }
}

export async function getSocialPosts(_req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await MarketingSocialAccount.find({ status: "CONNECTED", provider: { $in: ["FACEBOOK", "INSTAGRAM"] } })
      .select("+encryptedAccessToken").limit(40).lean();
    const syncWarnings: string[] = [];
    for (const account of accounts) {
      try {
        const path = account.provider === "FACEBOOK"
          ? `${account.pageId || account.providerAccountId}/feed`
          : `${account.providerAccountId}/media`;
        const fields = account.provider === "FACEBOOK"
          ? "id,message,created_time,permalink_url"
          : "id,caption,media_type,media_url,permalink,timestamp";
        const feed = await metaRequest(path, decryptSecret(account.encryptedAccessToken), { fields, limit: "25" });
        const rows = Array.isArray(feed.data) ? feed.data as JsonObject[] : [];
        for (const row of rows) {
          const externalPostId = text(row.id);
          if (!externalPostId) continue;
          const postedOn = new Date(text(row.created_time) || text(row.timestamp) || Date.now());
          if (!Number.isFinite(postedOn.getTime())) continue;
          await MarketingSocialPost.findOneAndUpdate(
            { accountId: account._id, externalPostId },
            {
              $set: {
                provider: account.provider,
                text: text(row.message) || text(row.caption) || `[${text(row.media_type) || "Social"} post]`,
                mediaUrl: text(row.media_url),
                postUrl: text(row.permalink_url) || text(row.permalink),
                status: "PUBLISHED",
                externalPostId,
                publishedAt: postedOn,
                error: "",
                source: "PLATFORM",
              },
              $setOnInsert: { accountId: account._id, createdBy: account.connectedBy },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }
      } catch (error) {
        syncWarnings.push(`${account.name}: ${error instanceof ApiError ? error.message : "Recent posts could not be synchronized."}`);
      }
    }
    const posts = await MarketingSocialPost.find().populate("accountId", "provider name providerAccountId")
      .sort({ publishedAt: -1, createdAt: -1 }).limit(100).lean();
    res.json({ success: true, posts, syncWarnings });
  } catch (error) { next(error); }
}

export async function createSocialPost(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await MarketingSocialAccount.findOne({
      _id: req.body.accountId,
      status: "CONNECTED",
    }).lean();
    if (!account) throw new ApiError(404, "Choose a connected social account");
    if (account.provider === "WHATSAPP") throw new ApiError(400, "WhatsApp supports inbox replies, not feed publishing");
    const post = await MarketingSocialPost.create({
      accountId: account._id,
      provider: account.provider,
      text: req.body.text,
      mediaUrl: req.body.mediaUrl ?? "",
      status: "DRAFT",
      createdBy: req.authUser!._id,
    });
    const result = req.body.publishNow ? await publishPost(post._id) : post;
    res.status(req.body.publishNow ? 201 : 202).json({ success: true, post: result });
  } catch (error) { next(error); }
}

export async function getSocialInbox(_req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await MarketingSocialConversation.find()
      .populate("accountId", "provider name providerAccountId status")
      .sort({ lastMessageAt: -1 }).limit(100).lean();
    const ids = conversations.map((conversation) => conversation._id);
    const messages = ids.length
      ? await MarketingSocialMessage.find({ conversationId: { $in: ids } }).sort({ sentAt: 1 }).limit(500).lean()
      : [];
    res.json({ success: true, conversations, messages });
  } catch (error) { next(error); }
}

export async function markSocialConversationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await MarketingSocialConversation.findByIdAndUpdate(
      req.params.conversationId,
      { $set: { unreadCount: 0 } },
      { new: true },
    ).lean();
    if (!conversation) throw new ApiError(404, "Conversation was not found");
    res.json({ success: true, conversation });
  } catch (error) { next(error); }
}

export async function replyToSocialConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await MarketingSocialConversation.findById(req.params.conversationId).lean();
    if (!conversation) throw new ApiError(404, "Conversation was not found");
    const account = await MarketingSocialAccount.findOne({ _id: conversation.accountId, status: "CONNECTED" })
      .select("+encryptedAccessToken").lean();
    if (!account?.encryptedAccessToken) throw new ApiError(409, "Reconnect this social account before replying");
    const accessToken = decryptSecret(account.encryptedAccessToken);
    let externalMessageId = "";
    const sentAt = new Date();
    if (conversation.provider === "WHATSAPP") {
      const result = await metaRequest(`${account.providerAccountId}/messages`, accessToken, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conversation.participantId,
        type: "text",
        text: JSON.stringify({ body: req.body.text }),
      }, "POST");
      const messages = Array.isArray(result.messages) ? result.messages as JsonObject[] : [];
      externalMessageId = text(messages[0]?.id);
    } else if (conversation.provider === "FACEBOOK" || conversation.provider === "INSTAGRAM") {
      const result = await metaRequest(`${account.providerAccountId}/messages`, accessToken, {
        recipient: JSON.stringify({ id: conversation.participantId }),
        message: JSON.stringify({ text: req.body.text }),
        messaging_type: "RESPONSE",
      }, "POST");
      externalMessageId = text(result.message_id);
    } else {
      throw new ApiError(400, "LinkedIn messaging is not available to standard third-party apps");
    }
    if (!externalMessageId) throw new ApiError(502, "Provider did not confirm the message");
    const message = await MarketingSocialMessage.create({
      conversationId: conversation._id,
      externalMessageId: `${conversation.provider}:${externalMessageId}`,
      direction: "OUTBOUND",
      body: req.body.text,
      sentAt,
      deliveryStatus: "SENT",
    });
    await MarketingSocialConversation.updateOne({ _id: conversation._id }, {
      $set: { lastMessage: req.body.text, lastMessageAt: sentAt },
    });
    res.status(201).json({ success: true, message });
  } catch (error) { next(error); }
}

export async function getSocialLeads(_req: Request, res: Response, next: NextFunction) {
  try {
    const leads = await SalesLead.find({
      source: { $in: [SalesLeadSource.META, SalesLeadSource.INSTAGRAM, SalesLeadSource.LINKEDIN] },
    }).select("name company email phone source sourceDetail campaignId status ownerId createdAt")
      .populate("ownerId", "name").sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, leads });
  } catch (error) { next(error); }
}

export async function verifyMetaWebhook(req: Request, res: Response) {
  const mode = text(req.query["hub.mode"]);
  const token = text(req.query["hub.verify_token"]);
  const challenge = text(req.query["hub.challenge"]);
  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

export function verifyMetaWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string) {
  const signature = signatureHeader?.replace(/^sha256=/i, "") ?? "";
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

async function persistInboundMessage(input: {
  provider: MarketingSocialProvider;
  providerAccountId: string;
  participantId: string;
  participantName: string;
  messageId: string;
  body: string;
  sentAt: Date;
}) {
  const accounts = await runWithCompany(null, () => MarketingSocialAccount.find({
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    status: "CONNECTED",
  }).select("_id companyId").lean());
  for (const account of accounts) {
    await runWithCompany(scopeFor(account.companyId), async () => {
      const conversation = await MarketingSocialConversation.findOneAndUpdate(
        { accountId: account._id, externalConversationId: input.participantId },
        {
          $setOnInsert: {
            provider: input.provider,
            participantId: input.participantId,
            participantName: input.participantName || "Social contact",
            lastMessage: "",
            lastMessageAt: input.sentAt,
            accountId: account._id,
            unreadCount: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      let inserted = false;
      try {
        const messageResult = await MarketingSocialMessage.updateOne(
          { externalMessageId: `${input.provider}:${input.providerAccountId}:${input.messageId}` },
          {
            $setOnInsert: {
              conversationId: conversation._id,
              direction: "INBOUND",
              body: input.body.slice(0, 4000),
              sentAt: input.sentAt,
              deliveryStatus: "RECEIVED",
            },
          },
          { upsert: true },
        );
        inserted = messageResult.upsertedCount > 0;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      }
      if (inserted) {
        await MarketingSocialConversation.updateOne(
          { _id: conversation._id, lastMessageAt: { $lte: input.sentAt } },
          {
            $set: {
              participantName: input.participantName || "Social contact",
              lastMessage: input.body.slice(0, 4000),
              lastMessageAt: input.sentAt,
            },
            $inc: { unreadCount: 1 },
          },
        );
      }
      if (input.provider === "WHATSAPP") {
        await SalesClientCampaignRecipient.findOneAndUpdate(
          {
            recipient: input.participantId,
            channel: "WHATSAPP",
            status: { $in: ["SENT", "DELIVERED", "READ"] },
          },
          { $set: { status: "REPLIED" } },
          { sort: { sentAt: -1 } },
        );
      }
    });
  }
}

async function updateWhatsAppCampaignStatus(
  phoneId: string,
  messageId: string,
  status: string,
  error: string,
) {
  const mappedStatus = status === "read"
    ? "READ"
    : status === "delivered"
      ? "DELIVERED"
      : status === "failed"
        ? "FAILED"
        : status === "sent"
          ? "SENT"
          : null;
  if (!mappedStatus) return;
  const accounts = await runWithCompany(null, () => MarketingSocialAccount.find({
    provider: "WHATSAPP",
    providerAccountId: phoneId,
    status: "CONNECTED",
  }).select("companyId").lean());
  for (const account of accounts) {
    await runWithCompany(scopeFor(account.companyId), () => SalesClientCampaignRecipient.findOneAndUpdate(
      {
        externalMessageId: messageId,
        channel: "WHATSAPP",
        status: mappedStatus === "FAILED"
          ? { $in: ["SENT", "FAILED"] }
          : mappedStatus === "DELIVERED"
            ? { $in: ["SENT", "DELIVERED"] }
            : mappedStatus === "READ"
              ? { $in: ["SENT", "DELIVERED", "READ"] }
              : "SENT",
      },
      {
        $set: {
          status: mappedStatus,
          error: mappedStatus === "FAILED" ? error.slice(0, 900) : "",
        },
      },
    ));
  }
}

export async function receiveMetaWebhook(req: Request, res: Response) {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !verifyMetaWebhookSignature(rawBody, req.header("x-hub-signature-256"), requiredEnv("META_APP_SECRET"))) {
    res.sendStatus(403);
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body as JsonObject : {};
  const entries = Array.isArray(body.entry) ? body.entry as JsonObject[] : [];
  for (const entry of entries) {
    const entryId = text(entry.id);
    const messaging = Array.isArray(entry.messaging) ? entry.messaging as JsonObject[] : [];
    for (const event of messaging) {
      if (event.message && typeof event.message === "object" && (event.message as JsonObject).is_echo) continue;
      const sender = event.sender && typeof event.sender === "object" ? event.sender as JsonObject : {};
      const recipient = event.recipient && typeof event.recipient === "object" ? event.recipient as JsonObject : {};
      const message = event.message && typeof event.message === "object" ? event.message as JsonObject : {};
      const senderId = text(sender.id);
      const messageId = text(message.mid);
      const attachments = message.attachments && typeof message.attachments === "object" ? message.attachments as JsonObject : {};
      const attachmentRows = Array.isArray(attachments.data) ? attachments.data as JsonObject[] : [];
      const messageBody = text(message.text) || (attachmentRows.length ? `[${text(attachmentRows[0]?.type) || "Attachment"} received]` : "");
      if (!entryId || !senderId || !messageId || !messageBody || !text(recipient.id)) continue;
      await persistInboundMessage({
        provider: body.object === "instagram" ? "INSTAGRAM" : "FACEBOOK",
        providerAccountId: entryId,
        participantId: senderId,
        participantName: senderId,
        messageId,
        body: messageBody,
        sentAt: new Date(typeof event.timestamp === "number" ? event.timestamp : Date.now()),
      });
    }
    const changes = Array.isArray(entry.changes) ? entry.changes as JsonObject[] : [];
    for (const change of changes) {
      const value = change.value && typeof change.value === "object" ? change.value as JsonObject : {};
      const metadata = value.metadata && typeof value.metadata === "object" ? value.metadata as JsonObject : {};
      const phoneId = text(metadata.phone_number_id);
      const messages = Array.isArray(value.messages) ? value.messages as JsonObject[] : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses as JsonObject[] : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts as JsonObject[] : [];
      for (const status of statuses) {
        const errors = Array.isArray(status.errors) ? status.errors as JsonObject[] : [];
        const firstError = errors[0] ?? {};
        await updateWhatsAppCampaignStatus(
          phoneId,
          text(status.id),
          text(status.status),
          text(firstError.title) || text(firstError.message),
        );
      }
      for (const message of messages) {
        const senderId = text(message.from);
        const messageId = text(message.id);
        const messageType = text(message.type);
        const content = message.text && typeof message.text === "object"
          ? text((message.text as JsonObject).body)
          : messageType && messageType !== "text" ? `[${messageType} received]` : "";
        const contact = contacts.find((row) => text(row.wa_id) === senderId);
        const profile = contact?.profile && typeof contact.profile === "object" ? contact.profile as JsonObject : {};
        if (!phoneId || !senderId || !messageId || !content) continue;
        const timestamp = Number(text(message.timestamp));
        await persistInboundMessage({
          provider: "WHATSAPP",
          providerAccountId: phoneId,
          participantId: senderId,
          participantName: text(profile.name) || senderId,
          messageId,
          body: content,
          sentAt: Number.isFinite(timestamp) ? new Date(timestamp * 1000) : new Date(),
        });
      }
    }
  }
  res.sendStatus(200);
}
