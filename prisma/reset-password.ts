import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@nclinic.kz';
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 12);

    try {
        await prisma.user.update({
            where: { email },
            data: { passwordHash: hash },
        });
        console.log(`✅ Password for ${email} successfully reset to: ${password}`);
    } catch (error) {
        console.error('❌ Failed to update password:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
