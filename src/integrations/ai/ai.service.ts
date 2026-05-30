import type { ChatCompletionRequest, ChatCompletionResponse } from "./ai.types";
import { logger } from "@/lib/logger";

export interface AIProviderAdapter {
  name: string;
  createChatCompletion(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl: string
  ): Promise<ChatCompletionResponse>;
}

class OpenAICompatibleAdapter implements AIProviderAdapter {
  name = "openai-compatible";

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  }

  private createRequestId(): string {
    const candidate = (globalThis.crypto as { randomUUID?: () => string } | undefined)
      ?.randomUUID?.();
    if (candidate) return candidate;
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private getMaxRetries(): number {
    const raw = process.env.AI_HTTP_RETRIES ?? "3";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return 3;
    return Math.floor(parsed);
  }

  private shouldLogRawResponse(): boolean {
    const value = process.env.AI_LOG_RAW_RESPONSE ?? process.env.AI_LOG_RESPONSE ?? "";
    return value === "1" || value.toLowerCase() === "true";
  }

  private truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private summarizeResponse(response: ChatCompletionResponse) {
    return {
      id: response.id,
      model: response.model,
      choices: (response.choices ?? []).map((c) => ({
        finish_reason: c.finish_reason ?? null,
        role: c.message?.role ?? null,
        content: this.truncate(String(c.message?.content ?? ""), 1500),
      })),
    };
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl: string
  ): Promise<ChatCompletionResponse> {
    const requestId = this.createRequestId();
    const url = `${this.normalizeBaseUrl(baseUrl)}/chat/completions`;
    const startedAtTotal = Date.now();
    const maxRetries = this.getMaxRetries();

    const requestJson = JSON.stringify(request);
    if (this.shouldLogRawResponse()) {
      logger.info("AI request payload", {
        adapter: this.name,
        requestId,
        url,
        payload: {
          length: requestJson.length,
          preview: this.truncate(requestJson, 2000),
        },
      });
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const attemptStartedAt = Date.now();

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: requestJson,
        });
      } catch (error) {
        const elapsedMs = Date.now() - attemptStartedAt;
        const totalElapsedMs = Date.now() - startedAtTotal;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt);
          logger.warn("AI HTTP retry (network error)", {
            adapter: this.name,
            requestId,
            url,
            attempt: attempt + 1,
            maxRetries,
            elapsedMs,
            totalElapsedMs,
            waitMs,
            error: errorMessage,
          });
          await this.delay(waitMs);
          continue;
        }

        logger.error("AI HTTP error (network)", {
          adapter: this.name,
          requestId,
          url,
          attempt: attempt + 1,
          maxRetries,
          elapsedMs,
          totalElapsedMs,
          error: errorMessage,
        });
        throw new Error(
          `AI network error (adapter=${this.name}, requestId=${requestId}): ${errorMessage}`
        );
      }

      const providerRequestId =
        response.headers.get("x-request-id") ??
        response.headers.get("x-amzn-requestid") ??
        response.headers.get("cf-ray") ??
        null;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const elapsedMs = Date.now() - attemptStartedAt;
        const totalElapsedMs = Date.now() - startedAtTotal;

        const isRetryable = response.status === 429 || (response.status >= 500 && response.status <= 599);
        if (isRetryable && attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt);
          logger.warn("AI HTTP retry (bad status)", {
            adapter: this.name,
            requestId,
            providerRequestId,
            url,
            status: response.status,
            attempt: attempt + 1,
            maxRetries,
            elapsedMs,
            totalElapsedMs,
            waitMs,
            body: {
              length: errorText.length,
              preview: errorText.slice(0, 800),
            },
          });
          await this.delay(waitMs);
          continue;
        }

        logger.error("AI HTTP error", {
          adapter: this.name,
          requestId,
          providerRequestId,
          url,
          status: response.status,
          elapsedMs,
          totalElapsedMs,
          attempt: attempt + 1,
          maxRetries,
          body: {
            length: errorText.length,
            preview: this.shouldLogRawResponse() ? errorText.slice(0, 2000) : errorText.slice(0, 800),
          },
        });

        throw new Error(
          `AI API error ${response.status} (adapter=${this.name}, requestId=${requestId}, providerRequestId=${providerRequestId ?? "n/a"})`
        );
      }

      const elapsedMs = Date.now() - attemptStartedAt;
      const totalElapsedMs = Date.now() - startedAtTotal;

      logger.info("AI HTTP ok", {
        adapter: this.name,
        requestId,
        providerRequestId,
        url,
        status: response.status,
        elapsedMs,
        totalElapsedMs,
        attempt: attempt + 1,
        maxRetries,
      });

      try {
        const parsed = (await response.json()) as ChatCompletionResponse;
        if (this.shouldLogRawResponse()) {
          logger.info("AI raw response", {
            adapter: this.name,
            requestId,
            providerRequestId,
            response: this.summarizeResponse(parsed),
          });
        }
        return parsed;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt);
          logger.warn("AI HTTP retry (JSON parse error)", {
            adapter: this.name,
            requestId,
            providerRequestId,
            url,
            attempt: attempt + 1,
            maxRetries,
            elapsedMs,
            totalElapsedMs,
            waitMs,
            error: errorMessage,
          });
          await this.delay(waitMs);
          continue;
        }

        logger.error("AI JSON parse error", {
          adapter: this.name,
          requestId,
          providerRequestId,
          url,
          elapsedMs,
          totalElapsedMs,
          attempt: attempt + 1,
          maxRetries,
          error: errorMessage,
        });
        throw new Error(
          `AI response JSON parse error (adapter=${this.name}, requestId=${requestId}, providerRequestId=${providerRequestId ?? "n/a"})`
        );
      }
    }

    throw new Error(`AI error: retries exhausted (adapter=${this.name}, requestId=${requestId})`);
  }
}

