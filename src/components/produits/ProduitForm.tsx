"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Camera, Loader2, AlertCircle, Palette, X, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import Image from "next/image";

interface Categorie { id: string; nom: string }

interface ProduitFormData {
  nom:             string;
  description:     string;
  categorieId:     string;
  poids:           string;
  prixVente:       string;
  prixGros:        string;
  qtePrixGros:     string;
  prixAchat:       string;
  stockActuel:     string;
  stockMinimum:    string;
  couleur:         string;
  imageUrl:        string;
  dateAcquisition: string;
}

interface ProduitFormProps {
  categories:   Categorie[];
  initialData?: Partial<ProduitFormData> & { id?: string };
  mode:         "create" | "edit";
}

// Couleurs rapides inspirées fil à crochet
const QUICK_COLORS = [
  "#FFFFFF", "#F5F5DC", "#FFD700", "#FFA500", "#FF6B6B",
  "#E91E8C", "#9C27B0", "#3F51B5", "#2196F3", "#00BCD4",
  "#4CAF50", "#8BC34A", "#795548", "#607D8B", "#000000",
  "#C17F24", "#8B4513", "#D2691E", "#F4A460", "#DEB887",
];

export default function ProduitForm({ categories, initialData, mode }: ProduitFormProps) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showNewCat,  setShowNewCat]  = useState(false);
  const [newCatNom,   setNewCatNom]   = useState("");
  const [localCats,   setLocalCats]   = useState(categories);

  const [form, setForm] = useState<ProduitFormData>({
    nom:             initialData?.nom             ?? "",
    description:     initialData?.description     ?? "",
    categorieId:     initialData?.categorieId     ?? "",
    poids:           initialData?.poids           ?? "",
    prixVente:       initialData?.prixVente       ?? "",
    prixGros:        initialData?.prixGros        ?? "",
    qtePrixGros:     initialData?.qtePrixGros     ?? "",
    prixAchat:       initialData?.prixAchat       ?? "0",
    stockActuel:     initialData?.stockActuel     ?? "0",
    stockMinimum:    initialData?.stockMinimum    ?? "5",
    couleur:         initialData?.couleur         ?? "",
    imageUrl:        initialData?.imageUrl        ?? "",
    dateAcquisition: initialData?.dateAcquisition ?? "",
  });

  const set = (k: keyof ProduitFormData, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  /* ── Upload image ── */
  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur upload");
      set("imageUrl", json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  /* ── Créer catégorie ── */
  async function handleCreateCat() {
    if (!newCatNom.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: newCatNom.trim() }),
    });
    if (!res.ok) { setError("Erreur création catégorie"); return; }
    const cat = await res.json();
    setLocalCats((prev) => [...prev, cat].sort((a, b) => a.nom.localeCompare(b.nom)));
    set("categorieId", cat.id);
    setNewCatNom("");
    setShowNewCat(false);
  }

  /* ── Soumettre ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      nom:             form.nom,
      description:     form.description || undefined,
      categorieId:     form.categorieId || null,
      poids:           form.poids || null,
      prixVente:       parseFloat(form.prixVente),
      prixGros:        form.prixGros ? parseFloat(form.prixGros) : null,
      qtePrixGros:     form.qtePrixGros ? parseInt(form.qtePrixGros) : null,
      prixAchat:       parseFloat(form.prixAchat) || 0,
      tauxTVA:         0,
      stockActuel:     parseInt(form.stockActuel) || 0,
      stockMinimum:    parseInt(form.stockMinimum) || 5,
      imageUrl:        form.imageUrl || null,
      couleur:         form.couleur || null,
      dateAcquisition: form.dateAcquisition || null,
    };

    try {
      const url    = mode === "create" ? "/api/produits" : `/api/produits/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      router.push(`/produits/${(json as { id: string }).id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Photo du produit ── */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" /> Photo du produit
        </h2>

        {/* Preview */}
        {form.imageUrl ? (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border group">
            <Image src={form.imageUrl} alt="Photo produit" fill className="object-cover" />
            <button
              type="button"
              onClick={() => set("imageUrl", "")}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer",
              "hover:border-primary hover:bg-primary/5 transition-colors",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-2" />
            ) : (
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm text-muted-foreground">
              {uploading ? "Upload en cours..." : "Cliquez pour ajouter une photo"}
            </p>
          </div>
        )}

        {/* Boutons upload */}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5">
            <Upload className="h-3.5 w-3.5" /> Choisir fichier
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary text-xs py-1.5">
            <Camera className="h-3.5 w-3.5" /> Caméra
          </button>
        </div>
      </div>

      {/* ── Couleur de la laine ── */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" /> Couleur de la laine
        </h2>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Aperçu couleur sélectionnée */}
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full border-2 border-border shadow-sm cursor-pointer"
              style={{ backgroundColor: form.couleur || "#e5e7eb" }}
              onClick={() => setShowPalette(!showPalette)}
              title="Cliquer pour changer"
            />
            <span className="text-sm font-mono text-muted-foreground">
              {form.couleur || "Aucune"}
            </span>
            {form.couleur && (
              <button type="button" onClick={() => set("couleur", "")} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Input couleur natif (palette infinie) */}
          <label className="btn-ghost text-xs py-1.5 cursor-pointer">
            <Palette className="h-3.5 w-3.5" /> Palette complète
            <input
              type="color"
              value={form.couleur || "#C17F24"}
              onChange={(e) => set("couleur", e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        {/* Couleurs rapides */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Couleurs rapides</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("couleur", c)}
                title={c}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                  form.couleur === c ? "border-primary scale-110 shadow-md" : "border-border"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Informations produit ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Informations du produit</h2>

        <div>
          <label className="form-label">Nom du produit *</label>
          <input
            type="text" required maxLength={200}
            value={form.nom} onChange={(e) => set("nom", e.target.value)}
            className="form-input" placeholder="Ex: Laine mérinos dorée 50g"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Catégorie */}
          <div>
            <label className="form-label">Catégorie</label>
            <div className="flex gap-2">
              <select value={form.categorieId} onChange={(e) => set("categorieId", e.target.value)} className="form-select flex-1">
                <option value="">Sélectionner...</option>
                <option value="__unicolor">Uni Color</option>
                <option value="__multicolor">Multicolor</option>
                {localCats
                  .filter((c) => c.nom !== "Uni Color" && c.nom !== "Multicolor")
                  .map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewCat(!showNewCat)}
                className="btn-ghost px-2 py-2" title="Nouvelle catégorie">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {showNewCat && (
              <div className="flex gap-2 mt-2">
                <input value={newCatNom} onChange={(e) => setNewCatNom(e.target.value)}
                  placeholder="Nom catégorie" className="form-input flex-1 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCat())} />
                <button type="button" onClick={handleCreateCat} className="btn-primary text-xs px-3">Créer</button>
              </div>
            )}
          </div>

          {/* Poids */}
          <div>
            <label className="form-label">Poids</label>
            <input type="text" value={form.poids} onChange={(e) => set("poids", e.target.value)}
              className="form-input" placeholder="50g, 100g, 200g..." maxLength={20} />
          </div>
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea rows={2} maxLength={2000} value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="form-textarea" placeholder="Description optionnelle..." />
        </div>
      </div>

      {/* ── Prix (XAF) ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Prix (XAF)</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Prix Détail (XAF) *</label>
            <input type="number" required min="0" step="1"
              value={form.prixVente} onChange={(e) => set("prixVente", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
          <div>
            <label className="form-label">Prix de Gros (XAF)</label>
            <input type="number" min="0" step="1"
              value={form.prixGros} onChange={(e) => set("prixGros", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Qté min. Prix de Gros</label>
            <input type="number" min="0" step="1"
              value={form.qtePrixGros} onChange={(e) => set("qtePrixGros", e.target.value)}
              className="form-input" placeholder="Ex: 10" />
          </div>
          <div>
            <label className="form-label">Prix d&apos;achat (XAF)</label>
            <input type="number" min="0" step="1"
              value={form.prixAchat} onChange={(e) => set("prixAchat", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
        </div>

        {/* Marge calculée */}
        {form.prixVente && parseFloat(form.prixVente) > 0 && parseFloat(form.prixAchat) > 0 && (
          <div className="text-sm bg-secondary rounded-xl px-4 py-2.5 text-secondary-foreground">
            Marge :{" "}
            <span className="font-semibold">
              {(((parseFloat(form.prixVente) - parseFloat(form.prixAchat)) / parseFloat(form.prixVente)) * 100).toFixed(1)}%
            </span>
            {" · "}
            {(parseFloat(form.prixVente) - parseFloat(form.prixAchat)).toLocaleString("fr-FR")} XAF
          </div>
        )}
      </div>

      {/* ── Stock ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Stock</h2>

        <div className="grid grid-cols-2 gap-3">
          {mode === "create" && (
            <div>
              <label className="form-label">Stock Initial</label>
              <input type="number" min="0" step="1"
                value={form.stockActuel} onChange={(e) => set("stockActuel", e.target.value)}
                className="form-input" />
              <p className="text-xs text-muted-foreground mt-1">Un mouvement ENTRÉE sera créé automatiquement</p>
            </div>
          )}
          <div>
            <label className="form-label">Seuil Alerte</label>
            <input type="number" min="0" step="1"
              value={form.stockMinimum} onChange={(e) => set("stockMinimum", e.target.value)}
              className="form-input" />
            <p className="text-xs text-muted-foreground mt-1">Alerte quand stock passe sous ce seuil</p>
          </div>
          <div>
            <label className="form-label">Date d&apos;acquisition</label>
            <input type="date"
              value={form.dateAcquisition} onChange={(e) => set("dateAcquisition", e.target.value)}
              className="form-input" />
          </div>
        </div>
      </div>

      {/* ── Note barcode ── */}
      {mode === "create" && (
        <p className="text-xs text-muted-foreground bg-secondary rounded-xl px-4 py-2.5">
          🔖 Un code-barres EAN-13 sera généré automatiquement et assigné à ce produit.
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => router.back()} className="btn-ghost">Annuler</button>
        <button type="submit" disabled={loading || uploading} className="btn-primary px-6">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> :
           mode === "create" ? "Ajouter au stock" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
