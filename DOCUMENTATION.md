# GroupERP — Full Application Analysis & UML Documentation

## 1. Overview & Tech Stack

**GroupERP** is a single-page application (SPA) for an Algerian concrete electric pole manufacturing company ("Groupement des Poteaux Béton"). It manages the full **procurement-to-payment** and **order-to-cash** cycle.

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

┌───────────────────┐         ┌───────────────────────┐
│    categories     │         │    fournisseurs        │
├───────────────────┤         ├───────────────────────┤
│ id                │         │ id                    │
│ nom               │◄─────┐  │ raisonSociale         │
│ prefix            │      │  │ telephone             │
│ description       │      │  │ matriculeFiscale      │
└───────────────────┘      │  │ rib                   │
                           │  │ adresse / description │
┌──────────────────────────┤  └──────────┬────────────┘
│       produits           │             │
├──────────────────────────┤             │
│ id                       │             │
│ reference (manual ID)    │             │
│ designation              │             │
│ categorieId ─────────────┘             │
│ categorieNom                           │
│ fournisseurId ─────────────────────────┘
│ fournisseurNom
│ prixAchat / prixVente
│ unite / stock / numero
└──────────┬───────────────┘

           │ (referenced in document lines)
           ▼
┌──────────────────────────────────────────────────┐
│  DOCUMENT COLLECTIONS (8 total)                  │
│  ─────────────────────────────────────────       │
│  Achat side:                Vente side:          │
│   • devis_achat              • devis_vente       │
│   • bc_achat                 • bc_vente          │
│   • bl_achat                 • bl_vente          │
│   • factures_achat           • factures_vente    │
├──────────────────────────────────────────────────┤
│ Common fields per document:                      │
│   id, numero, date, statut/regle                 │
│   fournisseurId/clientId + Nom                   │
│   lignes[]: {                                    │
│     categorieId, categorieNom,                   │
│     produitId, produitRef, designation,           │
│     quantite (always 1), prixUnitaire, montant   │
│   }                                              │
│   taxRate, totalHT, totalTVA, totalTTC, note     │
│   (factures also: blRefs[], regle: boolean)      │
│   (bc/bl: devisRef/bcRef traceability)           │
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
│ factureId ────────►│     │ reference            │
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
categories  ──1:N──►  produits  ──1:N──►  document.lignes[]
fournisseurs──1:N──►  produits
fournisseurs──1:N──►  devis_achat / bc_achat / bl_achat / factures_achat
clients     ──1:N──►  devis_vente / bc_vente / bl_vente / factures_vente

devis_achat  ──converts──►  bc_achat   (copies lignes, stores devisRef)
bc_achat     ──converts──►  bl_achat   (copies lignes, stores bcRef)
bl_achat     ──selected──►  factures_achat  (cherry-picks lines from BLs, stores blRefs[])

devis_vente  ──converts──►  bc_vente   (same pattern)
bc_vente     ──converts──►  bl_vente
bl_vente     ──selected──►  factures_vente

