"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT ProduitDetailClient — Panneau latéral interactif (Client Component)
// Gère : modal ajustement stock + archivage produit
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import StockAjustementModal from "./StockAjustementModal";

interface ProduitDetailClientProps {
  produitId:    string;
  produitNom:   string;
  stockActuel:  number;
  stockMinimum: number;
  actif:        boolean;
  canStock:     boolean;
  canDelete:    boolean;
}

export default function ProduitDetailClient({
  produitId, produitNom, stockActuel, stockMinimum, actif, canStock, canDelete,
}: ProduitDetailClientProps) {
  const router = useRouter();
  const [showModal, setShowModal]       = useState(false);
  const [currentStock, setCurrentStock] = useState(stockActuel);
  const [archiving, setArchiving]       = useState(false);

  const enAlerte = currentStock < stockMinimum;

  function handleStockSuccess(nouveauStock: number) {
    setCurrentStock(nouveauStock);
    setShowModal(false);
    router.refresh(); // Recharge les mouvements depuis le serveur
  }

  async function handleArchiver() {
    if (!confirm(`Archiver le produit "${produitNom}" ? Il ne sera plus visible dans la caisse.`)) return;
    setArchiving(true);
    try {
      await fetch(`/api/produits/${produitId}`, { method: "DELETE" });
      router.push("/produits");
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      {/* Panneau */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Stock</h3>

        {/* Jauge stock */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Stock actuel</span>
            <span className={`font-bold text-lg ${enAlerte ? "text-red-600" : "text-gray-900"}`}>
              {currentStock}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                enAlerte ? "bg-red-400" : currentStock > stockMinimum * 2 ? "bg-green-400" : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(100, (currentStock / (stockMinimum * 3)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>Seuil : {stockMinimum}</span>
          </div>
        </div>

        {enAlerte && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ⚠ Stock sous le seuil minimum ({stockMinimum})
          </div>
        )}

        {canStock && actif && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Ajuster le stock
          </button>
        )}
      </div>

      {/* Actions dangereuses */}
      {(canDelete && actif) && (
        <div className="bg-white rounded-xl border border-red-100 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Zone danger</h3>
          <p className="text-xs text-gray-500">
            Archiver un produit le masque de la caisse POS et des recherches. L&apos;historique est conservé.
          </p>
          <button
            onClick={handleArchiver}
            disabled={archiving}
            className="w-full px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {archiving ? "Archivage..." : "Archiver le produit"}
          </button>
        </div>
      )}

      {/* Modal ajustement */}
      {showModal && (
        <StockAjustementModal
          produitId={produitId}
          produitNom={produitNom}
          stockActuel={currentStock}
          onSuccess={handleStockSuccess}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
