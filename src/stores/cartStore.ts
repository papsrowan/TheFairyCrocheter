"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE — Caisse / Panier POS
// État de la vente en cours (produits, client, calculs)
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";

export interface CartItem {
  produitId: string;
  nom: string;
  codeBarres?: string;
  quantite: number;
  prixBase: number;          // prixVente — jamais modifié
  prixGros?: number | null;  // prix de gros du produit
  qtePrixGros?: number | null; // seuil déclencheur
  prixUnitaire: number;      // prix effectif (prixBase OU prixGros selon qté)
  remise: number;
  tauxTVA: number;
  total: number;
}

interface CartStore {
  items: CartItem[];
  clientId?: string;
  clientNom?: string;
  remiseGlobale: number;    // % de remise globale sur la vente
  modePaiement: "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE";
  notes: string;

  // Computed
  sousTotal: () => number;
  montantTVA: () => number;
  total: () => number;

  // Actions
  addItem: (item: Omit<CartItem, "total">) => void;
  updateQuantite: (produitId: string, quantite: number) => void;
  updateRemise: (produitId: string, remise: number) => void;
  removeItem: (produitId: string) => void;
  setClient: (clientId: string, clientNom: string) => void;
  clearClient: () => void;
  setRemiseGlobale: (remise: number) => void;
  setModePaiement: (mode: CartStore["modePaiement"]) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

/**
 * Calcul mixte : groupes complets au prix de gros, reste au prix normal.
 * Ex: 45 u., seuil=20, gros=700, base=1000
 *   → floor(45/20)=2 groupes × 20 × 700 = 28 000
 *   → 45 % 20 = 5 reste   × 1 000     =  5 000
 *   → total = 33 000 XAF
 */
function calculateItemTotal(
  prixBase: number,
  quantite: number,
  remise: number,
  prixGros?: number | null,
  qtePrixGros?: number | null
): number {
  let brut: number;
  if (prixGros && qtePrixGros && quantite >= qtePrixGros) {
    const groupes = Math.floor(quantite / qtePrixGros);
    const reste   = quantite % qtePrixGros;
    brut = groupes * qtePrixGros * prixGros + reste * prixBase;
  } else {
    brut = prixBase * quantite;
  }
  return Math.round(brut * (1 - remise / 100) * 100) / 100;
}

/** Prix unitaire effectif moyen (pour affichage et stockage DB) */
function effectiveUnitPrice(
  prixBase: number,
  quantite: number,
  prixGros?: number | null,
  qtePrixGros?: number | null
): number {
  if (!prixGros || !qtePrixGros || quantite < qtePrixGros) return prixBase;
  const total = calculateItemTotal(prixBase, quantite, 0, prixGros, qtePrixGros);
  return Math.round((total / quantite) * 100) / 100;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  clientId: undefined,
  clientNom: undefined,
  remiseGlobale: 0,
  modePaiement: "ESPECES",
  notes: "",

  sousTotal: () => {
    const { items, remiseGlobale } = get();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    return Math.round(subtotal * (1 - remiseGlobale / 100) * 100) / 100;
  },

  montantTVA: () => {
    const { items, remiseGlobale } = get();
    return items.reduce((sum, item) => {
      const totalHT = (item.total / (1 + item.tauxTVA / 100)) * (1 - remiseGlobale / 100);
      return sum + Math.round(totalHT * (item.tauxTVA / 100) * 100) / 100;
    }, 0);
  },

  total: () => {
    const { sousTotal } = get();
    return sousTotal();
  },

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.produitId === item.produitId);
      if (existing) {
        const newQty  = existing.quantite + item.quantite;
        const newPrix = effectiveUnitPrice(existing.prixBase, newQty, existing.prixGros, existing.qtePrixGros);
        const newTotal = calculateItemTotal(existing.prixBase, newQty, existing.remise, existing.prixGros, existing.qtePrixGros);
        return {
          items: state.items.map((i) =>
            i.produitId === item.produitId
              ? { ...i, quantite: newQty, prixUnitaire: newPrix, total: newTotal }
              : i
          ),
        };
      }
      const prixUnitaire = effectiveUnitPrice(item.prixBase, item.quantite, item.prixGros, item.qtePrixGros);
      const total = calculateItemTotal(item.prixBase, item.quantite, item.remise, item.prixGros, item.qtePrixGros);
      return { items: [...state.items, { ...item, prixUnitaire, total }] };
    });
  },

  updateQuantite: (produitId, quantite) => {
    if (quantite <= 0) { get().removeItem(produitId); return; }
    set((state) => ({
      items: state.items.map((i) => {
        if (i.produitId !== produitId) return i;
        const newPrix  = effectiveUnitPrice(i.prixBase, quantite, i.prixGros, i.qtePrixGros);
        const newTotal = calculateItemTotal(i.prixBase, quantite, i.remise, i.prixGros, i.qtePrixGros);
        return { ...i, quantite, prixUnitaire: newPrix, total: newTotal };
      }),
    }));
  },

  updateRemise: (produitId, remise) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.produitId === produitId
          ? { ...i, remise, total: calculateItemTotal(i.prixBase, i.quantite, remise, i.prixGros, i.qtePrixGros) }
          : i
      ),
    }));
  },

  removeItem: (produitId) => {
    set((state) => ({
      items: state.items.filter((i) => i.produitId !== produitId),
    }));
  },

  setClient: (clientId, clientNom) => set({ clientId, clientNom }),
  clearClient: () => set({ clientId: undefined, clientNom: undefined }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: remise }),
  setModePaiement: (mode) => set({ modePaiement: mode }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      clientId: undefined,
      clientNom: undefined,
      remiseGlobale: 0,
      modePaiement: "ESPECES",
      notes: "",
    }),
}));
