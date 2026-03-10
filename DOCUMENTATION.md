# GroupERP — Full Application Analysis & UML Documentation

## 1. Overview & Tech Stack

**GroupERP** is a single-page application (SPA) for an Algerian concrete electric pole manufacturing company ("Groupement des Poteaux Béton"). It manages the full **procurement-to-payment** and **order-to-cash** cycle with a **lot-based pricing system**.

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla JavaScript (ES modules), Vite bundler |
| Backend/DB | Firebase Firestore (NoSQL, serverless) |
| Routing | Custom hash-based SPA router (`#/path`) |
| Styling | Custom CSS (`main.css`), Inter font |
| Currency | Algerian Dinar (DT), French locale |

---

## 2. Class Diagram (Data Model / Entities)

Each "class" is a Firestore collection. Fields shown are the document properties.

```
┌──────────────────────────┐     ┌─────────────────────────┐
│       settings           │     │       counters           │
├──────────────────────────┤     ├─────────────────────────┤
│ companyName              │     │ id (PREFIX-MM-YY)       │
│ companyAddress           │     │ seq: number             │
│ companyPhone/Email       │     │ date: string            │
│ companyRC/NIF/AI/NIS     │     └─────────────────────────┘
│ taxRate: number          │
│ *Prefix / *Seq (x8)     │
└──────────────────────────┘

┌───────────────────┐         ┌───────────────────────────┐
│    categories     │         │          lots              │
├───────────────────┤         ├───────────────────────────┤
│ id                │◄────┐   │ id                        │
│ nom               │     │   │ numero                    │
│ prefix            │     │   │ date                      │
│ description       │     │   │ maxProduits               │
└───────────────────┘     │   │ prixParCategorie[]: {     │
                          │   │   categorieId, categorieNom│
                          │   │   prixAchat, prixVente    │
                          │   │ }                         │
                          │   │ note                      │
                          │   └────────────┬──────────────┘
                          │                │
┌─────────────────────────┤   ┌────────────┘
│       produits          │   │
├─────────────────────────┤   │  ┌───────────────────────┐
│ id                      │   │  │    fournisseurs        │
│ reference (manual ID)   │   │  ├───────────────────────┤
│ designation             │   │  │ id                    │
│ categorieId ────────────┘   │  │ raisonSociale         │
│ categorieNom                │  │ telephone             │
│ lotId ──────────────────────┘  │ matriculeFiscale      │
│ lotNumero                      │ rib / adresse         │
│ fournisseurId ─────────────────┘
│ fournisseurNom
│ prixAchat / prixVente  (from lot)
│ unite / stock / numero
└──────────┬─────────────┘

           │ (referenced in document lines)
           ▼
┌──────────────────────────────────────────────────┐
│  DOCUMENT COLLECTIONS (5 active)                 │
│  ─────────────────────────────────────────       │
│  Achat side:                Vente side:          │
│   • bl_achat (+ lotId)       • bc_vente          │
│   • factures_achat           • bl_vente          │
│                              • factures_vente    │
├──────────────────────────────────────────────────┤
│ Common fields per document:                      │
│   id, numero, date, statut/regle                 │
│   fournisseurId/clientId + Nom                   │
│   lignes[]: {                                    │
│     categorieId, categorieNom,                   │
│     produitId, produitRef, designation,           │
│     lotId, lotNumero,                            │
│     quantite (always 1), prixUnitaire, montant   │
│   }                                              │
│   taxRate, totalHT, totalTVA, totalTTC, note     │
│   (factures: blRefs[], regle: boolean)           │
│   (bl_vente: bcRef traceability)                 │
└──────────────────────────────────────────────────┘

┌────────────────────┐     ┌─────────────────────┐
│   clients          │     │   stock_mouvements   │
├────────────────────┤     ├─────────────────────┤
│ id                 │     │ produitId            │
│ raisonSociale      │     │ quantite             │
│ telephone          │     │ type (entree/sortie) │
│ matriculeFiscale   │     │ reference            │
│ rib                │     │ date                 │
│ adresse            │     └─────────────────────┘
│ description        │
└────────────────────┘     ┌─────────────────────┐
                           │      caisse          │
┌────────────────────┐     ├─────────────────────┤
│    reglements      │     │ montant              │
├────────────────────┤     │ type (entree/sortie) │
│ id                 │     │ description          │
│ factureId          │     │ reference            │
│ montant            │     │ date                 │
│ date               │     └─────────────────────┘
│ modePaiement       │
│ reference          │
│ typeFacture        │
│ factureNumero      │
│ tiersNom / tiersId │
│ note               │
└────────────────────┘
```

