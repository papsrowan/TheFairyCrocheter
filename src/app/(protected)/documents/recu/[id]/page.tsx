"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Printer, Loader2, AlertCircle } from "lucide-react";

const Barcode = dynamic(() => import("react-barcode"), { ssr: false });

const MODES: Record<string, string> = {
  ESPECES: "Espèces", CARTE: "Carte bancaire",
  VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte",
};

function fmtXAF(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

interface VenteRecu {
  id: string; numero: string; createdAt: string;
  sousTotal: number; montantTVA: number; remiseGlobale: number;
  total: number; modePaiement: string; notes?: string | null;
  client?: { nom: string; prenom?: string | null } | null;
  vendeur: { nom: string; prenom: string };
  lignes: Array<{
    id: string; quantite: number; prixUnitaire: number;
    remise: number; total: number;
    produit: { nom: string; codeBarres?: string | null };
  }>;
}

interface Entreprise {
  nom: string; adresse: string; codePostal: string; ville: string;
  telephone?: string | null; piedPageFacture?: string | null;
}

export default function RecuPage() {
  const { id } = useParams<{ id: string }>();
  const [vente, setVente]           = useState<VenteRecu | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch(`/api/documents/recu/${id}`)
      .then((r) => r.json())
      .then((j) => {
        setVente(j.data.vente);
        setEntreprise(j.data.entreprise);
      })
      .catch(() => setError("Impossible de charger le reçu"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !vente || !entreprise) return (
    <div className="flex items-center justify-center min-h-screen gap-2 text-destructive">
      <AlertCircle className="h-5 w-5" />
      <span>{error ?? "Reçu introuvable"}</span>
    </div>
  );

  return (
    <>
      {/* Boutons action (masqués à l'impression) */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2 shadow-lg"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
        <a href={`/api/documents/ticket/${id}`} target="_blank"
          className="btn-secondary flex items-center gap-2 shadow-lg text-sm">
          PDF Ticket
        </a>
        <a href={`/api/documents/facture/${id}`} target="_blank"
          className="btn-ghost flex items-center gap-2 shadow-lg text-sm">
          PDF Facture
        </a>
      </div>

      {/* Reçu thermique */}
      <div className="flex justify-center bg-gray-100 min-h-screen py-8 px-4 no-print-bg">
        <div
          className="recu-thermal bg-white shadow-xl"
          style={{ width: "100%", maxWidth: 320, fontFamily: "monospace" }}
        >
          {/* En-tête */}
          <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/TFC0.png" alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2" />
            <h1 className="text-lg font-bold uppercase tracking-widest">{entreprise.nom}</h1>
            <p className="text-xs text-gray-500 mt-1">{entreprise.adresse}</p>
            <p className="text-xs text-gray-500">{entreprise.codePostal} {entreprise.ville}</p>
            {entreprise.telephone && (
              <p className="text-xs text-gray-500">{entreprise.telephone}</p>
            )}
          </div>

          {/* Infos vente */}
          <div className="text-xs space-y-1 border-b border-dashed border-gray-300 pb-3 mb-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Ticket</span>
              <span className="font-bold">{vente.numero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{fmtDate(vente.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendeur</span>
              <span>{vente.vendeur.prenom} {vente.vendeur.nom}</span>
            </div>
            {vente.client && (
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span>{vente.client.prenom ? vente.client.prenom + " " : ""}{vente.client.nom}</span>
              </div>
            )}
          </div>

          {/* Articles */}
          <div className="space-y-3 border-b border-dashed border-gray-300 pb-3 mb-3">
            {vente.lignes.map((ligne) => (
              <div key={ligne.id}>
                <div className="text-sm font-semibold leading-tight">{ligne.produit.nom}</div>
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>
                    {ligne.quantite} × {fmtXAF(ligne.prixUnitaire)}
                    {ligne.remise > 0 && <span className="text-emerald-600"> -{ligne.remise}%</span>}
                  </span>
                  <span className="font-semibold text-gray-900">{fmtXAF(ligne.total)}</span>
                </div>
                {/* Barcode article */}
                {ligne.produit.codeBarres && (
                  <div className="mt-1.5">
                    <Barcode
                      value={ligne.produit.codeBarres}
                      format="EAN13"
                      width={1.2}
                      height={35}
                      fontSize={9}
                      margin={0}
                      background="#ffffff"
                      lineColor="#111111"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="text-sm space-y-1 border-b border-dashed border-gray-300 pb-3 mb-3">
            {vente.sousTotal !== vente.total && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Sous-total</span>
                <span>{fmtXAF(vente.sousTotal)}</span>
              </div>
            )}
            {vente.remiseGlobale > 0 && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Remise {vente.remiseGlobale}%</span>
                <span>-{fmtXAF(vente.sousTotal * vente.remiseGlobale / 100)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-1">
              <span>TOTAL</span>
              <span>{fmtXAF(vente.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Paiement</span>
              <span className="font-medium">{MODES[vente.modePaiement] ?? vente.modePaiement}</span>
            </div>
          </div>

          {vente.notes && (
            <p className="text-xs text-gray-500 italic text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              {vente.notes}
            </p>
          )}

          {/* Barcode ticket */}
          <div className="flex flex-col items-center mt-2 mb-2">
            <Barcode
              value={vente.numero}
              format="CODE128"
              width={1.4}
              height={45}
              fontSize={10}
              margin={0}
              background="#ffffff"
              lineColor="#111111"
              displayValue={false}
            />
            <p className="text-xs font-mono font-bold tracking-widest mt-1">{vente.numero}</p>
          </div>

          {/* Pied */}
          <div className="text-center text-xs text-gray-400 border-t border-dashed border-gray-300 pt-3 mt-3 space-y-1">
            <p>{entreprise.piedPageFacture ?? "Merci de votre confiance !"}</p>
            <p>Conservez ce ticket comme preuve d&apos;achat</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          .recu-thermal { box-shadow: none !important; max-width: 80mm !important; margin: 0 auto; }
          body { margin: 0; }
        }
      `}</style>
    </>
  );
}
