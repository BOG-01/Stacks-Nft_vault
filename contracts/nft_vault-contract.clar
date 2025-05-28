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

