// ─────────────────────────────────────────────────────────────────────────────
// PAGE /ventes — Liste des ventes avec filtres et recherche
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Plus, Search, Receipt, TrendingUp } from "lucide-react";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Ventes" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?: string;
    statut?: string;
    search?: string;
    dateDebut?: string;
    dateFin?: string;
  };
}

const STATUT_LABELS = {
  COMPLETEE: { label: "Complétée", class: "status-badge status-success" },
  ANNULEE: { label: "Annulée", class: "status-badge status-error" },
  REMBOURSEE: { label: "Remboursée", class: "status-badge status-warning" },
} as const;

const PAIEMENT_LABELS = {
  ESPECES: "Espèces",
  CARTE: "Carte",
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  MIXTE: "Mixte",
};

export default async function VentesPage({ searchParams }: PageProps) {
  const session = await auth();
  const canCreate = hasPermission(session!.user.role as Role, "ventes:create");

  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const pageSize = 20;
  const statut = searchParams.statut as "COMPLETEE" | "ANNULEE" | "REMBOURSEE" | undefined;
  const search = searchParams.search;

  const where = {
    ...(statut && { statut }),
    ...(search && {
      OR: [
        { numero: { contains: search, mode: "insensitive" as const } },
        { client: { nom: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [ventes, total, statsAujourdhui] = await Promise.all([
    prisma.vente.findMany({
      where,
      include: {
        client: { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
        lignes: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vente.count({ where }),
    // Stats du jour
    prisma.vente.aggregate({
      where: {
        statut: "COMPLETEE",
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventes</h1>
          <p className="text-muted-foreground text-sm">
            {total} vente{total > 1 ? "s" : ""} au total
          </p>
        </div>
        {canCreate && (
          <Link
            href="/ventes/nouvelle"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/25 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner / Nouvelle vente</span>
            <span className="sm:hidden">Scanner</span>
          </Link>
        )}
      </div>

      {/* Stats rapides du jour */}
      <div className="grid grid-cols-2 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ventes aujourd&apos;hui</p>
              <p className="text-2xl font-bold">{statsAujourdhui._count}</p>
            </div>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CA aujourd&apos;hui</p>
              <p className="text-2xl font-bold">
                {formatCurrency(statsAujourdhui._sum.total ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <form className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Numéro ou client..."
              className="flex h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            name="statut"
            defaultValue={statut ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tous les statuts</option>
            <option value="COMPLETEE">Complétée</option>
            <option value="ANNULEE">Annulée</option>
            <option value="REMBOURSEE">Remboursée</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Filtrer
          </button>
        </form>
      </div>

      {/* Tableau */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 hidden md:table-cell">Client</th>
                <th className="px-4 py-3 hidden lg:table-cell">Articles</th>
                <th className="px-4 py-3 hidden lg:table-cell">Paiement</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ventes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Aucune vente trouvée
                  </td>
                </tr>
              ) : (
                ventes.map((vente) => {
                  const statutInfo = STATUT_LABELS[vente.statut];
                  return (
                    <tr key={vente.id} className="hover:bg-muted/30 transition-colors relative cursor-pointer">
                      <td className="px-4 py-3 font-mono text-sm font-medium">
                        <Link href={`/ventes/${vente.id}`} className="before:absolute before:inset-0 before:z-[1]">
                          {vente.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                        {formatDateTime(vente.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {vente.client
                          ? `${vente.client.prenom ?? ""} ${vente.client.nom}`.trim()
                          : <span className="text-muted-foreground italic">Anonyme</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center hidden lg:table-cell">
                        {vente.lignes.length}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {PAIEMENT_LABELS[vente.modePaiement]}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(vente.total)}</td>
                      <td className="px-4 py-3">
                        <span className={statutInfo.class}>{statutInfo.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/ventes/${vente.id}`} className="text-xs text-primary hover:underline">
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} · {total} résultats
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}&statut=${statut ?? ""}&search=${search ?? ""}`}
                  className="text-sm px-3 py-1 rounded border hover:bg-muted transition-colors"
                >
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?page=${page + 1}&statut=${statut ?? ""}&search=${search ?? ""}`}
                  className="text-sm px-3 py-1 rounded border hover:bg-muted transition-colors"
                >
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
