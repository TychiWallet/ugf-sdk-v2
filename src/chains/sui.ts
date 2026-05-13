import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { HttpClient } from "../http.js";

let _sui: { SuiJsonRpcClient: typeof SuiJsonRpcClient } | null = null;

/**
 * @notice Lazily loads Sui RPC client module.
 * @returns Loaded Sui RPC client exports.
 */
async function loadSui() {
  if (!_sui) {
    const rpc = await import("@mysten/sui/jsonRpc");
    _sui = { SuiJsonRpcClient: rpc.SuiJsonRpcClient };
  }
  return _sui!;
}

export class SuiChain {
  /**
   * @notice Creates Sui chain helper.
   * @param http Shared SDK HTTP client.
   */
  constructor(private http: HttpClient) {}

  /**
   * @notice Executes sponsored Sui transaction block.
   * @param params Sui execution input.
   * @returns Sui execution result.
   */
  async execute(params: {
    digest: string;
    keypair: Ed25519Keypair;
    rpcUrl: string;
    onTick?: (status: any, i: number) => void;
  }) {
    const { digest, keypair, rpcUrl, onTick } = params;
    const { SuiJsonRpcClient } = await loadSui();

    let txBytes: string | null = null;
    let sponsorSig: string | null = null;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const status = (await this.http.get(`/status?digest=${digest}`)) as any;

      onTick?.(status, i);

      if (status.tx_bytes && status.sponsor_sig) {
        txBytes = status.tx_bytes;
        sponsorSig = status.sponsor_sig;
        break;
      }
    }

    if (!txBytes || !sponsorSig) {
      throw new Error("Sponsor timeout");
    }

    const client = new SuiJsonRpcClient({
      url: rpcUrl,
      network: "mainnet",
    });

    const bytes = Buffer.from(txBytes, "base64");
    const userSig = await keypair.signTransaction(bytes);

    const result = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature: [userSig.signature, sponsorSig],
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    return result;
  }

  /**
   * @notice Polls UGF until sponsor returns tx_bytes + sponsor_sig. No signing.
   * @param params Wait inputs.
   * @returns Sponsor-provided tx_bytes and sponsor_sig.
   */
  async waitForSponsorBytes(params: {
    digest: string;
    onTick?: (status: any, i: number) => void;
  }): Promise<{ tx_bytes: string; sponsor_sig: string }> {
    const { digest, onTick } = params;

    let txBytes: string | null = null;
    let sponsorSig: string | null = null;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const status = (await this.http.get(`/status?digest=${digest}`)) as any;

      onTick?.(status, i);

      if (status.tx_bytes && status.sponsor_sig) {
        txBytes = status.tx_bytes;
        sponsorSig = status.sponsor_sig;
        break;
      }
    }

    if (!txBytes || !sponsorSig) {
      throw new Error("Sponsor timeout");
    }

    return { tx_bytes: txBytes, sponsor_sig: sponsorSig };
  }

  /**
   * @notice Broadcasts an externally-signed Sui transaction block with both user and sponsor sigs.
   * @param params Execution inputs.
   * @returns Sui RPC execution result.
   */
  async executeSignedBlock(params: {
    rpcUrl: string;
    txBytes: string;
    userSig: string;
    sponsorSig: string;
  }) {
    const { SuiJsonRpcClient } = await loadSui();
    const client = new SuiJsonRpcClient({
      url: params.rpcUrl,
      network: "mainnet",
    });

    const bytes = Buffer.from(params.txBytes, "base64");

    return client.executeTransactionBlock({
      transactionBlock: bytes,
      signature: [params.userSig, params.sponsorSig],
      options: {
        showEffects: true,
        showEvents: true,
      },
    });
  }
}
