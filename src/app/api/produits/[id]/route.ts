// ─────────────────────────────────────────────────────────────────────────────
// GET   /api/produits/[id] — Détail complet
// PATCH /api/produits/[id] — Modifier un produit
// DELETE /api/produits/[id] — Archiver (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { updateProduitSchema } from "@/lib/validations/produit.schema";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/produits/[id] ───────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const produit = await prisma.produit.findUnique({
    where: { id },
    include: {
      categorie: true,
      variantes: true,
      mouvementsStock: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { produit: { select: { nom: true } } },
      },
      _count: { select: { lignesVente: true } },
    },
  });

  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  return NextResponse.json(produit);
}

// ─── PATCH /api/produits/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown", RATE_LIMITS.api);
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { id } = await params;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const body = await req.json();
  const parsed = updateProduitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Vérifier unicité du code-barres si modifié
  if (data.codeBarres && data.codeBarres !== produit.codeBarres) {
    const exists = await prisma.produit.findUnique({ where: { codeBarres: data.codeBarres } });
    if (exists) return NextResponse.json({ error: "Code-barres déjà utilisé" }, { status: 409 });
  }

  // Résoudre les catégories spéciales __unicolor / __multicolor
  let resolvedCategorieId: string | null | undefined = data.categorieId;
  if (resolvedCategorieId === "__unicolor" || resolvedCategorieId === "__multicolor") {
    const nomCat = resolvedCategorieId === "__unicolor" ? "Uni Color" : "Multicolor";
    const cat = await prisma.categorie.upsert({
      where: { nom: nomCat },
      create: { nom: nomCat },
      update: {},
    });
    resolvedCategorieId = cat.id;
  }

  const updated = await prisma.produit.update({
    where: { id },
    data: {
      ...(data.nom             !== undefined && { nom: data.nom }),
      ...(data.description     !== undefined && { description: data.description }),
      ...(data.codeBarres      !== undefined && { codeBarres: data.codeBarres }),
      ...(resolvedCategorieId !== undefined && resolvedCategorieId !== null && {
        categorie: { connect: { id: resolvedCategorieId } },
      }),
      ...(resolvedCategorieId === null && { categorie: { disconnect: true } }),
      ...(data.prixVente       !== undefined && { prixVente: data.prixVente }),
      ...(data.prixGros        !== undefined && { prixGros: data.prixGros }),
      ...(data.qtePrixGros     !== undefined && { qtePrixGros: data.qtePrixGros }),
      ...(data.prixAchat       !== undefined && { prixAchat: data.prixAchat }),
      ...(data.tauxTVA         !== undefined && { tauxTVA: data.tauxTVA }),
      ...(data.stockMinimum    !== undefined && { stockMinimum: data.stockMinimum }),
      ...(data.imageUrl        !== undefined && { imageUrl: data.imageUrl }),
      ...(data.couleur         !== undefined && { couleur: data.couleur }),
      ...(data.poids           !== undefined && { poids: data.poids }),
      ...(data.dateAcquisition !== undefined && { dateAcquisition: data.dateAcquisition ? new Date(data.dateAcquisition) : null }),
    },
    include: { categorie: true },
  });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.PRODUIT_UPDATED,
    entityId:   id,
    entityType: "produit",
    details:    { avant: { nom: produit.nom, prixVente: produit.prixVente }, apres: data },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/produits/[id] ────────────────────────────────────────────────
// Soft-delete : on passe actif=false, les données historiques sont préservées
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  await prisma.produit.update({ where: { id }, data: { actif: false } });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.PRODUIT_ARCHIVED,
    entityId:   id,
    entityType: "produit",
    details:    { nom: produit.nom },
  });

  return NextResponse.json({ success: true });
}
