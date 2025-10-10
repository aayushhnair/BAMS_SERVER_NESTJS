import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AutoLogoutService {
  private readonly logger = new Logger(AutoLogoutService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoLogout() {
    try {
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;
      const heartbeatMinutes = this.configService.get<number>('heartbeatMinutes') || 5;

      const now = new Date();
      const sessionTimeoutMs = sessionTimeoutHours * 60 * 60 * 1000;
      const heartbeatTimeoutMs = heartbeatMinutes * 3 * 60 * 1000;

      // Find sessions that should be auto-logged out
      const sessionsToAutoLogout = await this.sessionModel.find({
        status: 'active',
        $or: [
          // Sessions where login time + session timeout has passed
          {
            loginAt: {
              $lte: new Date(now.getTime() - sessionTimeoutMs)
            }
          },
          // Sessions where last heartbeat is stale (older than heartbeat timeout)
          {
            lastHeartbeat: {
              $lte: new Date(now.getTime() - heartbeatTimeoutMs)
            }
          }
        ]
      });

      if (sessionsToAutoLogout.length > 0) {
        // Update these sessions to auto_logged_out
        const sessionIds = sessionsToAutoLogout.map(session => session._id);
        
        await this.sessionModel.updateMany(
          { _id: { $in: sessionIds } },
          {
            logoutAt: now,
            status: 'auto_logged_out'
          }
        );

        this.logger.log(`Auto-logged out ${sessionsToAutoLogout.length} sessions`);
      } else {
        this.logger.debug('No sessions to auto-logout');
      }
    } catch (error) {
      this.logger.error('Failed to run auto-logout job', error);
    }
  }
}