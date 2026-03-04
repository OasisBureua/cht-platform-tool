import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const devUser = await prisma.user.upsert({
    where: { authId: 'auth0|dev-local-user' },
    update: {},
    create: {
      authId: 'auth0|dev-local-user',
      email: 'dev@chtplatform.local',
      firstName: 'Dev',
      lastName: 'User',
      role: UserRole.HCP,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { authId: 'auth0|dev-admin-user' },
    update: {},
    create: {
      authId: 'auth0|dev-admin-user',
      email: 'admin@chtplatform.local',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  });

  const program = await prisma.program.upsert({
    where: { id: 'seed-program-1' },
    update: {},
    create: {
      id: 'seed-program-1',
      title: 'Cardiology Treatment Webinar',
      description: 'Learn about modern cardiology treatments.',
      status: 'PUBLISHED',
      sponsorName: 'Pfizer',
      creditAmount: 2.5,
      honorariumAmount: 50000,
      requiresSurvey: true,
      publishedAt: new Date(),
    },
  });

  const survey = await prisma.survey.upsert({
    where: { id: 'seed-survey-1' },
    update: { jotformFormId: '260624911991966' },
    create: {
      id: 'seed-survey-1',
      programId: program.id,
      title: 'Cardiology Treatment Feedback',
      description: 'Share your feedback on this activity.',
      type: 'FEEDBACK',
      required: true,
      jotformFormId: '260624911991966', // 2/18 Post Event Survey - https://communityhealthmedia.jotform.com/260624911991966
      questions: {
        questions: [
          { id: 'q1', type: 'single_choice', prompt: 'How valuable was this activity?', options: ['Low', 'Medium', 'High'], required: true },
          { id: 'q2', type: 'text', prompt: 'Any additional comments?' },
        ],
      },
    },
  });

  console.log('✅ Seeded dev user (HCP):', devUser.id, devUser.email);
  console.log('✅ Seeded admin user:', adminUser.id, adminUser.email);
  console.log('✅ Seeded program:', program.id);
  console.log('✅ Seeded survey:', survey.id);
  console.log('');
  console.log('For local API testing (without Auth0), use header:');
  console.log(`  X-Dev-User-Id: ${devUser.id}`);
  console.log(`  (Admin) X-Dev-User-Id: ${adminUser.id}`);
  console.log(`  Survey URL: /app/surveys/${survey.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
