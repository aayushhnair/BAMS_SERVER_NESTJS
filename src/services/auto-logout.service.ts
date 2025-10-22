import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AutoLogoutService {
  private readonly logger = new Logger(AutoLogoutService.name);
  // Simple in-memory counters (process-local). For production, wire metrics to a metrics system.
  private heartbeatTimeoutCount = 0;
  private dailyAggregateCount = 0;

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
        // Increment counter and log a few samples to help triage which users/devices are affected
        this.heartbeatTimeoutCount += sessionsToLogout.length;
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
      // Bulk update approach: fetch active sessions and prepare bulk operations in batches
      const activeSessions = await this.sessionModel.find({ status: 'active' }).select('loginAt lastHeartbeat');
      if (activeSessions.length === 0) {
        this.logger.debug('Daily aggregation: no active sessions to close');
        return 0;
      }

      const bulkOps = activeSessions.map(s => {
        const maxLogout = new Date(s.loginAt.getTime() + sessionTimeoutHours * 60 * 60 * 1000);
        const lastHb = s.lastHeartbeat || s.loginAt;
        const logoutTime = lastHb.getTime() < maxLogout.getTime() ? lastHb : maxLogout;
        const finalLogout = logoutTime.getTime() > now.getTime() ? now : logoutTime;

        // Compute worked seconds as difference between loginAt and finalLogout
        const workedSeconds = Math.max(0, Math.floor((finalLogout.getTime() - s.loginAt.getTime()) / 1000));

        return {
          updateOne: {
            filter: { _id: s._id },
            update: { $set: { logoutAt: finalLogout, status: 'auto_logged_out', workedSeconds } }
          }
        };
      });

      // Execute bulk in batches of 500
      const batchSize = 500;
      let updatedCount = 0;
      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        const res = await this.sessionModel.bulkWrite(batch);
        updatedCount += res.modifiedCount || 0;
      }

      if (updatedCount > 0) {
        this.dailyAggregateCount += updatedCount;
        this.logger.log(`Daily aggregation: closed ${updatedCount} active sessions`);
      } else {
        this.logger.debug('Daily aggregation: no active sessions were closed by bulk update');
      }

      return updatedCount;
    } catch (error) {
      this.logger.error('Failed to perform daily aggregation', error);
      throw error;
    }
  }

  // Expose counters for metrics (process-local)
  getMetrics() {
    return {
      heartbeatTimeoutCount: this.heartbeatTimeoutCount,
      dailyAggregateCount: this.dailyAggregateCount
    };
  }
}