---

## 3. Data Relationships (How Data is Linked)

```
categories  ──1:N──►  lots.prixParCategorie[]  (prices per category per lot)
lots        ──1:N──►  produits                 (products belong to a lot)
categories  ──1:N──►  produits
fournisseurs──1:N──►  produits
fournisseurs──1:N──►  bl_achat / factures_achat
clients     ──1:N──►  bc_vente / bl_vente / factures_vente

ACHAT FLOW (simplified):
bl_achat (select lot → pick products) ──validate──► stock entree
bl_achat     ──selected──►  factures_achat  (cherry-picks lines from BLs, stores blRefs[])

VENTE FLOW:
bc_vente (only products with validated BL Achat) ──converts──► bl_vente
bl_vente     ──validate──► stock sortie
bl_vente     ──selected──►  factures_vente

factures_*   ──1:N──►  reglements  (via factureId)
reglements   ──auto──►  caisse      (creates entry/exit movement)
```

**Key constraints**:
- Each `produit` can only be used **once** across achat AND vente documents
- In **Vente**, only products with a **validated BL Achat** (Réceptionné) can be selected
- Each **Lot** defines per-category prices (achat + vente) and a **max product limit**
- Products inherit their prices from the lot they belong to

---

## 4. Use Case Diagram

```
                        ┌──────────────────────────────────────┐
                        │           GroupERP System             │
                        │                                      │
  ┌──────┐              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Categories (CRUD)       │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Lots (prices/limits)    │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Products (in lots)      │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Suppliers (CRUD + View) │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Clients (CRUD)          │  │
  │ User │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Purchase: BL Achat → Facture   │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Sales: BC → BL → Facture       │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ View/Manage Stock              │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Caisse (Cash Journal)   │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Règlements (Payments)   │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ View Dashboard (KPIs)          │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Configure Settings             │  │
  └──────┘              │  └────────────────────────────────┘  │
                        └──────────────────────────────────────┘
```

### Use Cases in Detail

| Use Case | Description |
|----------|-------------|
| **Manage Categories** | Create/Edit/Delete pole categories (e.g., PB9, PB12) |
| **Manage Lots** | Create lots with per-category prices (achat + vente) and max product limits |
| **Manage Products** | Create poles with manual ID, must select a lot (prices auto-filled from lot), link to category + supplier |
| **Manage Suppliers** | CRUD + account view (BL, factures, payments, balance) |
| **Manage Clients** | CRUD with fiscal info |
| **Purchase Cycle** | BL Achat (select lot → pick products) → validate (stock IN) → Facture Achat from BLs |
| **Sales Cycle** | BC Vente (only received products) → convert to BL Vente → validate (stock OUT) → Facture Vente from BLs |
| **Stock** | View stock per category and per product (entries vs exits) |
| **Caisse** | Manual cash journal entries + automatic entries from payments |
| **Règlements** | Pay invoices (partial/full), auto-mark as paid, auto-feed caisse |
| **Dashboard** | KPIs (total stock, sales, purchases, payments, recent documents) |
| **Settings** | Company info, tax rate, document prefixes & sequences |

---

## 5. Sequence Diagrams

### 5.1 Purchase Workflow (Achat) — Simplified with Lots

```
User              UI/Pages           store.js          Firestore
 │                   │                  │                  │
 │──Create BL Achat─►│                  │                  │
 │  (select lot)     │──getUsedProductIds()─────────────────►│
 │  (pick products)  │  (filter by lot, exclude used)        │
 │                   │──getNextNumber()─►│──get/set counter─►│
 │                   │──add('bl_achat', {lotId,lignes})────►│
 │◄──Toast "BL créé"─│                  │                  │
 │                   │                  │                  │
 │──Validate BL─────►│                  │                  │
 │                   │──FOR EACH ligne:  │                  │
 │                   │  updateStock(produitId, 1, 'entree')─►│
 │                   │    ├─add('stock_mouvements')──────────►│
 │                   │    └─update('produits', {stock +1})───►│
 │                   │──update('bl_achat', {statut:'Réceptionné'})►│
 │◄──Toast "Réceptionné"│               │                  │
 │                   │                  │                  │
 │──Create Facture──►│                  │                  │
 │                   │──Select BLs (Réceptionné)            │
 │                   │──Filter out already-invoiced produits │
 │                   │──User picks lines + prices           │
 │                   │──add('factures_achat', {blRefs})────►│
 │◄──Toast "Facture créée"│             │                  │
```

