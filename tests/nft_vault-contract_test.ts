import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Mock NFT contract for testing
const mockNftContract = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5.mock-nft";

Clarinet.test({
    name: "Get initial vault stats",
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

Clarinet.test({
    name: "Set fee percentage as owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-fee-percentage", [types.uint(10)], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify the fee was updated
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-vault-stats", [], deployer.address)
        ]);
        
        const stats = block.receipts[0].result.expectOk();
        assertStringIncludes(stats, "fee-percentage: u10");
    },
});

Clarinet.test({
    name: "Non-owner cannot set fee percentage",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-fee-percentage", [types.uint(15)], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(100); // err-owner-only
    },
});

Clarinet.test({
    name: "Cannot set fee percentage above 100%",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-fee-percentage", [types.uint(101)], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(109); // Invalid fee percentage
    },
});

Clarinet.test({
    name: "Set and get yield rate for NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-nft";
        const tokenId = 1;
        
        // Set yield rate
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(tokenContract),
                types.uint(tokenId),
                types.uint(50)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Get yield info
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-nft-yield-info", [
                types.principal(tokenContract),
                types.uint(tokenId)
            ], deployer.address)
        ]);
        
        const yieldInfo = block.receipts[0].result.expectOk();
        assertStringIncludes(yieldInfo, "yield-rate: u50");
        assertStringIncludes(yieldInfo, "total-earned: u0");
    },
});

Clarinet.test({
    name: "Non-owner cannot set yield rate",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-nft";
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(tokenContract),
                types.uint(1),
                types.uint(25)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(100); // err-owner-only
    },
});

Clarinet.test({
    name: "Cannot set zero yield rate",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-nft";
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(tokenContract),
                types.uint(1),
                types.uint(0)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(108); // err-invalid-yield
    },
});

Clarinet.test({
    name: "Authorize and revoke operator",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Authorize operator
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "authorize-operator", [
                types.principal(wallet2.address),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Revoke operator
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "revoke-operator", [
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Authorize operator with expiration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Authorize operator with expiration at block 100
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "authorize-operator", [
                types.principal(wallet2.address),
                types.some(types.uint(100))
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Check if NFT is not in vault initially",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-nft";
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "is-in-vault", [
                types.principal(wallet1.address),
                types.principal(tokenContract),
                types.uint(1)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectBool(false);
    },
});

Clarinet.test({
    name: "Get default yield info for non-existent NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.non-existent-nft";
        
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-nft-yield-info", [
                types.principal(tokenContract),
                types.uint(999)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        const result = block.receipts[0].result.expectOk();
        assertEquals(result, '{ last-claimed: u0, total-earned: u0, yield-rate: u0 }');
    },
});

// Note: Testing deposit-nft and withdraw-nft functions would require a mock NFT contract
// that implements the nft-trait. These tests demonstrate testing the contract's
// authorization, validation, and read-only functions thoroughly.

Clarinet.test({
    name: "Multiple operations in sequence",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const tokenContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-nft";
        
        // Set fee percentage
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-fee-percentage", [types.uint(8)], deployer.address),
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(tokenContract),
                types.uint(1),
                types.uint(100)
            ], deployer.address),
            Tx.contractCall("nft_vault-contract", "authorize-operator", [
                types.principal(wallet1.address),
                types.some(types.uint(50))
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 3);
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        
        // Verify state changes
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-vault-stats", [], deployer.address),
            Tx.contractCall("nft_vault-contract", "get-nft-yield-info", [
                types.principal(tokenContract),
                types.uint(1)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertStringIncludes(block.receipts[0].result.expectOk(), "fee-percentage: u8");
        assertStringIncludes(block.receipts[1].result.expectOk(), "yield-rate: u100");
    },
});

// Tests for NFT deposit and withdrawal functionality

Clarinet.test({
    name: "Deposit NFT into vault",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 1;
        
        // First mint an NFT to wallet1
        let block = chain.mineBlock([
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Deposit the NFT into the vault
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal("ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5.mock-nft"),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify NFT is in vault
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "is-in-vault", [
                types.principal(wallet1.address),
                types.principal("ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5.mock-nft"),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectBool(true);
        
        // Check vault stats updated
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "get-vault-stats", [], wallet1.address)
        ]);
        
        assertStringIncludes(block.receipts[0].result.expectOk(), "total-nfts: u1");
    },
});

Clarinet.test({
    name: "Cannot deposit already deposited NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 2;
        
        // Mint and deposit NFT
        let block = chain.mineBlock([
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Try to deposit again - should fail
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(106); // err-already-deposited
    },
});

Clarinet.test({
    name: "Withdraw NFT from vault",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 3;
        
        // Mint and deposit NFT
        let block = chain.mineBlock([
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        // Withdraw the NFT
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "withdraw-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify NFT is no longer in vault
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "is-in-vault", [
                types.principal(wallet1.address),
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectBool(false);
    },
});

Clarinet.test({
    name: "Cannot withdraw NFT not deposited",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 999;
        
        // Try to withdraw NFT that was never deposited
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "withdraw-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(107); // err-not-deposited
    },
});

Clarinet.test({
    name: "Deposit NFT with lock period",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 4;
        const lockUntil = 50;
        
        // Mint and deposit NFT with lock period
        let block = chain.mineBlock([
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.some(types.uint(lockUntil))
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Try to withdraw before lock expires - should fail
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "withdraw-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(103); // err-vault-locked
    },
});

Clarinet.test({
    name: "Claim yield from deposited NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 5;
        const yieldRate = 10;
        
        // Set up yield rate for the NFT
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.uint(yieldRate)
            ], deployer.address)
        ]);
        
        // Mint and deposit NFT
        block = chain.mineBlock([
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        // Wait a few blocks to accumulate yield
        chain.mineEmptyBlock();
        chain.mineEmptyBlock();
        chain.mineEmptyBlock();
        
        // Claim yield
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "claim-yield", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        // Should return the net yield amount after fees
        const result = block.receipts[0].result;
        // The exact amount depends on blocks elapsed and fee calculation
        assertEquals(result.expectOk().slice(0, 1), "u"); // Should be a uint
    },
});

Clarinet.test({
    name: "Cannot claim yield for non-deposited NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 999;
        
        // Try to claim yield for NFT not in vault
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "claim-yield", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(107); // err-not-deposited
    },
});

Clarinet.test({
    name: "Fee calculation on yield claim",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const tokenId = 6;
        const yieldRate = 20;
        const feePercentage = 10;
        
        // Set custom fee percentage
        let block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-fee-percentage", [
                types.uint(feePercentage)
            ], deployer.address)
        ]);
        
        // Set yield rate and mint/deposit NFT
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "set-yield-rate", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.uint(yieldRate)
            ], deployer.address),
            Tx.contractCall("mock-nft", "mint", [
                types.principal(wallet1.address),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "deposit-nft", [
                types.principal(mockNftContract),
                types.uint(tokenId),
                types.none()
            ], wallet1.address)
        ]);
        
        // Wait exactly 1 block to get predictable yield
        chain.mineEmptyBlock();
        
        // Claim yield - should be (yieldRate * 1 block) - 10% fee
        block = chain.mineBlock([
            Tx.contractCall("nft_vault-contract", "claim-yield", [
                types.principal(mockNftContract),
                types.uint(tokenId)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        // Net yield should be yieldRate - (yieldRate * feePercentage / 100)
        // = 20 - (20 * 10 / 100) = 20 - 2 = 18
        assertEquals(block.receipts[0].result.expectOk(), "u18");
    },
});
