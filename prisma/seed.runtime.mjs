import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed runtime: initialisation des donnees de base...");

  const adminPasswordHash = await hash("Admin@2024!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gestion.fr" },
    update: {},
    create: {
      email: "admin@gestion.fr",
      passwordHash: adminPasswordHash,
      nom: "Administrateur",
      prenom: "Super",
      role: "SUPER_ADMIN",
      actif: true,
    },
  });
  console.log(`✅ Admin pret: ${admin.email}`);

  await prisma.entreprise.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      nom: "Mon Entreprise",
      adresse: "123 Rue du Commerce",
      codePostal: "75001",
      ville: "Paris",
      tauxTVADefaut: 20.0,
      email: "contact@monentreprise.fr",
    },
  });

  const categories = ["General", "Alimentation", "Textile", "Electronique", "Services"];
  for (const nom of categories) {
    await prisma.categorie.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
  }

  const categoriesClients = [
    { nom: "Standard", remise: 0 },
    { nom: "Fidele", remise: 5 },
    { nom: "VIP", remise: 10 },
    { nom: "Professionnel", remise: 15 },
  ];
  for (const cat of categoriesClients) {
    await prisma.categorieClient.upsert({
      where: { nom: cat.nom },
      update: {},
      create: cat,
    });
  }

  console.log("✅ Seed runtime termine (idempotent)");
}

main()
  .catch((e) => {
    console.error("❌ Seed runtime en echec:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