class GeminiAdapter implements AIProviderAdapter {
  name = "gemini";

  async createChatCompletion(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl: string
  ): Promise<ChatCompletionResponse> {
    const model = request.model.replace("gemini-", "");
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction = request.messages.find((m) => m.role === "system");

    const body: Record<string, unknown> = { contents };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    if (request.temperature !== undefined) {
      body.generationConfig = {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens ?? 2048,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      id: `gemini-${Date.now()}`,
      model: request.model,
      choices: [
        {
          message: { role: "assistant", content: text },
          finish_reason: "stop",
        },
      ],
    };
  }
}

class AnthropicAdapter implements AIProviderAdapter {
  name = "anthropic";

  async createChatCompletion(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl: string
  ): Promise<ChatCompletionResponse> {
    const url = `${baseUrl}/messages`;

    const systemMessage = request.messages.find((m) => m.role === "system");
    const otherMessages = request.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: request.model,
      messages: otherMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.max_tokens ?? 1024,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      id: `anthropic-${Date.now()}`,
      model: request.model,
      choices: [
        {
          message: { role: "assistant", content: data.content[0].text },
          finish_reason: data.stop_reason,
        },
      ],
    };
  }
}

const adapters: AIProviderAdapter[] = [
  new OpenAICompatibleAdapter(),
  new GeminiAdapter(),
  new AnthropicAdapter(),
];

function detectAdapter(baseUrl: string, model: string): AIProviderAdapter {
  const lowerUrl = baseUrl.toLowerCase();

  if (lowerUrl.includes("anthropic")) {
    return adapters.find((a) => a.name === "anthropic")!;
  }

  if (lowerUrl.includes("generativelanguage") || model.toLowerCase().startsWith("gemini")) {
    return adapters.find((a) => a.name === "gemini")!;
  }

  return adapters.find((a) => a.name === "openai-compatible")!;
}

export async function createChatCompletion(
  request: ChatCompletionRequest,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<ChatCompletionResponse> {
  const adapter = detectAdapter(baseUrl, model);

  logger.info(`Calling AI adapter: ${adapter.name}`, {
    model,
    baseUrl,
    messageCount: request.messages.length,
    temperature: request.temperature ?? null,
    maxTokens: request.max_tokens ?? null,
  });

  const response = await adapter.createChatCompletion(request, apiKey, baseUrl);

  logger.info("AI response received", {
    adapter: adapter.name,
    finishReason: response.choices[0]?.finish_reason,
    hasChoices: Array.isArray(response.choices) && response.choices.length > 0,
    contentLength:
      response.choices[0]?.message?.content !== undefined
        ? String(response.choices[0]?.message?.content ?? "").length
        : null,
  });

  return response;
}
