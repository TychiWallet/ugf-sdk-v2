import type { HttpClient } from "./http.js";
import type { RegistryResponse, PaymentOption, ChainEntry } from "./types.js";

export class Registry {
  private cache: RegistryResponse | null = null;

  /**
   * @notice Creates registry helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(private readonly http: HttpClient) {}

  /**
   * @notice Fetches and caches full token registry.
   * @returns Registry response from UGF.
   */
  async get(): Promise<RegistryResponse> {
    if (this.cache) return this.cache;
    this.cache = await this.http.get<RegistryResponse>("/tokens/registry");
    return this.cache;
  }

  /**
   * @notice Clears cached registry.
   */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * @notice Finds payment option by token symbol.
   * @param token Token symbol like `USDC` or `$U`.
   * @returns Matching payment option.
   */
  async getOption(token: string): Promise<PaymentOption> {
    const registry = await this.get();
    const option = registry.payment_options.find((o) => o.token === token);
    if (!option) throw new Error(`Token not supported: ${token}`);
    return option;
  }

  /**
   * @notice Finds token entry for one chain.
   * @param token Token symbol.
   * @param chainId Target chain id.
   * @returns Matching chain entry.
   */
  async getChainEntry(token: string, chainId: string): Promise<ChainEntry> {
    const option = await this.getOption(token);
    const entry = option.chains.find((c) => c.chain_id === chainId);
    if (!entry)
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    return entry;
  }

  /**
   * @notice Returns parsed vault ABI from registry.
   * @returns Vault ABI array.
   */
  async getVaultAbi(): Promise<object[]> {
    const registry = await this.get();
    return JSON.parse(registry.vault_abi);
  }
}
