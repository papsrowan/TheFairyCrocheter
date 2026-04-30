"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT SEARCH — Recherche instantanée + scan code-barres pour la caisse
// Supporte le mode offline via cache IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback, useMemo, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cartStore";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Search, Barcode, Package, AlertTriangle, Loader2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineDB } from "@/lib/offline/db";

interface SearchResult {
  id: string;
  nom: string;
  codeBarres?: string;
  prixVente: number;
  prixGros?: number | null;
  qtePrixGros?: number | null;
  tauxTVA: number;
  stockActuel: number;
  stockMinimum: number;
  imageUrl?: string;
  categorie?: { nom: string };
}

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pendingAddRef = useRef(false); // true quand Enter pressé mais résultats pas encore arrivés
  const [, startTransition] = useTransition();
  const { isOffline } = useOnlineStatus();
  const addItem = useCartStore((s) => s.addItem);

  // Recherche online via API ou offline via IndexedDB
  const { data, isFetching } = useQuery({
    queryKey: ["produits", "search", query, isOffline],
    queryFn: async () => {
      if (!query || query.length < 1) return { data: [] };

      // Mode offline : recherche dans IndexedDB
      if (isOffline) {
        const db = getOfflineDB();
        if (!db) return { data: [] };
        const q = query.toLowerCase();
        const cached = await db.produits
          .filter(
            (p) =>
              p.actif &&
              (p.nom.toLowerCase().includes(q) ||
                (p.codeBarres ?? "").includes(q))
          )
          .limit(8)
          .toArray();
        return {
          data: cached.map((p) => ({
            id: p.id,
            nom: p.nom,
            codeBarres: p.codeBarres,
            prixVente: p.prixVente,
            tauxTVA: p.tauxTVA,
            stockActuel: p.stockActuel,
            stockMinimum: p.stockMinimum,
            categorie: p.categorie ? { nom: p.categorie } : undefined,
          })) as SearchResult[],
        };
      }

      const res = await fetch(
        `/api/produits/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (!res.ok) throw new Error("Erreur de recherche");
      return res.json() as Promise<{ data: SearchResult[] }>;
    },
    enabled: query.length >= 1,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });

  const results = useMemo(() => data?.data ?? [], [data]);

  // Fermer le dropdown en cliquant en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Afficher le dropdown + gérer l'ajout différé (scan douchette)
  useEffect(() => {
    setIsOpen(query.length >= 1 && results.length > 0);
    if (pendingAddRef.current && results.length > 0) {
      pendingAddRef.current = false;
      startTransition(() => selectProduct(results[0]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, query]);

  // Focus automatique sur le champ au montage (caisse = focus permanent)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectProduct = useCallback(
    (produit: SearchResult) => {
      addItem({
        produitId: produit.id,
        nom: produit.nom,
        codeBarres: produit.codeBarres,
        quantite: 1,
        prixBase: produit.prixVente,
        prixGros: produit.prixGros,
        qtePrixGros: produit.qtePrixGros,
        prixUnitaire: produit.prixVente, // sera recalculé par resolvePrice dans le store
        remise: 0,
        tauxTVA: produit.tauxTVA,
      });
      setQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [addItem]
  );

  // Entrée = ajouter immédiatement si résultats dispo, sinon marquer "pending" (scan douchette)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (results.length > 0) {
          selectProduct(results[0]);
        } else if (query.length >= 1) {
          // Douchette rapide : résultats pas encore arrivés → on attend
          pendingAddRef.current = true;
        }
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        pendingAddRef.current = false;
      }
    },
    [results, selectProduct, query]
  );

  return (
    <div className="relative w-full">
      {/* Champ de recherche */}
      <div className="relative">
        {isFetching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
        ) : query.length > 0 && /^\d{4,}$/.test(query) ? (
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}

        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={query}
          onChange={(e) => { pendingAddRef.current = false; setQuery(e.target.value); }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={isOffline ? "Mode hors ligne — recherche limitée" : "Scanner un code-barres ou taper le nom..."}
          className={cn(
            "pos-input w-full pl-11 pr-4 text-base",
            isOffline && "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10"
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {isOffline && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-yellow-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Hors ligne</span>
          </div>
        )}
      </div>

      {/* Dropdown résultats */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 rounded-lg border bg-card shadow-xl overflow-hidden"
        >
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {results.map((produit, index) => (
              <li key={produit.id}>
                <button
                  type="button"
                  onClick={() => selectProduct(produit)}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 text-left",
                    "hover:bg-accent transition-colors",
                    index === 0 && "bg-accent/50" // Premier résultat mis en avant
                  )}
                >
                  {/* Icône produit */}
                  <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                    {produit.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={produit.imageUrl}
                        alt={produit.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Infos produit */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{produit.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {produit.categorie?.nom && (
                        <span className="mr-2">{produit.categorie.nom}</span>
                      )}
                      {produit.codeBarres && (
                        <span className="font-mono">{produit.codeBarres}</span>
                      )}
                    </p>
                  </div>

                  {/* Prix + stock */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">
                      {formatCurrency(produit.prixVente)}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        produit.stockActuel <= produit.stockMinimum
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      Stock : {produit.stockActuel}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-4 py-2 bg-muted/50 border-t">
            <p className="text-xs text-muted-foreground">
              ↵ Entrée pour ajouter le premier résultat · Échap pour fermer
            </p>
          </div>
        </div>
      )}

      {/* Aucun résultat */}
      {isOpen && query.length >= 2 && results.length === 0 && !isFetching && (
        <div className="absolute z-50 w-full mt-2 rounded-lg border bg-card shadow-xl p-6 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun produit trouvé pour &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
