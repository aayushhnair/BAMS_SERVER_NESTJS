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
  const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;

  const now = new Date();
  const sessionTimeoutMs = sessionTimeoutHours * 60 * 60 * 1000;
  const heartbeatTimeoutMs = heartbeatMinutes * heartbeatGraceFactor * 60 * 1000;

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

  // Additional cron: run every 30 minutes to ensure heartbeat-based logouts are enforced
  @Cron('0 */30 * * * *') // every 30 minutes at 0 seconds
  async handleHeartbeatAutoLogout() {
    await this.performHeartbeatLogout();
  }

  /**
   * Public method to run heartbeat-based logout. Can be called from a webhook for serverless deployments.
   * Returns the number of sessions auto-logged-out.
   */
  async performHeartbeatLogout(): Promise<number> {
    try {
      const heartbeatMinutes = this.configService.get<number>('heartbeatMinutes') || 5;
      const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;

      const now = new Date();
      const heartbeatTimeoutMs = heartbeatMinutes * heartbeatGraceFactor * 60 * 1000;

      const sessionsToLogout = await this.sessionModel.find({
        status: 'active',
        lastHeartbeat: { $lte: new Date(now.getTime() - heartbeatTimeoutMs) }
      });

      if (sessionsToLogout.length > 0) {
        const ids = sessionsToLogout.map(s => s._id);
        await this.sessionModel.updateMany(
          { _id: { $in: ids } },
          { logoutAt: now, status: 'auto_logged_out' }
        );
        // Log a few samples to help triage which users/devices are affected
        const samples = sessionsToLogout.slice(0, 5).map(s => ({ sessionId: String(s._id), userId: s.userId, deviceId: s.deviceId }));
        this.logger.warn(`Heartbeat task: auto-logged out ${sessionsToLogout.length} sessions due to missing heartbeats`, { count: sessionsToLogout.length, samples });
      } else {
        this.logger.debug('Heartbeat task: no stale heartbeat sessions to auto-logout');
      }

      return sessionsToLogout.length;
    } catch (error) {
      this.logger.error('Failed to run heartbeat auto-logout task', error);
      throw error;
    }
  }

  /**
   * Perform daily aggregation at end of day: close active sessions based on lastHeartbeat
   * and cap session duration to sessionTimeoutHours.
   * Returns number of sessions updated.
   */
  async performDailyAggregation(): Promise<number> {
    try {
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;
      const now = new Date();

      // Find active sessions that started today or earlier and still active
      const sessions = await this.sessionModel.find({ status: 'active' });
      const updatedIds: any[] = [];

      for (const session of sessions) {
        // Compute max allowed logout time based on session timeout
        const maxLogout = new Date(session.loginAt.getTime() + sessionTimeoutHours * 60 * 60 * 1000);

        // Use lastHeartbeat if available, otherwise fallback to loginAt
        const lastHb = session.lastHeartbeat || session.loginAt;

        // Choose the earlier of lastHeartbeat and maxLogout
        const logoutTime = lastHb.getTime() < maxLogout.getTime() ? lastHb : maxLogout;

        // Ensure we don't set logout in the future
        const finalLogout = logoutTime.getTime() > now.getTime() ? now : logoutTime;

        await this.sessionModel.updateOne({ _id: session._id }, { logoutAt: finalLogout, status: 'auto_logged_out' });
        updatedIds.push(session._id);
      }

      if (updatedIds.length > 0) {
        this.logger.log(`Daily aggregation: closed ${updatedIds.length} active sessions`);
      } else {
        this.logger.debug('Daily aggregation: no active sessions to close');
      }

      return updatedIds.length;
    } catch (error) {
      this.logger.error('Failed to perform daily aggregation', error);
      throw error;
    }
  }
}