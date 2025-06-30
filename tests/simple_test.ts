import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Simple test to verify setup",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-vault-stats", [], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        const receipt = block.receipts[0];
        assertEquals(receipt.result.expectOk(), '{ fee-percentage: u5, total-nfts: u0, total-yield: u0 }');
    },
});
