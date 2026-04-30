"use client";

import { useState } from "react";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  Trash2, Plus, Minus, User, ShoppingCart,
  CheckCircle, Wifi, WifiOff, Loader2, Percent, CreditCard,
  Banknote, ArrowLeftRight, Eye, X, Receipt, FileText,
} from "lucide-react";

type ModePaiement = "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE";

const MODES_PAIEMENT: { value: ModePaiement; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ESPECES", label: "Espèces", icon: Banknote },
  { value: "CARTE", label: "Carte", icon: CreditCard },
  { value: "VIREMENT", label: "Virement", icon: ArrowLeftRight },
];

const MODES_LABELS: Record<ModePaiement, string> = {
  ESPECES: "Espèces", CARTE: "Carte bancaire",
  VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte",
};

function fmtXAF(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

// ── Aperçu avant validation ───────────────────────────────────────────────────
interface ApercuProps {
  items: CartItem[];
  clientNom: string | null | undefined;
  sousTotal: number;
  montantTVA: number;
  remiseGlobale: number;
  total: number;
  modePaiement: ModePaiement;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ApercuModal({
  items, clientNom, sousTotal, montantTVA,
  remiseGlobale, total, modePaiement,
  isPending, onConfirm, onCancel,
}: ApercuProps) {
  const [vue, setVue] = useState<"ticket" | "facture">("ticket");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="font-bold">Aperçu de la transaction</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sélecteur ticket / facture */}
        <div className="flex gap-1 p-3 border-b bg-muted/30 shrink-0">
          <button
            onClick={() => setVue("ticket")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-sm font-medium transition-all",
              vue === "ticket" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            Ticket de caisse
          </button>
          <button
            onClick={() => setVue("facture")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-sm font-medium transition-all",
              vue === "facture" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Facture
          </button>
        </div>

        {/* Contenu aperçu */}
        <div className="flex-1 overflow-y-auto p-4">
          {vue === "ticket" ? (
            // ── Style ticket thermique ────────────────────────────────────
            <div className="mx-auto max-w-xs font-mono text-xs border rounded-lg bg-white dark:bg-zinc-900 p-4 shadow-inner">
              <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                <p className="font-bold text-sm uppercase tracking-widest">The Fairy Crocheter</p>
                <p className="text-gray-400 text-[10px] mt-1">Ticket de caisse</p>
              </div>

              {clientNom && (
                <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 mb-2">
                  <span className="text-gray-400">Client</span>
                  <span className="font-semibold">{clientNom}</span>
                </div>
              )}

              <div className="space-y-2 border-b border-dashed border-gray-300 pb-3 mb-3">
                {items.map((item) => (
                  <div key={item.produitId}>
                    <p className="font-semibold truncate">{item.nom}</p>
                    <div className="flex justify-between text-gray-500">
                      <span>
                        {item.quantite} × {fmtXAF(item.prixUnitaire)}
                        {item.remise > 0 && <span className="text-emerald-600"> -{item.remise}%</span>}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">{fmtXAF(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {sousTotal !== total && (
                <div className="flex justify-between text-gray-400">
                  <span>Sous-total</span>
                  <span>{fmtXAF(sousTotal)}</span>
                </div>
              )}
              {remiseGlobale > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Remise {remiseGlobale}%</span>
                  <span>-{fmtXAF(sousTotal * remiseGlobale / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-1">
                <span>TOTAL</span>
                <span>{fmtXAF(total)}</span>
              </div>
              <div className="flex justify-between text-gray-400 mt-1">
                <span>Paiement</span>
                <span className="font-medium">{MODES_LABELS[modePaiement]}</span>
              </div>

              <p className="text-center text-gray-300 border-t border-dashed border-gray-200 mt-3 pt-3 text-[10px]">
                Merci de votre confiance !
              </p>
            </div>
          ) : (
            // ── Style facture ─────────────────────────────────────────────
            <div className="border rounded-lg bg-white dark:bg-zinc-900 p-5 shadow-inner text-sm">
              <div className="flex justify-between items-start border-b pb-4 mb-4">
                <div>
                  <p className="text-blue-700 font-bold text-lg">The Fairy Crocheter</p>
                  <p className="text-xs text-gray-400 mt-0.5">Boutique de crochet</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-700 font-bold text-xl">FACTURE</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>

              {clientNom && (
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 mb-4 text-xs">
                  <p className="text-gray-400 uppercase text-[10px] mb-1">Facturé à</p>
                  <p className="font-semibold">{clientNom}</p>
                </div>
              )}

              <div className="mb-4">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-bold bg-blue-700 text-white rounded px-2 py-1.5">
                  <span>Description</span>
                  <span className="text-center">Qté</span>
                  <span className="text-right">P.U.</span>
                  <span className="text-right">Total</span>
                </div>
                {items.map((item, i) => (
                  <div
                    key={item.produitId}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs px-2 py-1.5 border-b",
                      i % 2 === 1 && "bg-gray-50 dark:bg-zinc-800"
                    )}
                  >
                    <span className="truncate font-medium">{item.nom}</span>
                    <span className="text-center text-gray-500">{item.quantite}</span>
                    <span className="text-right text-gray-500">{fmtXAF(item.prixUnitaire)}</span>
                    <span className="text-right font-bold">{fmtXAF(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs space-y-1 text-right">
                <div className="flex justify-between text-gray-400">
                  <span>Sous-total HT</span>
                  <span>{fmtXAF(sousTotal - montantTVA)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>TVA</span>
                  <span>{fmtXAF(montantTVA)}</span>
                </div>
                {remiseGlobale > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Remise ({remiseGlobale}%)</span>
                    <span>-{fmtXAF(sousTotal * remiseGlobale / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-blue-700 pt-2 text-blue-700">
                  <span>TOTAL TTC</span>
                  <span>{fmtXAF(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t shrink-0">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 h-10 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Modifier
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Confirmer · {fmtXAF(total)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CartSummary ───────────────────────────────────────────────────────────────
interface CartSummaryProps {
  onVenteCreee?: (venteId: string, numero: string) => void;
  onAddItem?: () => void;
}

export function CartSummary({ onVenteCreee, onAddItem: _onAddItem }: CartSummaryProps) {
  const {
    items, clientId, clientNom, remiseGlobale, modePaiement,
    sousTotal, total, montantTVA,
    updateQuantite, updateRemise, removeItem,
    setRemiseGlobale, setModePaiement, clearClient, clearCart,
  } = useCartStore();

  const { addToQueue } = useOfflineStore();
  const { isFullyOnline } = useOnlineStatus();
  const queryClient = useQueryClient();

  const [editingRemise, setEditingRemise] = useState<string | null>(null);
  const [globalRemiseInput, setGlobalRemiseInput] = useState(String(remiseGlobale));
  const [showApercu, setShowApercu] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutate: creerVente, isPending } = useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch("/api/ventes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur serveur");
      }
      return res.json() as Promise<{ data: { id: string; numero: string } }>;
    },
    onSuccess: ({ data }) => {
      setSuccessMessage(`Vente ${data.numero} enregistrée !`);
      setShowApercu(false);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["ventes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onVenteCreee?.(data.id, data.numero);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: Error) => {
      setShowApercu(false);
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 6000);
    },
  });

  const buildPayload = () => ({
    clientId: clientId ?? null,
    lignes: items.map((item) => ({
      produitId: item.produitId,
      quantite: item.quantite,
      prixUnitaire: item.prixUnitaire,
      remise: item.remise,
      tauxTVA: item.tauxTVA,
    })),
    remiseGlobale,
    modePaiement,
  });

  const handleValider = () => {
    if (items.length === 0) return;
    setErrorMessage(null);

    if (!isFullyOnline) {
      addToQueue({ type: "vente", payload: buildPayload() });
      setSuccessMessage("Vente sauvegardée hors ligne — sera synchronisée dès reconnexion");
      clearCart();
      setTimeout(() => setSuccessMessage(null), 5000);
      return;
    }

    setShowApercu(true);
  };

  const handleConfirmerDepuisApercu = () => {
    creerVente(buildPayload());
  };

  if (items.length === 0 && !successMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8">
        <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground font-medium">Panier vide</p>
        <p className="text-sm text-muted-foreground mt-1">
          Recherchez ou scannez un produit pour commencer
        </p>
      </div>
    );
  }

  return (
    <>
      {showApercu && (
        <ApercuModal
          items={items}
          clientNom={clientNom}
          sousTotal={sousTotal()}
          montantTVA={montantTVA()}
          remiseGlobale={remiseGlobale}
          total={total()}
          modePaiement={modePaiement}
          isPending={isPending}
          onConfirm={handleConfirmerDepuisApercu}
          onCancel={() => setShowApercu(false)}
        />
      )}

      <div className="flex flex-col h-full">
        {successMessage && (
          <div className="flex items-start gap-3 m-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-300">
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-3 m-4 rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
            <span>{errorMessage}</span>
          </div>
        )}

        {clientNom && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <User className="h-4 w-4" />
              <span className="font-medium">{clientNom}</span>
            </div>
            <button
              onClick={clearClient}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              Retirer
            </button>
          </div>
        )}

        {/* Articles */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {items.map((item) => (
            <div key={item.produitId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.nom}</p>
                  {/* Détail calcul prix de gros */}
                  {item.prixGros && item.qtePrixGros && item.quantite >= item.qtePrixGros ? (() => {
                    const groupes = Math.floor(item.quantite / item.qtePrixGros);
                    const reste   = item.quantite % item.qtePrixGros;
                    return (
                      <div className="text-xs space-y-0.5 mt-0.5">
                        <span className="inline-block bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                          Prix gros actif
                        </span>
                        <p className="text-muted-foreground font-mono">
                          {groupes}×{item.qtePrixGros}×{formatCurrency(item.prixGros!)}
                          {reste > 0 && <> + {reste}×{formatCurrency(item.prixBase)}</>}
                        </p>
                        {item.tauxTVA > 0 && <p className="text-muted-foreground">TVA {item.tauxTVA}%</p>}
                      </div>
                    );
                  })() : (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.prixBase)} / unité
                      {item.prixGros && item.qtePrixGros && (
                        <span className="ml-1 text-amber-500">· gros dès {item.qtePrixGros} u. → {formatCurrency(item.prixGros)}</span>
                      )}
                      {item.tauxTVA > 0 && ` · TVA ${item.tauxTVA}%`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.produitId)}
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantite(item.produitId, item.quantite - 1)}
                    className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold tabular-nums">
                    {item.quantite}
                  </span>
                  <button
                    onClick={() => updateQuantite(item.produitId, item.quantite + 1)}
                    className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Percent className="h-3 w-3 text-muted-foreground" />
                  {editingRemise === item.produitId ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={item.remise}
                      autoFocus
                      className="w-14 h-6 rounded border text-xs text-center px-1"
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val <= 100) {
                          updateRemise(item.produitId, val);
                        }
                        setEditingRemise(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingRemise(null);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingRemise(item.produitId)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item.remise > 0 ? `${item.remise}%` : "Remise"}
                    </button>
                  )}
                </div>

                <p className="ml-auto font-bold text-sm">
                  {formatCurrency(item.total)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Totaux + validation */}
        <div className="border-t bg-card p-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" />
              Remise globale
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={globalRemiseInput}
                onChange={(e) => setGlobalRemiseInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(globalRemiseInput);
                  if (!isNaN(val) && val >= 0 && val <= 100) setRemiseGlobale(val);
                }}
                className="w-16 h-7 rounded border text-center text-xs px-1"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total HT</span>
              <span>{formatCurrency(sousTotal() - montantTVA())}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVA</span>
              <span>{formatCurrency(montantTVA())}</span>
            </div>
            {remiseGlobale > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Remise ({remiseGlobale}%)</span>
                <span>- {formatCurrency(sousTotal() * remiseGlobale / 100)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-1.5">
              <span>Total TTC</span>
              <span className="text-primary">{formatCurrency(total())}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MODES_PAIEMENT.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setModePaiement(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all",
                  modePaiement === value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isFullyOnline ? (
              <><Wifi className="h-3.5 w-3.5 text-green-500" /> Connecté</>
            ) : (
              <><WifiOff className="h-3.5 w-3.5 text-yellow-500" /> Hors ligne — sauvegarde locale</>
            )}
          </div>

          <button
            onClick={handleValider}
            disabled={items.length === 0 || isPending}
            className={cn(
              "w-full h-12 rounded-lg font-bold text-base transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {isPending ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enregistrement...</>
            ) : (
              <><Eye className="h-5 w-5" /> Aperçu & Valider · {formatCurrency(total())}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
