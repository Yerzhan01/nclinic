
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@nclinic.kz';
    const password = 'admin123';

    console.log(`Hashing password...`);
    // Generate real hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log(`Resetting password for ${email}...`);

    const user = await prisma.user.update({
        where: { email },
        data: { passwordHash }
    });

    console.log(`✅ Password updated successfully for user ID: ${user.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
