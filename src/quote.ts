import type { HttpClient } from "./http.js";
import { UGFError, type QuoteRequest, type QuoteResponse } from "./types.js";

export class Quote {
  /**
   * @notice Creates quote helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(private readonly http: HttpClient) {}

  /**
   * @notice Requests quote for destination action.
   * @param req Route description and tx object.
   * @returns UGF quote response.
   */
  async get(req: QuoteRequest): Promise<QuoteResponse> {
    const res = await this.http.post<QuoteResponse>("/quote", req);
    if (!res.digest) throw new UGFError("Quote response missing digest", "QUOTE_ERROR");
    return res;
  }
}
