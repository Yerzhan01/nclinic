import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking IntegrationSettings ---');
    const settings = await prisma.integrationSettings.findMany();
    console.log(JSON.stringify(settings, null, 2));

    console.log('\n--- Checking Patients (searching for Erzhan) ---');
    const patients = await prisma.patient.findMany({
        where: {
            fullName: {
                contains: 'Erzhan',
                mode: 'insensitive'
            }
        }
    });
    console.log('Found patients:', patients);

    console.log('\n--- All Patients Count ---');
    const count = await prisma.patient.count();
    console.log('Total patients:', count);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
