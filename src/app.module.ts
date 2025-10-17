import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
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
        // Production-ready connection pool configuration
        maxPoolSize: 10, // Maximum number of connections in the pool
        minPoolSize: 2, // Minimum number of connections
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        serverSelectionTimeoutMS: 5000, // How long to wait for server selection
        heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
        retryWrites: true, // Retry writes on network errors
        w: 'majority', // Write concern - wait for majority of nodes
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
    // TESTING MODE: Disable authentication temporarily
    // Set this to false when you want to test with proper authentication
    const DISABLE_AUTH_FOR_TESTING = process.env.DISABLE_AUTH === 'true' || true; // Default to true for testing
    
    if (!DISABLE_AUTH_FOR_TESTING) {
      // Production authentication flow
      console.log('🔐 Authentication middleware ENABLED');
      consumer
        .apply(AuthMiddleware)
        .exclude(
          { path: 'api/auth/login', method: RequestMethod.POST },
          { path: 'api/users/create-admin', method: RequestMethod.POST },
          { path: 'api/companies', method: RequestMethod.ALL },
          { path: 'api/device/register', method: RequestMethod.POST },
          { path: 'api/heartbeat', method: RequestMethod.POST }
        )
        .forRoutes('*');
    } else {
      console.log('⚠️  Authentication middleware DISABLED for testing');
    }
  }
}
