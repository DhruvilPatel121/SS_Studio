import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // System settings
  await prisma.systemSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global', appName: 'Medo.dev' },
    update: {},
  })

  // Super Admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@medo.dev'
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123'
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    create: {
      email: superAdminEmail,
      name: 'Super Admin',
      passwordHash: await bcrypt.hash(superAdminPassword, 12),
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
    update: {},
  })
  console.log(`✅ Super admin: ${superAdminEmail}`)

  await prisma.brandingSettings.upsert({
    where: { userId: superAdmin.id },
    create: { userId: superAdmin.id, studioName: 'Medo.dev' },
    update: {},
  })

  // Demo Photographer
  const demoEmail = process.env.DEMO_EMAIL ?? 'demo@medo.dev'
  const demoPassword = process.env.DEMO_PASSWORD ?? 'demo123456'
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      name: 'Demo Photographer',
      passwordHash: await bcrypt.hash(demoPassword, 12),
      role: 'PHOTOGRAPHER',
      isActive: true,
      isEmailVerified: true,
    },
    update: {},
  })
  console.log(`✅ Demo photographer: ${demoEmail}`)

  await prisma.brandingSettings.upsert({
    where: { userId: demoUser.id },
    create: {
      userId: demoUser.id,
      studioName: 'Demo Studio Photography',
      primaryColor: '#6366f1',
      secondaryColor: '#f59e0b',
      footerText: '© 2026 Demo Studio Photography',
    },
    update: {},
  })

  // Demo Event
  const demoEvent = await prisma.event.upsert({
    where: { slug_ownerId: { slug: 'raj-priya-wedding-2026', ownerId: demoUser.id } },
    create: {
      name: 'Raj & Priya Wedding 2026',
      slug: 'raj-priya-wedding-2026',
      description: 'A beautiful wedding celebration in Mumbai',
      location: 'The Grand Ballroom, Mumbai',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      privacy: 'PRIVATE',
      theme: 'WEDDING',
      ownerId: demoUser.id,
      eventDate: new Date('2026-02-14'),
      analytics: { create: {} },
    },
    update: {},
  })
  console.log(`✅ Demo event: ${demoEvent.name}`)

  // Demo Groups
  const groupNames = [
    { name: 'Haldi Ceremony', sortOrder: 0 },
    { name: 'Mehndi Night', sortOrder: 1 },
    { name: 'Sangeet', sortOrder: 2 },
    { name: 'Wedding Ceremony', sortOrder: 3 },
    { name: 'Reception', sortOrder: 4 },
    { name: 'Couple Portraits', sortOrder: 5 },
    { name: 'Candid Moments', sortOrder: 6 },
    { name: 'Public Gallery', sortOrder: 7 },
  ]

  for (const g of groupNames) {
    const slug = g.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await prisma.eventGroup.upsert({
      where: { slug_eventId: { slug: `${slug}-${demoEvent.id.slice(0, 6)}`, eventId: demoEvent.id } },
      create: {
        name: g.name,
        slug: `${slug}-${demoEvent.id.slice(0, 6)}`,
        eventId: demoEvent.id,
        privacy: 'ANONYMOUS_FACE_ACCESS',
        isFaceMatchEnabled: true,
        isDownloadEnabled: true,
        sortOrder: g.sortOrder,
      },
      update: {},
    })
  }
  console.log(`✅ ${groupNames.length} demo groups created`)

  // Demo QR code
  const token = 'demo-qr-token-raj-priya'
  await prisma.qrCode.upsert({
    where: { token },
    create: {
      eventId: demoEvent.id,
      token,
      url: `${process.env.APP_URL ?? 'http://localhost:3000'}/e/raj-priya-wedding-2026`,
    },
    update: {},
  })

  console.log('\n🎉 Seed complete!')
  console.log(`\n  Super Admin: ${superAdminEmail} / ${superAdminPassword}`)
  console.log(`  Demo Photographer: ${demoEmail} / ${demoPassword}`)
  console.log(`  Demo Event: /e/raj-priya-wedding-2026`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())