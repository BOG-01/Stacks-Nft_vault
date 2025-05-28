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

;; Track investment yields for NFTs
(define-map nft-yields
  { token-contract: principal, token-id: uint }
  { yield-rate: uint, last-claimed: uint, total-earned: uint })

;; Global yield statistics
(define-data-var total-yield-generated uint u0)
(define-data-var vault-fee-percentage uint u5) ;; 5% fee by default

;; Track authorized operators who can manage NFTs on behalf of owners
(define-map authorized-operators
  { owner: principal, operator: principal }
  { authorized: bool, expires-at: (optional uint) })

;; private functions
;;
(define-private (is-owner)
  (is-eq tx-sender contract-owner))

(define-private (current-time)
  block-height)

(define-private (transfer-nft (token-contract <nft-trait>) (token-id uint) (sender principal) (recipient principal))
  (contract-call? token-contract transfer token-id sender recipient))

(define-private (calculate-yield (token-contract principal) (token-id uint))
  (let ((yield-data (default-to { yield-rate: u0, last-claimed: u0, total-earned: u0 }
                    (map-get? nft-yields { token-contract: token-contract, token-id: token-id })))
        (time-elapsed (- (current-time) (get last-claimed yield-data)))
        (rate (get yield-rate yield-data)))
    (if (> rate u0)
      (* time-elapsed rate)
      u0)))

(define-private (is-authorized (owner principal) (operator principal))
  (let ((auth-data (default-to { authorized: false, expires-at: none } 
                    (map-get? authorized-operators { owner: owner, operator: operator }))))
    (and 
      (get authorized auth-data)
      (match (get expires-at auth-data)
        expires (< (current-time) expires)
        true))))

(define-private (can-manage-nft (owner principal))
  (or (is-eq tx-sender owner) 
      (is-authorized owner tx-sender)))

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
        error (err error))))

;; Set yield rate for an NFT
(define-public (set-yield-rate (token-contract principal) (token-id uint) (new-rate uint))
  (begin
    (asserts! (is-owner) err-owner-only)
    (asserts! (> new-rate u0) err-invalid-yield)
    
    (let ((yield-key { token-contract: token-contract, token-id: token-id })
          (yield-data (default-to { yield-rate: u0, last-claimed: (current-time), total-earned: u0 }
                      (map-get? nft-yields yield-key))))
      
      (map-set nft-yields yield-key
        (merge yield-data { yield-rate: new-rate }))
      
      (ok true))))

;; Claim yield for an NFT
(define-public (claim-yield (token-contract principal) (token-id uint))
  (let ((entry-key { owner: tx-sender, token-contract: token-contract, token-id: token-id })
        (yield-key { token-contract: token-contract, token-id: token-id }))
    
    (asserts! (is-some (map-get? vault-entries entry-key)) err-not-deposited)
    
    (let ((yield-data (default-to { yield-rate: u0, last-claimed: u0, total-earned: u0 }
                      (map-get? nft-yields yield-key)))
          (yield-amount (calculate-yield token-contract token-id))
          (fee-amount (/ (* yield-amount (var-get vault-fee-percentage)) u100))
          (net-amount (- yield-amount fee-amount)))
      
      (asserts! (> yield-amount u0) err-insufficient-funds)
      
      ;; Update yield data
      (map-set nft-yields yield-key
        { yield-rate: (get yield-rate yield-data),
          last-claimed: (current-time),
          total-earned: (+ (get total-earned yield-data) yield-amount) })
      
      ;; Update global stats
      (var-set total-yield-generated (+ (var-get total-yield-generated) yield-amount))
      
      (ok net-amount))))

;; Set vault fee percentage (owner only)
(define-public (set-fee-percentage (new-fee uint))
  (begin
    (asserts! (is-owner) err-owner-only)
    (asserts! (<= new-fee u100) (err u109))
    (var-set vault-fee-percentage new-fee)
    (ok true)))

;; Authorize an operator to manage NFTs on behalf of the owner
(define-public (authorize-operator (operator principal) (expires-at (optional uint)))
  (begin
    (map-set authorized-operators
      { owner: tx-sender, operator: operator }
      { authorized: true, expires-at: expires-at })
    (ok true)))

;; Revoke operator authorization
(define-public (revoke-operator (operator principal))
  (begin
    (map-delete authorized-operators { owner: tx-sender, operator: operator })
    (ok true)))

;; Get vault statistics
(define-read-only (get-vault-stats)
  { total-nfts: (var-get total-nfts-deposited),
    total-yield: (var-get total-yield-generated),
    fee-percentage: (var-get vault-fee-percentage) })

;; Check if an NFT is in the vault
(define-read-only (is-in-vault (owner principal) (token-contract principal) (token-id uint))
  (is-some (map-get? vault-entries { owner: owner, token-contract: token-contract, token-id: token-id })))

;; Get NFT yield information
(define-read-only (get-nft-yield-info (token-contract principal) (token-id uint))
  (default-to 
    { yield-rate: u0, last-claimed: u0, total-earned: u0 }
    (map-get? nft-yields { token-contract: token-contract, token-id: token-id })))