### 5.2 Sales Workflow (Vente) — Only Received Products

```
User              UI/Pages           store.js          Firestore
 │                   │                  │                  │
 │──Create BC Vente─►│──getReceivedProductIds()──────────────►│
 │                   │──getVenteUsedProductIds()──────────────►│
 │  (only received   │  (available = received − venteUsed)    │
 │   & unused prods) │                  │                  │
 │  (pick products)  │──add('bc_vente', {clientId,lignes})──►│
 │◄──Toast "BC créé"─│                  │                  │
 │                   │                  │                  │
 │──Convert BC→BL V─►│──add('bl_vente') + update bc statut──►│
 │──Validate BL V───►│──FOR EACH ligne: updateStock(sortie)──►│
 │──Create Facture V►│──add('factures_vente', {blRefs})──────►│
```

### 5.3 Payment (Règlement) Workflow

```
User              Reglements Page     store.js          Firestore
 │                   │                  │                  │
 │──New Payment─────►│                  │                  │
 │                   │──Show unpaid invoices (achat+vente)  │
 │──Select invoice──►│                  │                  │
 │──Enter amount────►│                  │                  │
 │──Save────────────►│                  │                  │
 │                   │──add('reglements', {factureId,montant})──►│
 │                   │──addCaisseMovement(...)──────────────────►│
 │                   │  (Vente=entree, Achat=sortie)            │
 │                   │──IF fully paid:                          │
 │                   │  update(facture, {regle: true})──────────►│
 │◄──Toast "Enregistré"│                │                  │
```

---

## 6. Activity Diagram (Overall Business Flow)

```
                    ┌─────────────────┐
                    │   Setup Phase   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────────┐    ┌──────────┐
   │ Create   │      │   Create     │    │ Create   │
   │Categories│      │  Suppliers   │    │ Clients  │
   └────┬─────┘      └──────┬───────┘    └────┬─────┘
        │                   │                 │
        ▼                   │                 │
 ┌──────────────┐           │                 │
 │ Create Lots  │           │                 │
 │(prices/limit)│           │                 │
 └──────┬───────┘           │                 │
        │                   │                 │
        ▼                   │                 │
 ┌──────────────┐           │                 │
 │Create Products│◄─────────┘                 │
 │(in lot+cat+  │                             │
 │ fournisseur) │                             │
 └──────┬───────┘                             │
        │                                     │
  ┌─────┴──────────────┐                      │
  ▼                    ▼                      │
┌────────────┐  ┌──────────────┐              │
│ ACHAT      │  │ VENTE        │              │
├────────────┤  ├──────────────┤              │
│1.BL Achat  │  │1.BC Vente    │◄─────────────┘
│  (lot+prods│  │ (received    │
│   select)  │  │  prods only) │
│  ↓ validate│  │  ↓ convert   │
│ [Stock +1] │  │2.BL Vente    │
│  ↓         │  │  ↓ validate  │
│2.Facture   │  │ [Stock -1]   │
│  Achat     │  │  ↓           │
│            │  │3.Facture     │
│            │  │  Vente       │
└─────┬──────┘  └──────┬───────┘
      │                │
      └────────┬───────┘
               ▼
        ┌──────────────┐
        │  Règlements  │
        │  (Payments)  │
        └──────┬───────┘
               │ auto
               ▼
        ┌──────────────┐
        │    Caisse    │
        │ (Cash Book)  │
        └──────────────┘
```

---

## 7. Key Business Rules