factures_*   ──1:N──►  reglements  (via factureId)
reglements   ──auto──►  caisse      (creates entry/exit movement)
bl_achat (validate)  ──auto──►  stock_mouvements + produits.stock (entree +1)
bl_vente  (validate) ──auto──►  stock_mouvements + produits.stock (sortie −1)
```

**Key constraint**: Each `produit` (pole) can only appear in **one document globally** across all 8 document collections. This is enforced by `getUsedProductIds()` which scans all collections.

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
  │      │──────────────┼─►│ Manage Products / Poles (CRUD) │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Suppliers (CRUD + View) │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Manage Clients (CRUD)          │  │
  │ User │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Purchase Cycle:                │  │
  │      │              │  │  Devis → BC → BL → Facture     │  │
  │      │              │  └────────────────────────────────┘  │
  │      │              │  ┌────────────────────────────────┐  │
  │      │──────────────┼─►│ Sales Cycle:                   │  │
  │      │              │  │  Devis → BC → BL → Facture     │  │
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
| **Manage Products** | Create poles with manual ID, link to category + supplier, set buy/sell prices; select poles to bulk-create a Devis Achat |
| **Manage Suppliers** | CRUD + account view (all devis, BC, BL, factures, payments, balance) |
| **Manage Clients** | CRUD with fiscal info |
| **Purchase Cycle** | Devis Achat → convert to BC Achat → convert to BL Achat → validate (stock IN) → create Facture Achat from BLs |
| **Sales Cycle** | Devis Vente → convert to BC Vente → convert to BL Vente → validate (stock OUT) → create Facture Vente from BLs |
| **Stock** | View stock per category and per product (entries vs exits) |
| **Caisse** | Manual cash journal entries + automatic entries from payments |
| **Règlements** | Pay invoices (partial/full), auto-mark as paid, auto-feed caisse |
| **Dashboard** | KPIs (total stock, sales, purchases, payments, recent documents) |
| **Settings** | Company info, tax rate, document prefixes & sequences |

---

## 5. Sequence Diagrams

### 5.1 Purchase Workflow (Achat)

```
User              UI/Pages           store.js          Firestore
 │                   │                  │                  │
 │──Create Devis────►│                  │                  │
 │                   │──getNextNumber()─►│──get/set counter─►│
 │                   │──add('devis_achat')────────────────►│
 │                   │◄─── docId ──────────────────────────│
 │◄──Toast "Créé"────│                  │                  │
 │                   │                  │                  │
 │──Convert to BC───►│                  │                  │
 │                   │──getNextNumber()─►│                  │
 │                   │──add('bc_achat', {lignes, devisRef})──►│
 │                   │──update('devis_achat', {statut:'Validé'})►│
 │◄──Toast "BC créé" │                  │                  │
 │                   │                  │                  │
 │──Convert BC→BL───►│                  │                  │
 │                   │──getNextNumber()─►│                  │
 │                   │──add('bl_achat', {lignes, bcRef})──────►│
 │                   │──update('bc_achat', {statut:'Livré'})──►│
 │◄──Toast "BL créé" │                  │                  │
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
 │                   │──getNextNumber()─►│                  │
 │                   │──add('factures_achat', {blRefs, lignes})►│
 │◄──Toast "Facture créée"│             │                  │
```

### 5.2 Sales Workflow (Vente)

```
User              UI/Pages           store.js          Firestore
 │                   │                  │                  │
 │──Create Devis V──►│──add('devis_vente', {clientId,lignes})──►│
 │──Convert to BC V─►│──add('bc_vente') + update devis statut──►│
 │──Convert BC→BL V─►│──add('bl_vente') + update bc statut─────►│
 │──Validate BL V───►│──FOR EACH ligne: updateStock(sortie)────►│
 │──Create Facture V►│──add('factures_vente', {blRefs})────────►│
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
                    │  (one-time)     │
                    └────────┬────────┘
                             │
                 ┌───────────┼───────────┐
                 ▼           ▼           ▼
          ┌──────────┐ ┌──────────┐ ┌──────────┐
          │ Create   │ │ Create   │ │ Create   │
          │Categories│ │Suppliers │ │ Clients  │
          └────┬─────┘ └────┬─────┘ └────┬─────┘
               │            │            │
               └─────┬──────┘            │
                     ▼                   │
              ┌──────────────┐           │
              │Create Products│           │
              │(link Cat+Four)│           │
              └──────┬───────┘           │
                     │                   │
         ┌───────────┴───────────┐       │
         ▼                       ▼       │
  ┌──────────────┐       ┌──────────────┐│
  │ PURCHASE     │       │ SALES        ││
  │ CYCLE        │       │ CYCLE        ││
  ├──────────────┤       ├──────────────┤│
  │1.Devis Achat │       │1.Devis Vente ││
  │   ↓ convert  │       │   ↓ convert  ││
  │2.BC Achat    │       │2.BC Vente    ││
  │   ↓ convert  │       │   ↓ convert  ││
  │3.BL Achat    │       │3.BL Vente    ││
  │   ↓ validate │       │   ↓ validate ││
  │  [Stock +1]  │       │  [Stock -1]  ││
  │   ↓          │       │   ↓          ││
  │4.Facture     │       │4.Facture     ││
  │   Achat      │       │   Vente      ││
  └──────┬───────┘       └──────┬───────┘│
         │                       │       │
         └───────────┬───────────┘       │
                     ▼                   │
              ┌──────────────┐           │
              │  Règlements  │◄──────────┘
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
| **Global product uniqueness** | A pole (produit) can only be used in **one** document across all 8 document types. `getUsedProductIds()` scans all collections to enforce this. |
| **Quantity is always 1** | Each pole is an individual unit (qty=1 per line). This is a pole-tracking system, not a bulk-goods system. |
| **Document chain traceability** | Each document stores a reference to its predecessor: BC stores `devisRef`, BL stores `bcRef`, Facture stores `blRefs[]` |
| **Stock is event-driven** | Stock is only updated when a BL is **validated** (Réceptionné for achat / Livré for vente). |
| **Cascading delete** | Deleting a facture also deletes all associated règlements. |
| **Auto-numbering** | Documents use prefix + month-year + sequential counter (e.g., `DA-03-26-001`). |
| **Payment → Caisse auto-link** | Every règlement automatically creates a caisse movement (entree for vente payments, sortie for achat payments). |
| **Full payment detection** | When sum of règlements >= totalTTC, the facture is auto-marked as `regle: true`. |

