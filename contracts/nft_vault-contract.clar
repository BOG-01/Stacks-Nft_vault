;; nft_vault-contract
;; A secure vault for storing and managing NFTs with investment capabilities

;; Define the NFT trait that token contracts must implement
(define-trait nft-trait
  (
    ;; Transfer NFT from one principal to another
    (transfer (uint principal principal) (response bool uint))
  )
)

;; constants
;;
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-token-not-found (err u102))
(define-constant err-vault-locked (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-invalid-token (err u105))
(define-constant err-already-deposited (err u106))
(define-constant err-not-deposited (err u107))
(define-constant err-invalid-yield (err u108))

;; data maps and vars
;;
;; Track which NFTs are stored in the vault
(define-map vault-entries 
  { owner: principal, token-contract: principal, token-id: uint } 
  { deposited-at: uint, locked-until: (optional uint) })

;; Global vault statistics
(define-data-var total-nfts-deposited uint u0)

;; private functions
;;
(define-private (is-owner)
  (is-eq tx-sender contract-owner))

(define-private (current-time)
  block-height)

(define-private (transfer-nft (token-contract <nft-trait>) (token-id uint) (sender principal) (recipient principal))
  (contract-call? token-contract transfer token-id sender recipient))

;; public functions
;;
;; Deposit an NFT into the vault
(define-public (deposit-nft (token-contract <nft-trait>) (token-id uint) (lock-period (optional uint)))
  (let ((entry-key { owner: tx-sender, token-contract: (contract-of token-contract), token-id: token-id }))
    (asserts! (is-none (map-get? vault-entries entry-key)) err-already-deposited)
    
    ;; Transfer NFT to the vault
    (match (contract-call? token-contract transfer token-id tx-sender (as-contract tx-sender))
      success
        (begin
          (map-set vault-entries entry-key 
            { deposited-at: (current-time), locked-until: lock-period })
          
          ;; Update stats
          (var-set total-nfts-deposited (+ (var-get total-nfts-deposited) u1))
          
          (ok true))
      error (err error))))

;; Withdraw an NFT from the vault
(define-public (withdraw-nft (token-contract <nft-trait>) (token-id uint))
  (let ((entry-key { owner: tx-sender, token-contract: (contract-of token-contract), token-id: token-id })
        (entry (map-get? vault-entries entry-key)))
    
    (asserts! (is-some entry) err-not-deposited)
    (let ((entry-data (unwrap! entry err-token-not-found)))
      
      ;; Check if the NFT is locked
      (asserts! (match (get locked-until entry-data)
                  lock-height (>= (current-time) lock-height)
                  true) 
                err-vault-locked)
      
      ;; Transfer NFT back to owner
      (match (as-contract (contract-call? token-contract transfer token-id (as-contract tx-sender) tx-sender))
        success
          (begin
            (map-delete vault-entries entry-key)
            
            ;; Update stats
            (var-set total-nfts-deposited (- (var-get total-nfts-deposited) u1))
            
            (ok true))
        error (err error)))))
