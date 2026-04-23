import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DealsModule } from './modules/deals/deals.module';
import { EmailsModule } from './modules/emails/emails.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LeadsModule } from './modules/leads/leads.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PulseFeedModule } from './modules/pulse-feed/pulse-feed.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { WebsocketModule } from './websocket/websocket.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    QueueModule,
    WebsocketModule,
    StorageModule,
    AiModule,
    UsersModule,
    OrganizationsModule,
    ContactsModule,
    LeadsModule,
    DealsModule,
    ProductsModule,
    ActivitiesModule,
    EmailsModule,
    CampaignsModule,
    ProjectsModule,
    InsightsModule,
    PulseFeedModule,
    WorkersModule,
  ],
})
export class AppModule {}