---

## 8. Firestore Collections Summary

| Collection | Purpose | Key Foreign Keys |
|---|---|---|
| `settings` | Company config, tax, prefixes | — |
| `counters` | Auto-numbering sequences | — |
| `categories` | Pole categories | — |
| `produits` | Individual poles | `categorieId`, `fournisseurId` |
| `fournisseurs` | Suppliers | — |
| `clients` | Customers | — |
| `devis_achat` | Purchase quotes | `fournisseurId`, `lignes[].produitId` |
| `bc_achat` | Purchase orders | `fournisseurId`, `devisRef` |
| `bl_achat` | Purchase delivery notes | `fournisseurId`, `bcRef` |
| `factures_achat` | Purchase invoices | `fournisseurId`, `blRefs[]` |
| `devis_vente` | Sales quotes | `clientId`, `lignes[].produitId` |
| `bc_vente` | Sales orders | `clientId`, `devisRef` |
| `bl_vente` | Sales delivery notes | `clientId`, `bcRef` |
| `factures_vente` | Sales invoices | `clientId`, `blRefs[]` |
| `stock_mouvements` | Stock movement log | `produitId` |
| `caisse` | Cash journal | — |
| `reglements` | Payments | `factureId` |

---

## 9. Architecture Summary

```
index.html (shell: sidebar + main + modal + toast)
  └── src/main.js (entry: builds sidebar, registers 17 routes, inits router)
        ├── src/router.js          (hash-based SPA router)
        ├── src/data/firebase.js   (Firebase init)
        ├── src/data/store.js      (generic CRUD, settings, stock, caisse, payment helpers)
        ├── src/utils/helpers.js   (formatters, modals, toasts, currency-to-words)
        ├── src/utils/pagination.js(filtering, search, pagination)
        └── src/pages/*.js         (17 page modules, each self-contained render function)
```

The application follows a **page-module pattern** where each page exports a single `render*()` async function that owns its own state, fetches data from Firestore, renders HTML, and wires DOM events. There is **no global state management**—each page re-fetches data from Firestore on load.

---

## 10. File Structure

```
c:\Users\DELL\Desktop\APPLICATIONS\GroupERP/
├── .git/
├── dist/
├── node_modules/
├── public/
├── src/
│   ├── data/
│   │   ├── firebase.js          # Firebase configuration
│   │   └── store.js             # Data access layer, CRUD, helpers
│   ├── pages/
│   │   ├── dashboard.js         # Dashboard/KPIs
│   │   ├── categories.js      # Category management
│   │   ├── produits.js          # Product/pole management
│   │   ├── fournisseurs.js      # Supplier management
│   │   ├── clients.js           # Client management
│   │   ├── devis-achat.js       # Purchase quotes
│   │   ├── bc-achat.js          # Purchase orders
│   │   ├── bl-achat.js          # Purchase delivery notes
│   │   ├── facture-achat.js     # Purchase invoices
│   │   ├── devis-vente.js       # Sales quotes
│   │   ├── bc-vente.js          # Sales orders
│   │   ├── bl-vente.js          # Sales delivery notes
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
└── README.md
```
