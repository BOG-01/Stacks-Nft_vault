;; Mock NFT contract for testing the vault
;; Implements the nft-trait required by the vault contract

(define-non-fungible-token test-nft uint)

;; Error constants
(define-constant err-not-token-owner (err u101))
(define-constant err-not-authorized (err u102))

;; Keep track of who owns which tokens
(define-map token-count principal uint)

;; Initialize some tokens for testing
(define-public (mint (recipient principal) (token-id uint))
  (begin
    (try! (nft-mint? test-nft token-id recipient))
    (ok true)))

;; Implement the transfer function required by nft-trait
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-authorized)
    (try! (nft-transfer? test-nft token-id sender recipient))
    (ok true)))

;; Get owner of a token
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? test-nft token-id)))

;; Get last token ID
(define-read-only (get-last-token-id)
  (ok u0))
