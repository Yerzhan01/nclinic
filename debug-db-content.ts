import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Content Debug ---');

    // Users
    const users = await prisma.user.findMany();
    console.log(`Users (${users.length}):`);
    users.forEach(u => console.log(` - ${u.email} (${u.role})`));

    // Patients
    const patients = await prisma.patient.findMany();
    console.log(`\nPatients (${patients.length}):`);
    patients.forEach(p => console.log(` - ${p.fullName} (${p.phone})`));

    // Templates
    const templates = await prisma.programTemplate.findMany();
    console.log(`\nProgram Templates (${templates.length}):`);
    templates.forEach(t => console.log(` - ${t.name} (ID: ${t.id})`));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