| Rule | Description |
|------|-------------|
| **Global product uniqueness** | A pole (produit) can only be used **once** across both achat AND vente documents. `getUsedProductIds()` scans all active collections. |
| **Lot-based pricing** | Each lot defines per-category prices (achat + vente). Products inherit prices from their lot. |
| **Lot product limit** | Each lot has a `maxProduits` limit. Cannot create more products than the limit, and BL Achat enforces this limit. |
| **Vente requires BL Achat** | In Vente (BC Vente), only products that have a **validated BL Achat** (Réceptionné) can be selected. |
| **Quantity is always 1** | Each pole is an individual unit (qty=1 per line). This is a pole-tracking system, not a bulk-goods system. |
| **Document chain traceability** | BL Vente stores `bcRef`, Factures store `blRefs[]`. BL Achat stores `lotId`. |
| **Stock is event-driven** | Stock is only updated when a BL is **validated** (Réceptionné for achat / Livré for vente). |
| **Cascading delete** | Deleting a facture also deletes all associated règlements. |
| **Auto-numbering** | Documents use prefix + month-year + sequential counter (e.g., `BLA-03-26-001`). |
| **Payment → Caisse auto-link** | Every règlement automatically creates a caisse movement (entree for vente payments, sortie for achat payments). |
| **Full payment detection** | When sum of règlements >= totalTTC, the facture is auto-marked as `regle: true`. |

---

## 8. Firestore Collections Summary

| Collection | Purpose | Key Foreign Keys |
|---|---|---|
| `settings` | Company config, tax, prefixes | — |
| `counters` | Auto-numbering sequences | — |
| `categories` | Pole categories | — |
| `lots` | Lot definitions with per-category pricing | `prixParCategorie[].categorieId` |
| `produits` | Individual poles | `categorieId`, `fournisseurId`, `lotId` |
| `fournisseurs` | Suppliers | — |
| `clients` | Customers | — |
| `bl_achat` | Purchase delivery notes | `fournisseurId`, `lotId`, `lignes[].produitId` |
| `factures_achat` | Purchase invoices | `fournisseurId`, `blRefs[]` |
| `bc_vente` | Sales orders | `clientId`, `lignes[].produitId` |
| `bl_vente` | Sales delivery notes | `clientId`, `bcRef` |
| `factures_vente` | Sales invoices | `clientId`, `blRefs[]` |
| `stock_mouvements` | Stock movement log | `produitId` |
| `caisse` | Cash journal | — |
| `reglements` | Payments | `factureId` |

---

## 9. Architecture Summary

```
index.html (shell: sidebar + main + modal + toast)
  └── src/main.js (entry: builds sidebar, registers 14 routes, inits router)
        ├── src/router.js          (hash-based SPA router)
        ├── src/data/firebase.js   (Firebase init)
        ├── src/data/store.js      (generic CRUD, settings, stock, caisse, lot helpers)
        ├── src/utils/helpers.js   (formatters, modals, toasts, currency-to-words)
        ├── src/utils/pagination.js(filtering, search, pagination)
        └── src/pages/*.js         (14 active page modules)
```

The application follows a **page-module pattern** where each page exports a single `render*()` async function that owns its own state, fetches data from Firestore, renders HTML, and wires DOM events. There is **no global state management**—each page re-fetches data from Firestore on load.

---

## 10. File Structure

```
GroupERP/
├── src/
│   ├── data/
│   │   ├── firebase.js          # Firebase configuration
│   │   └── store.js             # Data access layer, CRUD, lot/stock/caisse helpers
│   ├── pages/
│   │   ├── dashboard.js         # Dashboard/KPIs
│   │   ├── categories.js        # Category management
│   │   ├── lots.js              # Lot management (per-category pricing + limits)
│   │   ├── produits.js          # Product/pole management (lot-linked)
│   │   ├── fournisseurs.js      # Supplier management
│   │   ├── clients.js           # Client management
│   │   ├── bl-achat.js          # Purchase delivery notes (lot-based)
│   │   ├── facture-achat.js     # Purchase invoices
│   │   ├── bc-vente.js          # Sales orders (received products only)
│   │   ├── bl-vente.js          # Sales delivery notes (from BC conversion)
│   │   ├── facture-vente.js     # Sales invoices
│   │   ├── stock.js             # Stock management
│   │   ├── caisse.js            # Cash journal
│   │   ├── reglements.js        # Payments
│   │   └── parametres.js        # Settings
│   ├── styles/
│   │   └── main.css             # Application styles
│   ├── utils/
│   │   ├── helpers.js           # Utility functions
│   │   └── pagination.js        # Pagination/filtering
│   ├── main.js                  # Entry point
│   └── router.js                # SPA router
├── index.html                   # Main HTML shell
├── package.json
└── DOCUMENTATION.md             # This file
```
