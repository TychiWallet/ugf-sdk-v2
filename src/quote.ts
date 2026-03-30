import type { HttpClient } from "./http.js";
import { UGFError, type QuoteRequest, type QuoteResponse } from "./types.js";

export class Quote {
  constructor(private readonly http: HttpClient) {}

  async get(req: QuoteRequest): Promise<QuoteResponse> {
    const res = await this.http.post<QuoteResponse>("/quote", req);
    if (!res.digest) throw new UGFError("Quote response missing digest", "QUOTE_ERROR");
    return res;
  }
}