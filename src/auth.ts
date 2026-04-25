import type { ethers } from "ethers";
import type { HttpClient } from "./http.js";
import {
  UGFAuthError,
  type LoginResponse,
  type NonceResponse,
} from "./types.js";

export class Auth {
  /**
   * @notice Creates auth helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(private readonly http: HttpClient) {}

  /**
   * @notice Fetches login nonce for wallet address.
   * @param address EVM wallet address.
   * @returns Login nonce string.
   */
  async getNonce(address: string): Promise<string> {
    const res = await this.http.get<NonceResponse>(
      `/auth/nonce?address=${address}`,
    );
    return res.nonce;
  }

  /**
   * @notice Logs in with ethers signer and stores JWT.
   * @param signer EVM signer for message signing.
   * @returns JWT token returned by UGF.
   */
  async login(signer: ethers.Signer): Promise<string> {
    const address = await signer.getAddress();
    const nonce = await this.getNonce(address);
    const signature = await signer.signMessage(
      `Sign in to UGF\nNonce: ${nonce}`,
    );

    const res = await this.http.post<LoginResponse>("/auth/wallet-login", {
      address,
      signature,
      nonce,
    });

    if (!res.token) throw new UGFAuthError("Login failed — no token returned");
    this.http.setToken(res.token);
    return res.token;
  }

  /**
   * @notice Logs in with externally produced signature.
   * @param address EVM wallet address.
   * @param nonce Nonce previously fetched from UGF.
   * @param signature Signed login message.
   * @returns JWT token returned by UGF.
   */
  async loginRaw(
    address: string,
    nonce: string,
    signature: string,
  ): Promise<string> {
    const res = await this.http.post<LoginResponse>("/auth/wallet-login", {
      address,
      signature,
      nonce,
    });

    if (!res.token) throw new UGFAuthError("Login failed — no token returned");
    this.http.setToken(res.token);
    return res.token;
  }

  /**
   * @notice Stores JWT on shared HTTP client.
   * @param token JWT token value.
   */
  setToken(token: string): void {
    this.http.setToken(token);
  }

  /**
   * @notice Returns currently stored JWT.
   * @returns JWT token or `null`.
   */
  getToken(): string | null {
    return this.http.getToken();
  }
}
