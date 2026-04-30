import { z } from "zod";

export const createClientSchema = z.object({
  nom: z.string().min(1, "Nom requis").max(100),
  prenom: z.string().max(100).optional(),
  email: z.string().email("Email invalide").optional().nullable(),
  telephone: z
    .string()
    .regex(/^[\d\s\+\-\.()]+$/, "Téléphone invalide")
    .max(20)
    .optional()
    .nullable(),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  ville: z.string().max(100).optional(),
  categorieId: z.string().cuid().optional().nullable(),
  consentementRGPD: z.boolean().default(false),
});

export const updateClientSchema = createClientSchema.partial();

// Schéma pour le droit à l'oubli (RGPD)
export const anonymizeClientSchema = z.object({
  clientId: z.string().cuid(),
  motif: z.string().min(1, "Motif requis").max(500),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
