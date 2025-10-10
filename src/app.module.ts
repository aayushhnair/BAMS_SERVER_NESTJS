import { Module, MiddlewareConsumer } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';

import config from './config/config';

// Schemas
import { Company, CompanySchema } from './schemas/company.schema';
import { User, UserSchema } from './schemas/user.schema';
import { Device, DeviceSchema } from './schemas/device.schema';
import { Location, LocationSchema } from './schemas/location.schema';
import { Session, SessionSchema } from './schemas/session.schema';

// Controllers
import { DeviceController } from './controllers/device.controller';
import { AuthController } from './controllers/auth.controller';
import { HeartbeatController } from './controllers/heartbeat.controller';
import { AdminController } from './controllers/admin.controller';
import { LocationsController } from './controllers/locations.controller';
import { SessionsController } from './controllers/sessions.controller';
import { UsersController } from './controllers/users.controller';
import { CompaniesController } from './controllers/companies.controller';
import { AttendanceController } from './controllers/attendance.controller';

// Services
import { AutoLogoutService } from './services/auto-logout.service';
import { PasswordService } from './services/password.service';

// Middleware
import { AuthMiddleware } from './middleware/auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongoUri'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    DeviceController,
    AuthController,
    HeartbeatController,
    AdminController,
    LocationsController,
    SessionsController,
    UsersController,
    CompaniesController,
    AttendanceController,
  ],
  providers: [
    AutoLogoutService,
    PasswordService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
